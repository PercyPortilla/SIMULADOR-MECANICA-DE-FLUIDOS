from pathlib import Path
p=Path('outputs/browser_validate.py')
s=p.read_text(encoding='utf-8')
start=s.index("    expression=r'''")
end=s.index("'''", start+20)+3
expr="""    expression=r'''(async()=>{
      const result={};
      const sceneError=document.querySelector('#scene-error');
      result.app={title:document.title,canvas:Boolean(document.querySelector('#environment-canvas')),canvasWidth:document.querySelector('#environment-canvas')?.width||0,canvasHeight:document.querySelector('#environment-canvas')?.height||0,sceneErrorHidden:sceneError?.hidden===true,sceneErrorText:sceneError?.textContent||'',pumpOption:[...document.querySelectorAll('#inspection-target option')].some(o=>o.value==='PUMP-01')};
      const {createBaseScene}=await import('/src/scene/baseEnvironment.js');
      const {getTerrainHeight}=await import('/src/scene/environment/terrainHeight.js');
      const b=createBaseScene();
      const truck=b.mobileEquipment.truck.root; const before=truck.position.clone();
      for(let i=0;i<120;i++) b.mobileEquipment.update(0.1);
      result.truck={distance:truck.position.distanceTo(before),x:truck.position.x,y:truck.position.y,z:truck.position.z,terrainDelta:truck.position.y-getTerrainHeight(truck.position.x,truck.position.z)};
      const cv=b.equipmentSystem.getEquipment('CV-01-FEEDER-TO-CRUSHER').group3D;
      const ore=cv.getObjectByName('conveyor-ore-0'); const oreBefore=ore.position.x;
      b.industrialAnimations.update(0.1);
      result.conveyors={cv01:Boolean(cv),cv02:Boolean(b.equipmentSystem.getEquipment('CV-02-CRUSHER-TO-STOCKPILE')),cv03:Boolean(b.equipmentSystem.getEquipment('CV-03-STOCKPILE-TO-GRINDING')),oreMoved:ore.position.x!==oreBefore};
      const targets=b.equipmentInspection.getTargets().map(x=>x.id);
      b.equipmentInspection.setTarget('PUMP-01'); b.equipmentInspection.setMode('cutaway');
      const pump=b.equipmentSystem.getEquipment('PUMP-01').group3D; const volute=pump.getObjectByName('pump-volute'); const impeller=pump.getObjectByName('pump-impeller'); const mats=Array.isArray(volute.material)?volute.material:[volute.material];
      result.inspection={pumpIndexed:targets.includes('PUMP-01'),impellerVisible:impeller.visible,clippingPlanes:mats[0].clippingPlanes?.length||0,pipeIndexed:targets.includes('P-PUMP-01-TO-CIP')};
      const ids=['P-LEACHING-TO-PUMP-01','P-PUMP-01-TO-CIP','P-ELUTION-TO-EW']; const pipes=ids.map(id=>b.integratedPiping.engine.getConnectionGroup(id)); let rackCount=0; b.processPipeRacks.traverse(o=>{if(o.name?.startsWith('recovery-rack-'))rackCount++;});
      result.recovery={pipesPresent:pipes.every(Boolean),rackCount,leachPumpReducer:Boolean(pipes[0]?.getObjectByName('P-LEACHING-TO-PUMP-01-target-reducer')),pumpCipReducer:Boolean(pipes[1]?.getObjectByName('P-PUMP-01-TO-CIP-source-reducer')),finiteRoutes:pipes.every(g=>g.userData.routePoints.flat().every(Number.isFinite))};
      result.scene={fogIsNull:b.scene.fog===null,truckPresent:Boolean(b.scene.getObjectByName('TRUCK-01')),pumpPresent:Boolean(b.scene.getObjectByName('PUMP-01')),recoveryPresent:Boolean(b.scene.getObjectByName('CIP-ADSORPTION'))};
      return result;
    })()'''"""
p.write_text(s[:start]+expr+s[end:],encoding='utf-8')
