/* Isolated V57 full-mine presentation controls. All numeric outputs are from
 * the EXISTING V57 controller, never from invented gauges or laboratory proxies. */
import {createV57FaultEffects} from './industrialV57FaultEffects.js';
import {createBernoulliEulerScope} from './bernoulliEulerScope.js';
export function mountIndustrialV57Presentation({
 document:doc,getState,getResults,updateState,resetState,cameras,labels
}){
 const viewport=doc.querySelector('.scene-viewport');
 if(!viewport)throw Error('V57_SCENE_VIEWPORT_REQUIRED');
 doc.body.classList.remove('v57-industrial');
 const header=doc.querySelector('.topbar');
 const eyebrow=header.querySelector('.eyebrow');
 const heading=header.querySelector('h1');
 const release=header.querySelector('.release-tag');
 const originalHeading={eyebrow:eyebrow.textContent,title:heading.innerHTML,release:release.textContent};
 const enterLabButton=doc.createElement('button');
 enterLabButton.id='v57EnterEulerLab';
 enterLabButton.className='v57-lab-entry';
 enterLabButton.textContent='Laboratorio Bernoulli–Euler';
 header.append(enterLabButton);
 const top=document.createElement('div');top.className='v57-top-actions';
 top.innerHTML='<button id="v57ExitEulerLab">← Mina completa</button><label>Tramo estudiado <select id="v57View"></select></label><button id="v57GoParameters">Parámetros</button><button id="v57GoResults">Resultados</button><button id="v57Help">?</button><button id="v57Fullscreen">⛶</button>';
 header.append(top);
 for(const [value,title] of [
  ['all','Circuito Bernoulli–Euler'],
  ['mill','Molino → SUMP'],
  ['sump','SUMP · Pulpa y nivel'],
  ['pump','Succión → bomba → descarga'],
  ['cyclones','Ocho ciclones'],
  ['bends','Codos de alimentación · L349'],
  ['header','Colector perforado · L352']]){
  const option=doc.createElement('option');option.value=value;option.textContent=title;
  top.querySelector('#v57View').append(option);
 }
 top.querySelector('#v57View').addEventListener('change',e=>{
  if(!labActive)return;
  const value=e.target.value;
  setMode(value==='all'?'realista':'transparencia');
  scope?.focus(value);
  cleanInspectionBoxes();
 });
 const left=doc.createElement('aside');left.className='v57-side v57-side-left';
 left.innerHTML='<div class="v57-side-title"><b>⚙ Opciones</b><button id="v57HideOptions">×</button></div>'+
 '<h3>Modo de vista</h3><div class="v57-modes"><button id="v57Realista" class="selected">▣<b>Realista</b><small>Maquinaria opaca</small></button><button id="v57Transparencia">⬡<b>Transparencia</b><small>Inspección del equipo</small></button></div>'+
 '<h3>Ayudas visuales</h3><div class="v57-help-list">'+
 '<label><input type="checkbox" id="v57GuideFlow" checked>➜ Ruta del proceso (guía 2D)</label>'+
 '<label><input type="checkbox" id="v57GuideLabels" checked>⌖ Cotas y etiquetas del visor</label>'+
 '<label><input type="checkbox" id="v57GuideAnimation" checked>⁙ Animaciones V57</label>'+
 '<label><input type="checkbox" id="v57GuideCav" checked>◌ Burbujas de cavitación (didáctico)</label>'+
 '<label><input type="checkbox" id="v57GuideSettling" checked>≋ Sedimentación visual (didáctico)</label></div>'+
 '<button id="v57Advanced">⚙ Panel avanzado ▾</button>'+
 '<p class="v57-small-note">Solo tramo estudiado: molino → SUMP → bomba → ciclones. Animaciones didácticas, NO CFD ni sensores.</p>';
 viewport.append(left);
 const leftReopen=doc.createElement('button');leftReopen.className='v57-reopen v57-reopen-left';
 leftReopen.id='v57ReopenOptions';leftReopen.textContent='⚙ Opciones';leftReopen.hidden=true;viewport.append(leftReopen);
 const right=doc.createElement('aside');right.className='v57-side v57-side-right';
 right.innerHTML='<div class="v57-side-title"><b>◉ Indicadores del sistema</b><button id="v57HideIndicators">−</button></div>'+
 '<div class="v57-gauge"><span>◉</span><div>Caudal calculado<small>Q del modelo activo</small></div><strong id="v57Flow">N/D</strong></div>'+
 '<div class="v57-gauge"><span>◴</span><div>ΔP total<small>Pérdida/carga calculada</small></div><strong id="v57Pressure">N/D</strong></div>'+
 '<div class="v57-gauge"><span>ϟ</span><div>Potencia calculada<small>No es sensor de kW</small></div><strong id="v57Power">N/D</strong></div>'+
 '<div class="v57-gauge" id="v57CavRow"><span>◌</span><div>NPSH disponible<small>Evaluación del escenario</small></div><strong id="v57Npsh">N/D</strong></div>'+
 '<div class="v57-gauge" id="v57SettlingRow"><span>≋</span><div>Sedimentación<small>Dominio de Durand, si aplica</small></div><strong id="v57Sediment">N/D</strong></div>'+
 '<p class="v57-small-note">Resultados numéricos del solver V57 cuando son aplicables. Sin sensores físicos.</p>';
 const fxStatus=doc.createElement('div');
 fxStatus.className='v57-small-note';fxStatus.id='v57FxStatus';
 fxStatus.textContent='Efectos visuales didácticos: sin riesgo alto en el escenario de referencia.';
 right.append(fxStatus);
 const nativeStatus=doc.createElement('p');nativeStatus.className='v57-small-note';
 nativeStatus.id='v57NativeStatus';
 nativeStatus.textContent='Codos CLASS-01: comprobando geometría CAD firmada…';
 right.append(nativeStatus);
 const headerStatus=doc.createElement('p');headerStatus.className='v57-small-note';
 headerStatus.id='v57HeaderStatus';
 headerStatus.textContent='Colector de ocho ciclones: comprobando perforaciones CAD…';
 right.append(headerStatus);
 viewport.append(right);
 const rightReopen=doc.createElement('button');rightReopen.id='v57ReopenIndicators';
 rightReopen.className='v57-reopen v57-reopen-right';rightReopen.textContent='◉ Indicadores';rightReopen.hidden=true;viewport.append(rightReopen);
 const ribbon=doc.createElement('div');ribbon.id='v57ProcessRibbon';ribbon.className='v57-process-ribbon';
 ribbon.textContent='LABORATORIO BERNOULLI–EULER  ·  MOLINO → SUMP → BOMBA → 8 CICLONES';
 viewport.append(ribbon);
 const scenarioCard=doc.createElement('section');
 scenarioCard.id='v57ScenarioExplanation';scenarioCard.className='v57-scenario-explanation';
 scenarioCard.hidden=true;
 scenarioCard.innerHTML='<div><span>ENSAYO DIDÁCTICO · SIN SENSORES</span><button id="v57CloseScenarioHelp" aria-label="Ocultar explicación">×</button></div>'+
  '<strong id="v57ScenarioTitle"></strong><p id="v57ScenarioInputs"></p>'+
  '<p id="v57ScenarioEffect"></p><small>Los índices de animación no son predicciones CFD ni pruebas de uniones CAD.</small>';
 viewport.append(scenarioCard);
 const dock=doc.createElement('section');dock.className='v57-dock';dock.id='v57ControlDock';
 dock.innerHTML='<div class="v57-dock-header"><strong>TRAMO DE PULPA · BERNOULLI–EULER</strong>'+
 '<label>Escenario <select id="v57Scenario"><option value="current">Actual</option><option value="normal">Referencia</option><option value="headloss">Pérdidas mayores</option><option value="suction">Succión desfavorable</option><option value="energy">Demanda elevada</option><option value="settle">Tendencia a sedimentar</option></select></label>'+
 '<button id="v57TransportToggle">Transporte ON</button><button id="v57Reset">↺ Restablecer</button><button id="v57HideDock">Ocultar −</button></div>'+
 '<div class="v57-control-body"><label>Velocidad de pulpa <b id="v57VelocityValue"></b><input id="v57Velocity" type="range" min="0" max="4" step=".05"></label>'+
 '<label>Sólidos (% masa) <b id="v57SolidsValue"></b><input id="v57Solids" type="range" min="0" max="80" step="1"></label>'+
 '<label>Viscosidad Newtoniana <b id="v57MuValue"></b><input id="v57Mu" type="range" min=".005" max=".2" step=".005"></label>'+
 '<label>d50 (descriptivo) <b id="v57D50Value"></b><input id="v57D50" type="range" min="0" max="3" step=".05"></label>'+
 '<div class="v57-dock-help" id="v57Cause">Mover un parámetro actualiza el solver V57 cuando el modelo admite el cambio.</div></div>';
 viewport.append(dock);
 const dockReopen=doc.createElement('button');dockReopen.className='v57-reopen v57-reopen-dock';
 dockReopen.id='v57ReopenDock';dockReopen.textContent='Control del circuito';dockReopen.hidden=true;viewport.append(dockReopen);
 const help=doc.createElement('section');help.id='v57Helper';help.className='v57-helper';help.hidden=true;
 help.textContent='Opciones controlan herramientas existentes de V57. Los indicadores no son sensores; si un cálculo no es aplicable se muestra N/D. La transparencia depende del equipo seleccionado.';
 viewport.append(help);
 let env=null,scope=null,labActive=false,playing=true,previousVelocity=null,mode='realista',faultFx=null;
 let generalViewPreferences=null;
 let labReady=false;
 enterLabButton.disabled=true;
 enterLabButton.title='Preparando escena V57 y geometría del tramo de pulpa';
 function setLabActive(on){
  if(on===labActive)return true;
  if(on&&!labReady)return false;
  labActive=Boolean(on);
  doc.body.classList.toggle('v57-industrial',labActive);
  doc.body.classList.remove('v57-show-advanced','v57-show-results');
  enterLabButton.hidden=labActive;
  if(labActive){
   generalViewPreferences={
     labels:el('labels-toggle').checked,
     animations:el('animations-toggle').checked,
   };
   el('v57GuideLabels').checked=generalViewPreferences.labels;
   el('v57GuideAnimation').checked=generalViewPreferences.animations;
   eyebrow.textContent='MECÁNICA DE FLUIDOS · LABORATORIO';
   heading.innerHTML='PULPA <span>LAB</span> · BERNOULLI–EULER';
   release.textContent='MOLINO → SUMP → BOMBA → 8 CICLONES';
   scope ??= createBernoulliEulerScope(env);
   scope.enter();
   top.querySelector('#v57View').value='all';
   setMode('realista');
   scope.focus('all');
   faultFx?.setPlaying(el('v57GuideAnimation').checked);
  }else{
   faultFx?.setPlaying(false);
   env?.setInspectionMode('normal');
   scope?.leave();
   env?.setCamera('general');
   // Laboratory visual preferences do not leak into the mine's original UI.
   for(const [id,key] of [['labels-toggle','labels'],['animations-toggle','animations']]){
     const input=el(id);
     if(generalViewPreferences&&input.checked!==generalViewPreferences[key]){
       input.checked=generalViewPreferences[key];
       input.dispatchEvent(new Event('change'));
     }
   }
   generalViewPreferences=null;
   eyebrow.textContent=originalHeading.eyebrow;
   heading.innerHTML=originalHeading.title;
   release.textContent=originalHeading.release;
   scenarioCard.hidden=true;
   help.hidden=true;
  }
  env?.resize?.();
  doc.defaultView.requestAnimationFrame?.(()=>env?.resize?.());
  return true;
 }
 enterLabButton.addEventListener('click',()=>setLabActive(true));
 top.querySelector('#v57ExitEulerLab').addEventListener('click',()=>setLabActive(false));
 let headerCloseupReady=false;
 function focusNativeHeader(){
  headerCloseupReady=false;
  const source=env?.scene?.getMeshByName('L352_CLASS01_8_TRUE_ANGLED_SIDE_HOLES_EDU_NOT_CERTIFIED');
  const camera=env?.cameras?.inspection;
  if(!source||!camera){
   el('v57HeaderStatus').textContent='Colector: pieza CAD no cargada; manteniendo vista original.';
   return false;
  }
  // Actual L350 signed CAD geometry is the camera target, rather than the
  // much larger aggregate PUMP->CYCLONES inspection line bounding box.
  setMode('realista');
  const targetId='P-PUMP-TO-CYCLONES';
  const item=env.getInspectionTargets?.().find(t=>t.id===targetId);
  if(item)env.setInspectionTarget(item.id);
  env.setCamera('inspection');
  env.setInspectionMode('normal');
  source.computeWorldMatrix(true);
  const bounds=source.getBoundingInfo().boundingBox;
  const size=bounds.maximumWorld.subtract(bounds.minimumWorld);
  camera.setTarget(bounds.centerWorld.clone());
  camera.alpha=1.12;
  camera.beta=1.08;
  camera.radius=Math.max(5.3,size.length()*2.0);
  env.invalidateRender?.(240);
  cleanInspectionBoxes();
  headerCloseupReady=true;
  el('v57HeaderStatus').textContent='Colector CLASS-01: 8 aberturas CAD alineadas · modelo educativo, uniones externas aún no certificadas.';
  return true;
 }
 // The V57 technical inspector draws giant cyan/yellow wireframe bounding
 // boxes. They are useful for engineering debugging but obstruct the actual
 // CAD elbows during a user-facing presentation. Suppress only in this UI.
 function cleanInspectionBoxes(){
  env?.equipmentInspection?.contextOverlay?.setEnabled?.(false);
 }
 const el=id=>doc.getElementById(id);
 const showOptions=on=>{left.hidden=!on;leftReopen.hidden=on};
 const showIndicators=on=>{right.hidden=!on;rightReopen.hidden=on};
 el('v57HideOptions').onclick=()=>showOptions(false);
 el('v57ReopenOptions').onclick=()=>showOptions(true);
 el('v57HideIndicators').onclick=()=>showIndicators(false);
 el('v57ReopenIndicators').onclick=()=>showIndicators(true);
 el('v57Advanced').onclick=()=>doc.body.classList.toggle('v57-show-advanced');
 el('v57GoParameters').onclick=()=>doc.body.classList.toggle('v57-show-advanced');
 el('v57GoResults').onclick=()=>doc.body.classList.toggle('v57-show-results');
 el('v57Help').onclick=()=>{help.hidden=!help.hidden};
 el('v57CloseScenarioHelp').onclick=()=>{scenarioCard.hidden=true;};
 el('v57Fullscreen').onclick=()=>doc.fullscreenElement?doc.exitFullscreen?.():doc.documentElement.requestFullscreen?.();
 const gaugeDetails={
  v57Flow:()=>['CAUDAL Q DEL CIRCUITO',
   'Entradas: velocidad media y diámetro interior hidráulico',
   'Modelo: continuidad Q=V·A. Cambia la velocidad inferior para ver cómo se actualiza Q.'],
  v57Pressure:()=>['PÉRDIDA DE CARGA / ΔP',
   'Entradas: viscosidad/reología, velocidad, diámetro, longitud, rugosidad y K',
   'Resultado del solver, que incluye componentes distribuidas, accesorios y elevación cuando el modelo es aplicable.'],
  v57Power:()=>['DEMANDA DE POTENCIA CALCULADA',
   'Entradas: Q, ΔP, eficiencia de bomba y motor',
   'Potencia eléctrica calculada en kW para el escenario; no es un amperímetro ni un sensor de campo.'],
  v57Npsh:()=>['SUCCIÓN Y MARGEN NPSH',
   'Entradas: presión absoluta, presión de vapor, elevación, pérdidas de succión',
   'NPSH-A sin NPSH-R del fabricante NO confirma cavitación. Las burbujas son educativas.'],
  v57Sediment:()=>{
   const s=getResults().transport?.settling;
   return ['TENDENCIA A SEDIMENTACIÓN',
    s?'Durand legado orientativo · V crítica '+asNumber(s.criticalVelocityMps)+' m/s · V/Vcrítica '+asNumber(s.velocityRatio,3):
      'Faltan datos para evaluar el criterio orientativo de Durand',
    'Resultado no calibrado; d50/d80 registrados no alimentan esta correlación. La animación solo ilustra una posible acumulación.'];
  }
 };
 for(const [id,details] of Object.entries(gaugeDetails)){
  const row=el(id).closest('.v57-gauge');
  row.tabIndex=0;row.setAttribute('role','button');row.title='Seleccionar para ver causas y límites del indicador';
  const show=()=>{
   const [title,inputs,effect]=details();
   el('v57ScenarioTitle').textContent=title;
   el('v57ScenarioInputs').textContent=inputs;
   el('v57ScenarioEffect').textContent=effect;
   scenarioCard.hidden=false;
  };
  row.addEventListener('click',show);
  row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});
 }
 el('v57HideDock').onclick=()=>{dock.classList.add('minimized');dockReopen.hidden=false};
 dockReopen.onclick=()=>{dock.classList.remove('minimized');dockReopen.hidden=true};
 el('v57Realista').onclick=()=>setMode('realista');
 el('v57Transparencia').onclick=()=>setMode('transparencia');
 function setMode(next){
  mode=next;
  el('v57Realista').classList.toggle('selected',next==='realista');
  el('v57Transparencia').classList.toggle('selected',next==='transparencia');
  if(!env)return;
  faultFx?.setMode(next);
  if(next==='transparencia'){
   // Inspection of a REAL V57 node, not a fabricated whole-plant X-ray.
   const targets=env.getInspectionTargets?.()??[];
   const pump=targets.find(t=>t.id==='SLURRY-PUMP-01')||
      targets.find(t=>/SLURRY.PUMP|PUMP|BOMBA/i.test(t.id+' '+t.label));
   if(pump){env.setInspectionTarget(pump.id);env.setCamera('inspection');}
   env.setInspectionMode('transparent');
  }else env.setInspectionMode('normal');
  cleanInspectionBoxes();
 }
 el('v57GuideFlow').onchange=()=>{ribbon.hidden=!el('v57GuideFlow').checked};
 el('v57GuideLabels').onchange=()=>{
  el('labels-toggle').checked=el('v57GuideLabels').checked;
  el('labels-toggle').dispatchEvent(new Event('change'));
 };
 el('v57GuideAnimation').onchange=()=>{
  el('animations-toggle').checked=el('v57GuideAnimation').checked;
  el('animations-toggle').dispatchEvent(new Event('change'));
  faultFx?.setPlaying(el('v57GuideAnimation').checked);
 };
 el('v57GuideCav').onchange=()=>{faultFx?.setCavitationVisible(el('v57GuideCav').checked)};
 el('v57GuideSettling').onchange=()=>{faultFx?.setSedimentationVisible(el('v57GuideSettling').checked)};
 const asNumber=(x,d=2)=>Number.isFinite(x)?x.toFixed(d):'N/D';
 const setCause=value=>{el('v57Cause').textContent=value};
 const patch=(field,val)=>{
  try{updateState(field(val));el('v57Scenario').value='current';refresh()}
  catch(e){setCause('No se pudo aplicar: '+e.message)}
 };
 el('v57Velocity').oninput=e=>{
  const v=Number(e.target.value);patch(v=>({transport:{pipe1:{velocityMps:v}}}),v);
  const source=el('field-transport-pipe1-velocityMps');if(source)source.value=String(v);
  setCause('Velocidad ↑ altera Q = V·A; el solver calcula pérdidas y potencia si el modelo aplica.');
 };
 el('v57Solids').oninput=e=>{
  const v=Number(e.target.value);
  patch(value=>({slurry:{solidsMassFraction:value/100}}),v);
  const source=el('field-slurry-solidsMassFraction');if(source)source.value=String(v);
  setCause('Sólidos porcentuales en MASA: modifican densidad y evaluaciones del modelo activo.');
 };
 el('v57Mu').oninput=e=>{
  if(getState().rheology.model!=='newtonian')return;
  const v=Number(e.target.value);
  patch(value=>({rheology:{newtonianViscosityPaS:value}}),v);
  const source=el('field-rheology-newtonianViscosityPaS');if(source)source.value=String(v);
  setCause('Viscosidad Newtoniana afecta Re y la resistencia, no una animación CFD.');
 };
 el('v57D50').oninput=e=>{
  const v=Number(e.target.value);
  patch(value=>({slurry:{d50M:value/1000}}),v);
  const source=el('field-slurry-d50M');if(source)source.value=String(v);
  setCause('d50 es descriptivo; NO alimenta la correlación histórica de sedimentación Durand.');
 };
 el('v57TransportToggle').onclick=()=>{
  if(playing){previousVelocity=getState().transport.pipe1.velocityMps;
   updateState({transport:{pipe1:{velocityMps:0}}});env?.setAnimationsEnabled(false);playing=false;}
  else{updateState({transport:{pipe1:{velocityMps:previousVelocity??1}}});
   env?.setAnimationsEnabled(true);playing=true;}
  el('v57TransportToggle').textContent=playing?'Transporte ON':'Ensayo transporte OFF';
  setCause('Ensayo pedagógico: OFF impone velocidad=0 al escenario y detiene animaciones. No es una señal PLC de bomba.');
  refresh();
 };
 el('v57Scenario').onchange=e=>{
  const v=e.target.value;
  if(v==='current'){scenarioCard.hidden=true;return;}
  // A complete, deterministic input preset. Switching from one fault to
  // another must not silently retain a previous fault's K/NPSH condition.
  const baseline={transport:{pipe1:{velocityMps:1.2,minorLossCoefficient:1}},
    energy:{suctionHeadLossM:2},slurry:{solidsMassFraction:.30}};
  const presets={
   normal:baseline,
   headloss:{transport:{pipe1:{velocityMps:1.6,minorLossCoefficient:30}},
    energy:{suctionHeadLossM:2},slurry:{solidsMassFraction:.30}},
   suction:{transport:{pipe1:{velocityMps:1.2,minorLossCoefficient:1}},
    energy:{suctionHeadLossM:9},slurry:{solidsMassFraction:.30}},
   energy:{transport:{pipe1:{velocityMps:3.2,minorLossCoefficient:1}},
    energy:{suctionHeadLossM:2},slurry:{solidsMassFraction:.5}},
   settle:{transport:{pipe1:{velocityMps:.25,minorLossCoefficient:1}},
    energy:{suctionHeadLossM:2},slurry:{solidsMassFraction:.55}}
  };
  const explanations={
   normal:['OPERACIÓN DE REFERENCIA','V=1,20 m/s · K=1 · succión −2 m · sólidos 30 % masa',
    'Se restituyen condiciones de comparación; revisar Q, ΔP, potencia y NPSH calculados.','SLURRY-PUMP-01'],
   headloss:['PÉRDIDAS DE CARGA ELEVADAS','V=1,60 m/s · K adicional=30 · succión −2 m',
    'Mayor resistencia localizada; observa ΔP del solver y pulsos anaranjados educativos en la línea de descarga.','P-PUMP-TO-CYCLONES'],
   suction:['SUCCIÓN DESFAVORABLE / CAVITACIÓN','V=1,20 m/s · pérdida de succión=9 m · K=1',
    'Mayor pérdida en aspiración: burbujas didácticas. Riesgo visual NO equivale a confirmar NPSH-R ni cavitación real.','SLURRY-PUMP-01'],
   energy:['DEMANDA ENERGÉTICA ELEVADA','V=3,20 m/s · sólidos 50 % masa · K=1',
    'Más velocidad/solidez alteran la potencia que calcula el solver; anillos rojos ilustran el incremento relativo.','SLURRY-PUMP-01'],
   settle:['TENDENCIA A SEDIMENTACIÓN','V=0,25 m/s · sólidos 55 % masa · K=1',
    'Transporte más lento y mayor carga sólida: depósito visual en SUMP; no se resuelve concentración espacial por CFD.','SUMP-01']
  };
  try{updateState(presets[v]);refresh();
    const [title,inputs,effect,target]=explanations[v];
    el('v57ScenarioTitle').textContent=title;
    el('v57ScenarioInputs').textContent='Entradas modificadas: '+inputs;
    el('v57ScenarioEffect').textContent='Qué afecta: '+effect;
    scenarioCard.hidden=false;
    if(v==='normal'){
      setMode('realista');env?.setCamera('general');
      el('v57View').value='general';
    }else{
      setMode('transparencia');
      const targets=env?.getInspectionTargets?.()??[];
      const selected=targets.find(t=>t.id===target)
        ||targets.find(t=>t.id==='SLURRY-PUMP-01');
      if(selected){env?.setInspectionTarget(selected.id);env?.setCamera('inspection');}
      env?.setInspectionMode('transparent');
      el('v57View').value='inspection';
    }
    cleanInspectionBoxes();
    setCause('Ensayo '+e.target.selectedOptions[0].text+': '+effect);
  }catch(err){setCause('Escenario no aplicable: '+err.message)}
 };
 el('v57Reset').onclick=()=>{
  resetState();playing=true;previousVelocity=null;env?.setAnimationsEnabled(true);
  el('v57TransportToggle').textContent='Transporte ON';
  el('v57Scenario').value='current';refresh();
  scenarioCard.hidden=true;
  setCause('Parámetros reiniciados. Usa la configuración de ejemplo o el panel avanzado para completar entradas.');
 };
 function refresh(){
  const s=getState(),r=getResults();
  const q=r.transport?.flowRateM3s;
  const dp=r.transport?.requiredPressurePa;
  const power=r.energy?.electricalPowerW;
  const npsh=r.pump?.npshAvailableM;
  el('v57Flow').textContent=Number.isFinite(q)?asNumber(q*3600)+' m³/h':'N/D';
  el('v57Pressure').textContent=Number.isFinite(dp)?asNumber(dp/1000)+' kPa':'N/D';
  el('v57Power').textContent=Number.isFinite(power)?asNumber(power/1000)+' kW':'N/D';
  el('v57Npsh').textContent=Number.isFinite(npsh)?asNumber(npsh)+' m':'N/D';
  const settling=r.transport?.settling;
  const stateLabel={'risk':'Riesgo','near-limit':'En límite','adequate':'Adecuado','unavailable':'N/D'};
  el('v57Sediment').textContent=settling?(stateLabel[settling.status]||'N/D'):'N/D';
  el('v57Sediment').title=settling
    ?'Durand orientativo no calibrado · Vcrit='+asNumber(settling.criticalVelocityMps)+' m/s · V/Vcrit='+asNumber(settling.velocityRatio,3)
    :'No existe evaluación de sedimentación aplicable';
  el('v57SettlingRow').classList.toggle('v57-alert-risk',settling?.status==='risk');
  const visc=s.rheology.model==='newtonian';
  faultFx?.refresh();
  if(faultFx){
   const x=faultFx.status;
   const warnings=[];
   if(x.cavitation>.48)warnings.push('cavitación en succión');
   if(x.pressureLoss>.48)warnings.push('pérdidas de carga');
   if(x.power>.48)warnings.push('demanda elevada');
   if(x.settling>.6)warnings.push('sedimentación en SUMP');
   el('v57FxStatus').textContent=warnings.length?
     'Visualización educativa: '+warnings.join(' · '):
     'Efectos educativos según parámetros; sin falla crítica ilustrada.';
  }
  el('v57Mu').disabled=!visc;
  el('v57Mu').title=visc?'Viscosidad Newtoniana activa':'La reología activa no es Newtoniana';
  for(const [id,value,text] of [
   ['v57Velocity',s.transport.pipe1.velocityMps,asNumber(s.transport.pipe1.velocityMps)+' m/s'],
   ['v57Solids',s.slurry.solidsMassFraction*100,asNumber(s.slurry.solidsMassFraction*100,0)+' % masa'],
   ['v57Mu',s.rheology.newtonianViscosityPaS,visc?asNumber(s.rheology.newtonianViscosityPaS,3)+' Pa·s':'N/D ('+s.rheology.model+')'],
   ['v57D50',s.slurry.d50M*1000,asNumber(s.slurry.d50M*1000,2)+' mm']]){
   el(id).value=String(value);el(id+'Value').textContent=text;
  }
 }
 refresh();
 if(doc.defaultView.innerWidth<780){showOptions(false);showIndicators(false)}
 return {setEnvironment(value){
   env=value;
   if(env?.scene){
    faultFx?.dispose();
    faultFx=createV57FaultEffects(env.scene,{getState,getResults});
    faultFx.setPlaying(false);
   }
   setMode(mode);cleanInspectionBoxes();refresh();
 },
  enableLabEntry(){
   labReady=true;
   enterLabButton.disabled=false;
   enterLabButton.title='Abrir únicamente molino, SUMP, bomba y ciclones';
   const view=new URLSearchParams(doc.defaultView.location.search).get('view');
   if(view==='lab'||view==='euler'||view==='bernoulli')setLabActive(true);
  },
  enterLab(){return setLabActive(true)},
  leaveLab(){return setLabActive(false)},
  refresh,get status(){return {mainMine:true,model:'V57',controlsBound:4,
   indicators:5,options:5,mode,productionModified:false,
   labActive,labReady,scope:scope?.status??null,
   currentV57Flow:el('v57Flow').textContent,environmentReady:Boolean(env),
   siteVisualLoaded:Boolean(env?.v57SiteVisual?.loaded),
   siteVisualError:env?.v57SiteVisual?.host?.metadata?.blenderVisualError??null,
   siteVisualStatus:env?.v57SiteVisual?.host?.metadata?.blenderVisualStatus??null,
   siteMeshCount:env?.scene?.metadata?.v57ImportedMeshCount??0,
   inspectionTargetId:env?.inspectionTargetId??null,
   inspectionMode:env?.inspectionMode??null,
   inspectionBoxesVisible:env?.equipmentInspection?.contextOverlay?.isEnabled?.()??null,
   camera:env?.activeCamera??null,
   nativeHeaderCloseupReady:headerCloseupReady,
   scenarioExplanationVisible:!scenarioCard.hidden,
   scenarioExplanation:el('v57ScenarioTitle').textContent,
   scenarioParameterInputs:{
    velocityMps:getState().transport.pipe1.velocityMps,
    minorLossCoefficient:getState().transport.pipe1.minorLossCoefficient,
    suctionHeadLossM:getState().energy.suctionHeadLossM,
    solidsMassFraction:getState().slurry.solidsMassFraction
   },
   didacticFaultEffects:faultFx?.status??null}}
 };
}
