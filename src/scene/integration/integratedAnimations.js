import * as THREE from 'three';

const LOD_UPDATE_INTERVAL_SECONDS = 0.125;

export function createIntegratedAnimations({ equipmentSystem, mobileEquipment, pipingSystem } = {}) {
  if (!equipmentSystem || !mobileEquipment) throw new TypeError('Integrated animations requiere equipmentSystem y mobileEquipment.');
  let enabled = true;
  let elapsed = 0;
  let lodElapsed = LOD_UPDATE_INTERVAL_SECONDS;
  let processFlowScale = 1;
  const flowMaterials = new Set();
  const flowParticles = new Set();
  const particleScratch = new THREE.Vector3();
  const particleTangentScratch = new THREE.Vector3();
  const particleNormalScratch = new THREE.Vector3();
  const particleBinormalScratch = new THREE.Vector3();
  const particleReferenceScratch = new THREE.Vector3();
  function collectRoutes() {
    flowMaterials.clear();
    flowParticles.clear();
    pipingSystem?.root?.traverse?.((object) => {
      if (object.material?.userData?.pipeFluidMaterial) flowMaterials.add(object.material);
      if (object.isPoints && object.userData?.pipeParticleFlow) flowParticles.add(object);
    });
  }
  collectRoutes();

  function update(dt, camera) {
    if (!enabled || !Number.isFinite(dt) || dt <= 0) return;
    const safeDt = Math.min(dt, 0.1);
    elapsed += safeDt;
    equipmentSystem.updateAssets(safeDt);
    mobileEquipment.update(safeDt);
    lodElapsed += safeDt;
    if (camera && lodElapsed >= LOD_UPDATE_INTERVAL_SECONDS) {
      equipmentSystem.updateLOD(camera);
      lodElapsed = 0;
    }
    if (processFlowScale > 0) {
      flowMaterials.forEach((material) => {
        if (material.map) material.map.offset.y = (material.map.offset.y - safeDt * 0.62 * processFlowScale) % 1;
      });
      flowParticles.forEach((points) => {
        const curve = points.userData.flowCurve;
        const progress = points.userData.flowProgress;
        const radialDistance = points.userData.flowRadialDistance;
        const radialAngle = points.userData.flowRadialAngle;
        const speed = Number(points.userData.flowSpeed || 0.04) * processFlowScale;
        const attribute = points.geometry?.attributes?.position;
        if (!curve || !progress || !attribute) return;
        for (let index = 0; index < progress.length; index += 1) {
          progress[index] = (progress[index] + safeDt * speed) % 1;
          curve.getPointAt(progress[index], particleScratch);
          if (radialDistance && radialAngle) {
            curve.getTangentAt(progress[index], particleTangentScratch).normalize();
            particleReferenceScratch.set(0, 1, 0);
            if (Math.abs(particleTangentScratch.dot(particleReferenceScratch)) > 0.92) {
              particleReferenceScratch.set(1, 0, 0);
            }
            particleNormalScratch.crossVectors(particleTangentScratch, particleReferenceScratch).normalize();
            particleBinormalScratch.crossVectors(particleTangentScratch, particleNormalScratch).normalize();
            const offset = radialDistance[index];
            const angle = radialAngle[index];
            particleScratch.addScaledVector(particleNormalScratch, Math.cos(angle) * offset);
            particleScratch.addScaledVector(particleBinormalScratch, Math.sin(angle) * offset);
          }
          attribute.setXYZ(index, particleScratch.x, particleScratch.y, particleScratch.z);
        }
        attribute.needsUpdate = true;
      });
    }
    if (pipingSystem?.root) pipingSystem.root.userData.elapsedSeconds = elapsed;
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    equipmentSystem.setAnimationsEnabled(enabled);
    mobileEquipment.setEnabled(enabled);
  }

  function setProcessMetrics({ flowRateM3s = 0, pressurePa = 0 } = {}) {
    const normalizedFlow = Number.isFinite(flowRateM3s) && flowRateM3s > 0 ? flowRateM3s : 0;
    processFlowScale = normalizedFlow === 0
      ? 0
      : THREE.MathUtils.clamp(normalizedFlow / 0.03, 0.25, 3);
    if (pipingSystem?.root) {
      pipingSystem.root.userData.processFlowRateM3s = normalizedFlow;
      pipingSystem.root.userData.processPressurePa = Number.isFinite(pressurePa) ? pressurePa : 0;
      pipingSystem.root.userData.visualFlowScale = processFlowScale;
    }
    const pump = equipmentSystem.registry?.get?.('PUMP-01') ?? equipmentSystem.getEquipment?.('PUMP-01');
    const pumpRoot = pump?.group3D ?? pump?.root;
    if (pumpRoot) {
      pumpRoot.userData.operationalState = normalizedFlow > 0 ? 'operating' : 'standby';
      pumpRoot.userData.processFlowRateM3s = normalizedFlow;
      pumpRoot.userData.requiredPressurePa = Number.isFinite(pressurePa) ? pressurePa : 0;
    }
  }

  return {
    update,
    setEnabled,
    setProcessMetrics,
    refreshRoutes() { collectRoutes(); },
    dispose() {},
    get enabled() { return enabled; },
    get elapsedSeconds() { return elapsed; },
    get pipeMarkerCount() { return flowParticles.size; },
    get conveyorMarkerCount() { return equipmentSystem.conveyors?.length ?? 0; },
    get beltFlowCount() { return equipmentSystem.conveyors?.length ?? 0; },
    get mineralSystemCount() { return equipmentSystem.conveyors?.length ?? 0; },
    get visualFlowScale() { return processFlowScale; },
    get lodUpdateIntervalSeconds() { return LOD_UPDATE_INTERVAL_SECONDS; },
  };
}
