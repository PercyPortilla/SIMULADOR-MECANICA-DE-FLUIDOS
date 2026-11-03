/* L393 portable Babylon 9.31.0 build preflight.
 * Generate genuine ES module re-export shims for deep imports in src/, then
 * prebundle their original classes and the real glTF loader using the locally
 * installed esbuild (transitive dependency of Vite). No CDN, fakes or edits to
 * solver, CAD, V57 or anything outside the .l393-generated folder.
 */
import {build as esbuildBuild} from 'esbuild';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const generated=path.join(root,'.l393-generated');
const shimDir=path.join(generated,'shims');
const vendorEntry=path.join(generated,'l393_vendor_entry.mjs');
const vendorFile=path.join(generated,'l393_babylon_vendor_bundle.mjs');
const aliasFile=path.join(generated,'l393_aliases.json');
const symbolPattern=/^[A-Za-z_$][A-Za-z0-9_$]*$/;

function* findSourceFiles(dir){
 for(const item of readdirSync(dir,{withFileTypes:true})){
  const filename=path.join(dir,item.name);
  if(item.isDirectory())yield* findSourceFiles(filename);
  else if(item.isFile()&&/\.(?:js|mjs|ts|tsx)$/.test(item.name))yield filename;
 }
}
function sha(buf){return createHash('sha256').update(buf).digest('hex');}

// Scan only hand-authored src/, not generated shims: this keeps prebuild
// repeatable and automatically tracks newly added genuine Babylon imports.
const all=new Map();
let imports=0,sourceFiles=0;
function info(spec){
 let entry=all.get(spec);
 if(!entry){entry={symbols:new Set(),sideEffect:false,dynamic:false};all.set(spec,entry);}
 return entry;
}
for(const filename of findSourceFiles(path.join(root,'src'))){
 sourceFiles++;
 const source=readFileSync(filename,'utf8');
 const spans=[];
 const patterns=[
  {kind:'named',re:/\bimport\s*\{([^}]+)\}\s*from\s*['"](@babylonjs\/[^'"]+)['"]/gs},
  {kind:'sideEffect',re:/\bimport\s*['"](@babylonjs\/[^'"]+)['"]/g},
  {kind:'dynamic',re:/\bimport\s*\(\s*['"](@babylonjs\/[^'"]+)['"]\s*\)/g}
 ];
 for(const {kind,re} of patterns){
  for(const match of source.matchAll(re)){
   spans.push([match.index,match.index+match[0].length]);
   const spec=kind==='named'?match[2]:match[1];
   const entry=info(spec);
   imports++;
   if(kind==='named'){
    for(const section of match[1].split(',')){
     const imported=section.trim().split(/\s+as\s+/)[0];
     if(!imported)continue;
     if(!symbolPattern.test(imported))throw Error('Unsupported Babylon export '+imported+' in '+filename);
     entry.symbols.add(imported);
    }
   } else if(kind==='sideEffect')entry.sideEffect=true;
   else entry.dynamic=true;
  }
 }
 // Fail loudly if a future source adds a namespace/default Babylon import:
 // never silently drop that functionality from a 'successful' bundle.
 for(const found of source.matchAll(/@babylonjs\//g)){
  if(!spans.some(([start,end])=>start<=found.index&&found.index<end))
   throw Error('Unsupported Babylon import syntax in '+filename+' at '+found.index);
 }
}
if(imports<170||all.size<32)throw Error('Unexpected missing Babylon imports: '+imports+'/'+all.size);
if(generated===root||generated===path.dirname(root))throw Error('Invalid generated folder');

rmSync(generated,{force:true,recursive:true});
mkdirSync(shimDir,{recursive:true});
const vendorLines=[
 '// L393: original Babylon deep exports, prebundled with genuine installed esbuild.',
 '// All original class identities and glTF loader side effects preserved.'
];
const aliases={};
let exportsTotal=0;
for(const [i,spec] of [...all.keys()].sort().entries()){
 const entry=all.get(spec);
 const id='L393_SPEC_'+String(i).padStart(2,'0');
 const shimName='shim_'+String(i).padStart(2,'0')+'.mjs';
 const shimPath=path.join(shimDir,shimName);
 const lines=['// Original source specifier: '+spec];
 for(const name of [...entry.symbols].sort()){
  const alias=id+'_'+name;
  vendorLines.push('export { '+name+' as '+alias+' } from '+JSON.stringify(spec)+';');
  lines.push('export { '+alias+' as '+name+' } from "../l393_babylon_vendor_bundle.mjs";');
  exportsTotal++;
 }
 if(entry.sideEffect||entry.dynamic){
  vendorLines.push('import '+JSON.stringify(spec)+';');
  lines.push('import "../l393_babylon_vendor_bundle.mjs";');
  lines.push('export const L393_GENUINE_LOADER_IMPORTED = true;');
 }
 writeFileSync(shimPath,lines.join('\n')+'\n','utf8');
 aliases[spec]={
  relative_shim:path.posix.join('.l393-generated','shims',shimName),
  exports:[...entry.symbols].sort(),
  side_effect:entry.sideEffect,dynamic:entry.dynamic
 };
}
writeFileSync(vendorEntry,vendorLines.join('\n')+'\n','utf8');
writeFileSync(aliasFile,JSON.stringify(aliases,null,2)+'\n','utf8');

const started=performance.now();
const result=await esbuildBuild({
 entryPoints:[vendorEntry],
 bundle:true,platform:'browser',format:'esm',target:'es2022',
 minify:true,legalComments:'none',metafile:true,write:true,
 outfile:vendorFile,logLevel:'warning'
});
const elapsed=+(performance.now()-started).toFixed(2);
const vendor=readFileSync(vendorFile);
writeFileSync(path.join(generated,'L393_VENDOR_QA.json'),
 JSON.stringify({
  result:'PASS_REAL_BABYLON_VENDOR_BUILT',
  source_files_scanned:sourceFiles,
  original_import_count:imports,
  unique_deep_imports:all.size,
  exported_real_symbols:exportsTotal,
  vendor_bytes:vendor.byteLength,
  vendor_sha256:sha(vendor),
  esbuild_elapsed_ms:elapsed,
  esbuild_metafile_input_count:Object.keys(result.metafile.inputs).length,
  original_source_B64_or_solver_modified:false
 },null,2)+'\n','utf8');
console.log('[L393_VENDOR] PASS imports='+imports+' deep_paths='+all.size+
 ' symbols='+exportsTotal+' source_files='+sourceFiles+
 ' vendor_bytes='+vendor.byteLength+' esbuild_ms='+elapsed+
 ' SHA256='+sha(vendor));
