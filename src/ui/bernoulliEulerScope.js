/**
 * Reversible visibility-only study scope for the Bernoulli–Euler view.
 * It NEVER edits the signed V57 GLB, solver, mesh geometry, poses or animations.
 * The main mine continues to exist in the same Babylon scene.
 */
export function createBernoulliEulerScope(environment) {
  const scene = environment?.scene;
  if (!scene) throw new Error('BERNOULLI_SCOPE_NEEDS_REAL_V57_SCENE');
  const originalVisibility = new Map();
  let active = false;
  let selectedCount = 0;
  let hiddenCount = 0;

  // Only four units and their connecting slurry feed belong to the
  // university exercise. Reject the output from cyclones to leaching.
  const keep = (name) => {
    if (/^MILL-01(?:_|$)|^SUMP-01(?:_|$)|^SLURRY-PUMP-01(?:_|$)/i.test(name)) return true;
    if (/^CLASS-01_/i.test(name))
      return !/^CLASS-01_(?:OVERFLOW_TO_LEACH|RETURN_TO_LEACH|LEACH)/i.test(name);
    if (/^L349_CLASS|^CLASS-01_FEED_LINE_.*_NATIVE_L349|^L352_CLASS01_/i.test(name)) return true;
    return false;
  };
  const reapply = () => {
    if (!active) return;
    for (const mesh of scene.meshes) {
      if (originalVisibility.has(mesh)) continue;
      originalVisibility.set(mesh, mesh.isVisible);
    }
    selectedCount = 0;
    hiddenCount = 0;
    for (const [mesh, original] of originalVisibility) {
      if (mesh.isDisposed?.()) continue;
      const relevant = keep(mesh.name || '');
      if (relevant) {
        // Keep source state: hidden old elbow/proxy stays hidden!
        mesh.isVisible = original;
        selectedCount++;
      } else {
        mesh.isVisible = false;
        hiddenCount++;
      }
    }
    environment.invalidateRender?.(240);
  };
  const leave = () => {
    if (!active) return;
    active = false;
    for (const [mesh, visible] of originalVisibility)
      if (!mesh.isDisposed?.()) mesh.isVisible = visible;
    originalVisibility.clear();
    environment.invalidateRender?.(240);
  };
  function focus(view='all') {
    if (!active) return false;
    const camera = environment.cameras?.inspection;
    if (!camera) return false;
    const key = {
      all: ['MILL-01_', 'SUMP-01_', 'SLURRY-PUMP-01_', 'CLASS-01_'],
      mill: ['MILL-01_', 'SUMP-01_INLET'],
      sump: ['SUMP-01_', 'SLURRY-PUMP-01_'],
      pump: ['SLURRY-PUMP-01_', 'SUMP-01_SUCTION', 'CLASS-01_FEED_LINE_SEG01'],
      cyclones: ['CLASS-01_CYCLONE_', 'CLASS-01_FEED_DISTRIBUTOR', 'L352_CLASS01_'],
      bends: ['CLASS-01_FEED_LINE_ELBOW_', 'CLASS-01_FEED_LINE_SEG'],
      header: ['L352_CLASS01_'],
    }[view] ?? ['SUMP-01_'];
    const targetMeshes = scene.meshes.filter(m => m.isVisible && key.some(p=>m.name.startsWith(p)) &&
      m.getTotalVertices?.()>0);
    if (!targetMeshes.length) return false;
    let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for (const m of targetMeshes) {
      m.computeWorldMatrix(true);
      const box=m.getBoundingInfo().boundingBox;
      for (let i=0;i<3;i++){
        min[i]=Math.min(min[i],box.minimumWorld.asArray()[i]);
        max[i]=Math.max(max[i],box.maximumWorld.asArray()[i]);
      }
    }
    const center=min.map((x,i)=>(x+max[i])/2);
    // Offset the all-in-one view slightly toward the cyclone end so every
    // studied component fits between the foldable left/right control panels.
    if(view==='all')center[0]+=5;
    const span=Math.hypot(...min.map((x,i)=>max[i]-x));
    environment.setCamera('inspection');
    const target=camera.target?.clone?.() ?? camera.getTarget().clone();
    target.set(...center);
    camera.setTarget(target);
    camera.alpha=view==='all' ? 1.02 : 1.13;
    camera.beta=1.04;
    // Tight framing of the four studied units, not the whole mine.
    camera.radius=Math.max(view==='all'?62:6, span*(view==='all'?.85:1.5));
    environment.equipmentInspection?.contextOverlay?.setEnabled?.(false);
    environment.invalidateRender?.(240);
    return true;
  }
  return {
    enter(){active=true;reapply();return focus('all');},
    reapply,
    leave,
    focus,
    get status(){return {active,selectedCount,hiddenCount,
      model:'V57 original, reversible visibility filter',
      scope:'MILL-01 -> SUMP-01 -> SLURRY-PUMP-01 -> CLASS-01',
      sourceMeshModified:false,solverModified:false,
      nativeDataPreserved:true};},
  };
}
