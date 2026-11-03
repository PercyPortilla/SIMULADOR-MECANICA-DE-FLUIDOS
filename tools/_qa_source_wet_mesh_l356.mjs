/**
 * L356 independent read-only topology/raycast gate of SOURCE V57/B64 GLB.
 * No solver, CAD, web asset or binary mesh modifications.
 * Signed QA history (L127/L346/L347) remains the authority for SW BRep gates.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const input=path.resolve('public/models/pulpa-v57/PULPA_LAB_V57_FULL_SITE_FINAL.glb');
const buffer=fs.readFileSync(input);
const checksum=crypto.createHash('sha256').update(buffer).digest('hex');
const expected='73826d5cb777ed08cd9f20a9dd3171c1964f1f8de8c570edfb9f4a802538e306';
if(checksum!==expected)throw Error('B64_SOURCE_SHA_NOT_EXPECTED');
if(buffer.subarray(0,4).toString()!=='glTF'||buffer.readUInt32LE(4)!==2)throw Error('GLB2_REQUIRED');
const jsonLength=buffer.readUInt32LE(12),json=JSON.parse(buffer.subarray(20,20+jsonLength).toString('utf8'));
const binStart=20+jsonLength+8;
const nodes=json.nodes??[],meshes=json.meshes??[],accessors=json.accessors??[],views=json.bufferViews??[];
const parents=new Array(nodes.length).fill(-1);
for(let i=0;i<nodes.length;i++)for(const child of nodes[i].children??[])parents[child]=i;

const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function multiply(a,b){
 const r=Array(16).fill(0);
 for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)
  r[c*4+row]+=a[k*4+row]*b[c*4+k];
 return r;
}
function trs(node){
 if(node.matrix)return node.matrix;
 const [x,y,z,w]=node.rotation??[0,0,0,1];
 const [sx,sy,sz]=node.scale??[1,1,1];
 const [tx,ty,tz]=node.translation??[0,0,0];
 const x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
 return [
  (1-yy-zz)*sx,(xy+wz)*sx,(xz-wy)*sx,0,
  (xy-wz)*sy,(1-xx-zz)*sy,(yz+wx)*sy,0,
  (xz+wy)*sz,(yz-wx)*sz,(1-xx-yy)*sz,0,
  tx,ty,tz,1,
 ];
}
const matrixCache=new Map();
function world(index){
 if(matrixCache.has(index))return matrixCache.get(index);
 const local=trs(nodes[index]);
 const p=parents[index],m=p<0?local:multiply(world(p),local);
 matrixCache.set(index,m);return m;
}
function point(m,p){
 const [x,y,z]=p;return [
  m[0]*x+m[4]*y+m[8]*z+m[12],
  m[1]*x+m[5]*y+m[9]*z+m[13],
  m[2]*x+m[6]*y+m[10]*z+m[14],
 ];
}
// Blender Z-up coordinates are glTF x, -z, y after Blender GLB export.
const blender=p=>[p[0],-p[2],p[1]];
function access(aIndex){
 const a=accessors[aIndex],v=views[a.bufferView];
 if(!a||!v||a.sparse)throw Error('UNSUPPORTED_GLTF_ACCESSOR_'+aIndex);
 const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
 const bytes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a.componentType];
 if(!components||!bytes)throw Error('UNSUPPORTED_ACCESSOR_TYPE_'+aIndex);
 const offset=binStart+(v.byteOffset||0)+(a.byteOffset||0);
 const stride=v.byteStride||components*bytes;
 const numbers=new Array(a.count*components);
 for(let i=0;i<a.count;i++)for(let k=0;k<components;k++){
  const pos=offset+i*stride+k*bytes;
  numbers[i*components+k]=a.componentType===5126?buffer.readFloatLE(pos):
   a.componentType===5125?buffer.readUInt32LE(pos):
   a.componentType===5123?buffer.readUInt16LE(pos):
   a.componentType===5121?buffer.readUInt8(pos):
   a.componentType===5122?buffer.readInt16LE(pos):buffer.readInt8(pos);
 }
 return {numbers,count:a.count,components};
}
function meshesForNode(index){
 const node=nodes[index];
 if(node.mesh===undefined)return null;
 const mesh=meshes[node.mesh];
 const mat=world(index);
 const points=[],faces=[];
 for(const primitive of mesh.primitives??[]){
  const primPos=access(primitive.attributes.POSITION);
  const ids=primitive.indices!==undefined?access(primitive.indices).numbers:
   Array.from({length:primPos.count},(_,k)=>k);
  const offset=points.length;
  for(let k=0;k<primPos.count;k++){
   points.push(point(mat,primPos.numbers.slice(k*3,k*3+3)));
  }
  if((primitive.mode??4)!==4)throw Error('UNSUPPORTED_NONTRIANGLE_GLTF_MESH');
  for(let k=0;k<ids.length;k+=3)faces.push([ids[k]+offset,ids[k+1]+offset,ids[k+2]+offset]);
 }
 return {points,faces};
}
function quantize(p){return p.map(x=>Math.round(x*10000)).join(',');}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function subtract(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function rayTri(origin,direction,a,b,c){
 const eps=1e-8,e1=subtract(b,a),e2=subtract(c,a),p=cross(direction,e2),det=dot(e1,p);
 if(Math.abs(det)<eps)return null;
 const inv=1/det,tvec=subtract(origin,a),u=dot(tvec,p)*inv;
 if(u<0||u>1)return null;
 const q=cross(tvec,e1),v=dot(direction,q)*inv;
 if(v<0||u+v>1)return null;
 const t=dot(e2,q)*inv;return t>1e-5?t:null;
}
const targetNames=[
 'SLURRY-PUMP-01_SUCTION_SEG02','SLURRY-PUMP-01_SUCTION_FLUID_SEG02',
 'SLURRY-PUMP-01_VOLUTE','SLURRY-PUMP-01_VOLUTE_TRANS',
 'SLURRY-PUMP-01_DISCHARGE_PIPE','SLURRY-PUMP-01_DISCHARGE_FLUID',
 'SLURRY-PUMP-01_IMPELLER_HUB',
];
const selected={};
for(const target of targetNames){
 const index=nodes.findIndex(n=>n.name===target);
 if(index<0)throw Error('SOURCE_GLTF_NODE_MISSING_'+target);
 const geometry=meshesForNode(index);
 if(!geometry)throw Error('SOURCE_GLTF_MESH_MISSING_'+target);
 const {points,faces}=geometry;
 const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
 for(const p of points)for(let k=0;k<3;k++){
  mins[k]=Math.min(mins[k],p[k]);maxs[k]=Math.max(maxs[k],p[k]);
 }
 const edgeCounts=new Map();
 for(const [i,j,k] of faces){
  for(const [a,b] of [[i,j],[j,k],[k,i]]){
   const key=[quantize(points[a]),quantize(points[b])].sort().join('|');
   edgeCounts.set(key,(edgeCounts.get(key)||0)+1);
  }
 }
 let boundaryEdges=0,nonmanifoldEdges=0;
 for(const n of edgeCounts.values()){
  if(n===1)boundaryEdges++;
  else if(n>2)nonmanifoldEdges++;
 }
 const rayTests=[];
 // Blender-to-glTF world points (x,z,-y); directions +X and +Z(up).
 for(const [label,origin,direction] of [
  ['suctionHubFromX203',[203,22.2,-90],[1,0,0]],
  ['upwardDischargeFromZ22',[205,22,-90],[0,1,0]],
 ]){
  let min=Infinity,count=0;
  for(const [i,j,k] of faces){
   const d=rayTri(origin,direction,points[i],points[j],points[k]);
   if(d!==null&&d<10){count++;min=Math.min(d,min);}
  }
  const hit=Number.isFinite(min)?[origin[0]+min*direction[0],
   origin[1]+min*direction[1],origin[2]+min*direction[2]]:null;
  rayTests.push({label,triangleIntersections:count,
   nearestDistanceM:Number.isFinite(min)?min:null,
   nearestBlenderWorldM:hit?blender(hit):null});
 }
 selected[target]={nodeIndex:index,vertexCount:points.length,triangleCount:faces.length,
  edges:{boundary:boundaryEdges,nonmanifold:nonmanifoldEdges,
   watertightSurface:boundaryEdges===0&&nonmanifoldEdges===0},
  boundsBlenderWorldM:{min:blender(mins).map((v,i)=>Math.min(v,blender(maxs)[i])),
   max:blender(maxs).map((v,i)=>Math.max(v,blender(mins)[i]))},
  rayTests};
}
const gap=1.5139007568359375;
const hubHit=selected['SLURRY-PUMP-01_IMPELLER_HUB'].rayTests.find(r=>r.label==='suctionHubFromX203');
const dischargeHit=selected['SLURRY-PUMP-01_DISCHARGE_PIPE'].rayTests.find(r=>r.label==='upwardDischargeFromZ22');
const originalCapped=Number.isFinite(hubHit?.nearestDistanceM);
const dischargeBlocked=Number.isFinite(dischargeHit?.nearestDistanceM);
const qa={
 block:'L356',
 stage:'INDEPENDENT_READ_ONLY_SOURCE_GLTF_GEOMETRY',
 input:{sourceGlb:path.relative(process.cwd(),input).replaceAll('\\','/'),sha256:checksum,
  gltfNodes:nodes.length,gltfMeshes:meshes.length,tool:'node-js GLB positions ray/edge gate'},
 measured:selected,
 independentOldEvidence:{
  signedGapM:gap,suctionSkewDegrees:1.1573121503220216,
  eyeNotOpenSource:true,dischargeBlockedSource:true,
  priorSource:'L127/L346/L347 signed QA',
 },
 cannotAssertWetMateFromGlb:true,
 nativeBRepStepNeeded:true,
 originalCappedApproxRay:originalCapped,
 originalDischargeBlockedApproxRay:dischargeBlocked,
 passReadOnlySourceAudit:Object.keys(selected).length===targetNames.length &&
  checksum===expected&&originalCapped&&dischargeBlocked,
 wetDomainPass:false,
 isCertifiedHydraulicConnection:false,
 solverModified:false,productionModified:false,
 notes:[
  'Surface watertightness of individual meshes is NOT evidence of wet passage.',
  'World ray probes detect original visual blockers, not SW volume interference/Check2.',
  'Any hypothetical CAD connector requires independent native BRep and wet connected-domain gate.',
 ],
};
const out='qa-artifacts/L356_P3P4_READONLY_GLTF_TOPOLOGY_QA.json';
fs.writeFileSync(out,JSON.stringify(qa,null,2)+'\n');
console.log(JSON.stringify({out,pass:qa.passReadOnlySourceAudit,
 cappedApprox:qa.originalCappedApproxRay,
 dischargeBlockedApprox:qa.originalDischargeBlockedApproxRay,
 samples:Object.fromEntries(Object.entries(selected).map(([key,v])=>
  [key,{bounds:v.boundsBlenderWorldM,triangles:v.triangleCount,
   boundary:v.edges.boundary,manifold:v.edges.nonmanifold,
   rayHits:v.rayTests.map(r=>[r.label,r.nearestBlenderWorldM])}])),
},null,2));
if(!qa.passReadOnlySourceAudit)process.exitCode=1;
