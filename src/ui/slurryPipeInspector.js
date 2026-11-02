/* Interactive cutaway of the STUDIED slurry line. This is a canvas-based
 * instructional visualization driven by existing solver inputs/results.
 * It does NOT assert spatial CFD, measured sensors, erosion rates or wet mates.
 */
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, finite(x) ? x : a));
const fmt = (x, digits = 2) => finite(x) ? x.toFixed(digits) : 'N/D';

export function slurryInspectorModel(state, results) {
  const velocity = Math.max(0, Number(state?.transport?.pipe1?.velocityMps) || 0);
  const solidsMass = clamp(Number(state?.slurry?.solidsMassFraction));
  const sourceD50 = Number(state?.slurry?.d50M);
  const d50mm = finite(sourceD50) && sourceD50 > 0 ? sourceD50 * 1000 : null;
  const settling = results?.transport?.settling;
  const ratio = finite(settling?.velocityRatio) && settling.velocityRatio >= 0
    ? settling.velocityRatio : null;
  // A compositional illustration only. Do NOT call these correlation-validated
  // slurry regimes: Durand's criterion alone cannot determine all four.
  const bed = ratio === null
    ? clamp((1.1 - velocity) / 1.5) * (0.12 + solidsMass * 0.65)
    : clamp((1.25 - ratio) / 1.2) * (0.12 + solidsMass * 0.65);
  const visualRegime = ratio === null ? 'Sin clasificación de régimen'
    : ratio < .70 ? 'Lecho estacionario · ilustrativo'
    : ratio < 1.0 ? 'Lecho móvil · ilustrativo'
    : ratio < 1.55 ? 'Flujo heterogéneo · ilustrativo'
    : 'Distribución homogénea · ilustrativa';
  const newtonian = state?.rheology?.model === 'newtonian';
  const rawProfile = results?.rheology?.profile;
  const profile = Array.isArray(rawProfile?.radiusM) &&
      Array.isArray(rawProfile?.velocityMps) &&
      rawProfile.radiusM.length >= 3 &&
      rawProfile.radiusM.length === rawProfile.velocityMps.length &&
      rawProfile.radiusM.every(finite) &&
      rawProfile.velocityMps.every(finite)
    ? {radiusM:rawProfile.radiusM, velocityMps:rawProfile.velocityMps} : null;
  const wallStress = results?.rheology?.wallStressPa;
  const yieldStress = state?.rheology?.yieldStressPa;
  const hasYieldStress = state?.rheology?.model === 'bingham' || state?.rheology?.model === 'hb';
  const plugRadiusRatio = hasYieldStress && finite(wallStress) && wallStress > 0 &&
    finite(yieldStress) && yieldStress >= 0 ? clamp(yieldStress / wallStress) : null;
  // Visual exposure proxy: more flow speed and solids can increase abrasion,
  // but without particle/liner data this is NOT an erosion rate or risk score.
  const wearExposureVisual = clamp((velocity / 3) ** 2 * solidsMass / .5);
  return {
    velocity, solidsMass, d50mm, ratio, bed, visualRegime, newtonian,
    rheology: state?.rheology?.model ?? 'N/D', wearExposureVisual,
    profile, plugRadiusRatio,
    flowM3h: finite(results?.transport?.flowRateM3s) ? results.transport.flowRateM3s * 3600 : null,
    pressureKpa: finite(results?.transport?.requiredPressurePa) ? results.transport.requiredPressurePa / 1000 : null,
    settlingStatus: settling?.status ?? 'unavailable',
    modelClassification: false, cfd: false, erosionRateAvailable: false,
  };
}

export function mountSlurryPipeInspector({document: doc, viewport, getState, getResults, onOpenChange}) {
  const panel = doc.createElement('section');
  panel.className = 'v57-pipe-inspector';
  panel.id = 'v57PipeInspector';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="v57-pipe-bar">
      <div><span class="v57-pipe-kicker">LABORATORIO BERNOULLI–EULER · SECCIÓN AMPLIADA</span>
      <strong>Dinámica interna de pulpa · línea de transporte</strong></div>
      <div class="v57-pipe-actions">
        <button id="v57PipeDimension" class="active" title="Alternar inspección tridimensional y esquema bidimensional">3D activo</button>
        <button id="v57ExpandPipe" title="Ampliar el corte sin modificar las dimensiones del circuito">⛶ Ampliar</button>
        <button data-pipe-tab="flow" class="active">Partículas y depósito</button>
        <button data-pipe-tab="profile">Velocidad y reología</button>
        <button data-pipe-tab="wear">Zonas de desgaste</button>
        <button id="v57ClosePipe" aria-label="Cerrar sección ampliada">✕</button>
      </div>
    </div>
    <div class="v57-pipe-hero">
      <canvas id="v57Pipe3DCanvas" aria-label="Modelo tridimensional educativo de una tubería seccionada con pulpa y sedimento"></canvas>
      <canvas id="v57PipeCutCanvas" role="img" aria-label="Corte didáctico animado de tubería con pulpa, partículas gruesas y sedimento"></canvas>
      <div class="v57-pipe-hud v57-pipe-hud-top" id="v57PipeHeroDescription">CORTE 3D EDUCATIVO · GEOMETRÍA DE INSPECCIÓN, NO CAD FIRMADO</div>
      <div class="v57-pipe-hud v57-pipe-hud-bottom" id="v57PipeFlowLabel"></div>
    </div>
    <div class="v57-pipe-metrics">
      <div><small>Velocidad media de entrada</small><b id="v57PipeSpeed">N/D</b></div>
      <div><small>Sólidos en masa · entrada</small><b id="v57PipeSolids">N/D</b></div>
      <div><small>Velocidad / límite de depósito</small><b id="v57PipeRatio">N/D</b></div>
      <div><small>ΔP calculada · circuito</small><b id="v57PipeDelta">N/D</b></div>
    </div>
    <div class="v57-pipe-diagnostics">
      <div class="v57-pipe-diagnostic"><span>Sección transversal · concentración ilustrativa</span>
        <canvas id="v57PipeCross" role="img" aria-label="Corte circular ilustrativo del gradiente de sólidos"></canvas></div>
      <div class="v57-pipe-diagnostic"><span id="v57PipeProfileLabel">Perfil de velocidad · comprobando solver</span>
        <canvas id="v57PipeVelocity" role="img" aria-label="Perfil cualitativo de velocidad con o sin núcleo tapón"></canvas></div>
      <div class="v57-pipe-diagnostic"><span>Exposición abrasiva · no tasa de erosión</span>
        <canvas id="v57PipeWear" role="img" aria-label="Zonas de posible desgaste en la parte inferior de la tubería"></canvas></div>
      <div class="v57-pipe-diagnostic v57-pipe-diagnosis"><span>Interpretación del escenario</span>
        <strong id="v57PipeRegime">N/D</strong><p id="v57PipeInterpretation"></p></div>
    </div>
    <footer>Representación didáctica vinculada a parámetros del escenario. Partículas, gradientes, erosión y cuatro regímenes NO provienen de CFD. Cálculos Q, ΔP y V/V crítica solo cuando los aporta el solver existente. No modifica geometría CAD ni diámetro hidráulico.</footer>`;
  viewport.append(panel);
  const $ = id => panel.querySelector('#' + id);
  const canvas3D=$('v57Pipe3DCanvas'), canvas2D=$('v57PipeCutCanvas');
  const canvases = [$('v57PipeCutCanvas'), $('v57PipeCross'), $('v57PipeVelocity'), $('v57PipeWear')];
  let active = false, labActive = false, playing = true, tab = 'flow', raf = 0,
    previousFrameTime = null, lastRenderedFrame = 0;
  let render3D=true, expanded=false, threeD=null, threeDLoading=false, threeDError=null;
  let lastModel = slurryInspectorModel(getState(), getResults());
  let visualBed = lastModel.bed;
  const particles = Array.from({length: 420}, (_, i) => {
    const rnd = n => {const z = Math.sin((i + 13) * n * 17.613) * 43758.5453; return z - Math.floor(z);};
    return {x:rnd(2.7), y:rnd(5.1), size:rnd(7.3), phase:rnd(9.1)};
  });
  function fit(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, doc.defaultView.devicePixelRatio || 1);
    const w = Math.max(20, Math.round(rect.width * dpr));
    const h = Math.max(20, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {canvas.width = w; canvas.height = h;}
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return {ctx, w: rect.width, h: rect.height};
  }
  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  }
  function drawHero(time, m) {
    const {ctx:c, w, h} = fit(canvases[0]);
    if (!c || w < 50 || h < 45) return;
    c.clearRect(0, 0, w, h);
    const backdrop = c.createLinearGradient(0, 0, 0, h);
    backdrop.addColorStop(0, '#162533');backdrop.addColorStop(.55,'#283947');backdrop.addColorStop(1,'#0b1721');
    c.fillStyle=backdrop;c.fillRect(0,0,w,h);
    for (let i=0;i<14;i++) {
      c.strokeStyle='rgba(132,167,177,.11)';c.beginPath();c.moveTo(0,h*.12+i*h*.07);
      c.lineTo(w,h*.12+i*h*.07);c.stroke();
    }
    const left=35, right=w-35, top=Math.max(35,h*.20), height=Math.max(28,h*.55), bottom=top+height, width=right-left;
    c.shadowColor='rgba(0,0,0,.7)';c.shadowBlur=18;
    c.fillStyle='#627481';rounded(c,left-9,top-12,width+18,height+24,24);c.fill();c.shadowBlur=0;
    c.save();rounded(c,left,top,width,height,16);c.clip();
    const fluid=c.createLinearGradient(0,top,0,bottom);
    fluid.addColorStop(0,'#748993');fluid.addColorStop(.12,'#91abb1');
    fluid.addColorStop(.50,'#596e70');fluid.addColorStop(.83,'#66604d');fluid.addColorStop(1,'#342c26');
    c.fillStyle=fluid;c.fillRect(left,top,width,height);
    const sedimentHeight=height*clamp(visualBed*1.25,0,.64);
    if (sedimentHeight>1) {
      c.beginPath();c.moveTo(left,bottom);
      for(let x=0;x<=width+8;x+=8){
        const wave=Math.sin(x*.021+time*.00023)*3+Math.sin(x*.063+3)*1.2;
        c.lineTo(left+x,bottom-sedimentHeight+wave);
      }
      c.lineTo(right,bottom);c.closePath();
      const sand=c.createLinearGradient(0,bottom-sedimentHeight,0,bottom);
      sand.addColorStop(0,'rgba(166,127,72,.94)');sand.addColorStop(1,'rgba(74,54,34,.99)');
      c.fillStyle=sand;c.fill();
    }
    if (tab==='wear') {
      const opacity = .08 + m.wearExposureVisual * .92;
      const wear=c.createLinearGradient(0,bottom-height*.24,0,bottom);
      wear.addColorStop(0,'rgba(210,43,28,0)');
      wear.addColorStop(.7,'rgba(251,110,34,'+(opacity*.28)+')');
      wear.addColorStop(1,'rgba(255,166,40,'+(opacity*.82)+')');
      c.fillStyle=wear;c.fillRect(left,bottom-height*.26,width,height*.26);
    }
    for(let i=0;i<particles.length;i++){
      const p=particles[i], s=clamp(m.solidsMass,.02,.8);
      if (p.phase > .15 + s*.95) continue;
      const advect = playing ? time*.000035 * m.velocity * (p.size>.85?.55:1.1) : 0;
      const px=left+((p.x+advect)%1)*width;
      let py=top+height*(.12+p.y*.81);
      if(visualBed>.04)py=Math.min(bottom-3,py+height*visualBed*(p.size>.54? .48:.18));
      const grain=1.2+p.size*(3+Math.min(4.5,(m.d50mm??0)*2.4));
      c.beginPath();c.ellipse(px,py,grain,grain*(.6+p.size*.25),p.phase*3,0,Math.PI*2);
      c.fillStyle=p.size>.71?'rgba(229,165,77,.91)':'rgba(194,169,129,.76)';c.fill();
      if(p.size>.75){c.strokeStyle='rgba(255,217,148,.5)';c.lineWidth=.6;c.stroke();}
    }
    if(sedimentHeight>3){
      for(let i=0;i<110;i++){
        const p=particles[i], px=left+p.x*width;
        const py=bottom-Math.max(2,sedimentHeight)*(p.y*.78);
        const size=2+p.size*5.3;
        c.beginPath();c.arc(px,py,size,0,Math.PI*2);
        c.fillStyle=i%3===0?'#99794e':i%3===1?'#c3995a':'#6c583e';c.fill();
        c.strokeStyle='rgba(246,205,139,.31)';c.lineWidth=.7;c.stroke();
      }
    }
    if(tab!=='wear'){
      const lines=tab==='profile'?7:4;
      for(let i=0;i<lines;i++){
        const yy=top+(i+1)*height/(lines+1), drift=playing?time*.015*m.velocity:0;
        c.beginPath();
        for(let x=0;x<width;x+=5){
          const wave= Math.sin((x+drift)*.027+i*1.9)*2.5;
          if(x===0)c.moveTo(left+x,yy+wave);else c.lineTo(left+x,yy+wave);
        }
        c.strokeStyle=tab==='profile'?'rgba(76,232,255,.66)':'rgba(230,245,249,.22)';
        c.lineWidth=tab==='profile'?2:1;c.stroke();
      }
    }
    const gleam=c.createLinearGradient(0,top,0,bottom);
    gleam.addColorStop(0,'rgba(229,251,255,.70)');
    gleam.addColorStop(.12,'rgba(230,246,255,.20)');
    gleam.addColorStop(.37,'rgba(255,255,255,0)');
    gleam.addColorStop(.83,'rgba(0,0,0,.06)');
    gleam.addColorStop(1,'rgba(8,17,22,.72)');
    c.fillStyle=gleam;c.fillRect(left,top,width,height);
    c.restore();
    c.strokeStyle='#bdcbd3';c.lineWidth=3;rounded(c,left,top,width,height,16);c.stroke();
    // Flanges with visible bolt circles and metallic cylindrical depth.
    for(const xx of [left,right]){
      const flange=c.createLinearGradient(xx-12,0,xx+13,0);
      flange.addColorStop(0,'#1c2931');flange.addColorStop(.3,'#9aabb4');
      flange.addColorStop(.57,'#465563');flange.addColorStop(1,'#151f29');
      c.fillStyle=flange;rounded(c,xx-15,top-12,30,height+24,9);c.fill();
      c.strokeStyle='#c3d0d4';c.lineWidth=1;rounded(c,xx-15,top-12,30,height+24,9);c.stroke();
      for(let j=0;j<6;j++){
        const by=top-5+(height+10)*j/5;
        c.beginPath();c.arc(xx,by,2.7,0,Math.PI*2);c.fillStyle='#1d2b31';c.fill();
        c.strokeStyle='#bcc8cf';c.stroke();
      }
    }
    c.fillStyle='rgba(233,243,246,.7)';c.font='11px system-ui';
    c.fillText('Flujo →',Math.max(36,w-90),Math.max(28,top-17));
  }
  function drawCross(m) {
    const {ctx:c,w,h}=fit(canvases[1]);if(!c)return;
    c.clearRect(0,0,w,h);const r=Math.min(h*.42,w*.29),cx=w*.35,cy=h*.52;
    c.save();c.beginPath();c.arc(cx,cy,r,0,2*Math.PI);c.clip();
    const grad=c.createLinearGradient(0,cy-r,0,cy+r);
    grad.addColorStop(0,'#344e69');grad.addColorStop(.45,'#537e89');
    grad.addColorStop(.77,'#bd8a49');grad.addColorStop(1,'#a9542c');
    c.fillStyle=grad;c.fillRect(cx-r,cy-r,2*r,2*r);
    for(let i=0;i<140;i++){const p=particles[i], a=p.x*2*Math.PI, rad=Math.sqrt(p.y)*r*.97;
      let yy=cy+Math.sin(a)*rad+visualBed*r*.33;
      if(yy>cy+r)continue;
      const xx=cx+Math.cos(a)*rad;
      c.beginPath();c.arc(xx,yy,.9+p.size*1.3,0,2*Math.PI);c.fillStyle='rgba(233,191,119,.8)';c.fill();
    }
    c.restore();c.beginPath();c.arc(cx,cy,r,0,2*Math.PI);c.strokeStyle='#d7ebf4';c.lineWidth=4;c.stroke();
    c.font='11px system-ui';c.fillStyle='#b9d5df';c.fillText('Corona',cx+r+9,cy-r*.62);
    c.fillText('Fondo',cx+r+9,cy+r*.8);
    c.strokeStyle='rgba(234,243,248,.5)';c.setLineDash([3,4]);
    c.beginPath();c.moveTo(cx,cy-r);c.lineTo(cx,cy+r);c.stroke();c.setLineDash([]);
  }
  function drawVelocity(m) {
    const {ctx:c,w,h}=fit(canvases[2]);if(!c)return;c.clearRect(0,0,w,h);
    const x0=24,y0=h-19,x1=w-21,yt=15;
    c.strokeStyle='#42657b';c.beginPath();c.moveTo(x0,yt);c.lineTo(x0,y0);c.lineTo(x1,y0);c.stroke();
    c.font='10px system-ui';c.fillStyle='#8cbdcc';c.fillText('r/R',6,17);c.fillText('V',x1-4,h-3);
    const maxProfile=m.profile?Math.max(...m.profile.velocityMps):0;
    const maxRadius=m.profile?Math.max(...m.profile.radiusM):0;
    const interpolateProfile = normalizedRadius => {
      const r=normalizedRadius*maxRadius;
      const rr=m.profile.radiusM,vv=m.profile.velocityMps;
      for(let k=1;k<rr.length;k++){
        if(rr[k]>=r){
          const t=clamp((r-rr[k-1])/Math.max(1e-12,rr[k]-rr[k-1]));
          return vv[k-1]+(vv[k]-vv[k-1])*t;
        }
      }
      return vv.at(-1);
    };
    c.beginPath();
    for(let i=0;i<=90;i++){
      const yy=i/90, radius=Math.abs(2*yy-1);
      const profile=m.profile && maxProfile>0 && maxRadius>0
        ?clamp(interpolateProfile(radius)/maxProfile):
        m.newtonian?Math.max(0,1-radius*radius):
        radius<.32?1:Math.pow((1-radius)/.68,1.6);
      const x=x0+profile*(x1-x0),y=yt+yy*(y0-yt);
      if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
    }
    c.strokeStyle='#40d8f8';c.lineWidth=2.5;c.stroke();
    if(m.plugRadiusRatio!==null && m.profile){
      c.fillStyle='#e4bd80';c.fillText('r tapón/R '+fmt(m.plugRadiusRatio,2),x0+17,yt+13);
    }else{
      c.fillStyle='#d0dbe7';c.fillText(m.profile?'Perfil del solver':'Esquema conceptual',x0+16,yt+13);
    }
  }
  function drawWear(m) {
    const {ctx:c,w,h}=fit(canvases[3]);if(!c)return;c.clearRect(0,0,w,h);
    const x=13,y=24,ww=w-26,hh=h-46;
    const metal=c.createLinearGradient(0,y,0,y+hh);
    metal.addColorStop(0,'#7f969f');metal.addColorStop(.6,'#263f4d');metal.addColorStop(1,'#18232c');
    c.fillStyle=metal;rounded(c,x,y,ww,hh,12);c.fill();
    const heat=c.createLinearGradient(0,y+hh*.62,0,y+hh);
    const alpha = .07 + .93*m.wearExposureVisual;
    heat.addColorStop(0,'rgba(244,70,19,0)');heat.addColorStop(.5,'rgba(215,66,20,.45)');
    heat.addColorStop(1,'rgba(255,178,32,'+(alpha*.82)+')');
    c.globalAlpha=alpha;
    c.fillStyle=heat;c.fillRect(x+3,y+hh*.63,ww-6,hh*.33);
    c.globalAlpha=1;
    c.strokeStyle='#cbdde0';c.lineWidth=2;rounded(c,x,y,ww,hh,12);c.stroke();
    c.fillStyle='#c8dae1';c.font='10px system-ui';
    c.fillText('V/Cp · exposición ilustrativa: '+Math.round(m.wearExposureVisual*100)+'%',15,h-7);
  }
  function refresh() {
    lastModel=slurryInspectorModel(getState(),getResults());const m=lastModel;
    $('v57PipeSpeed').textContent=fmt(m.velocity)+' m/s';
    $('v57PipeSolids').textContent=fmt(m.solidsMass*100,0)+' % masa';
    $('v57PipeRatio').textContent=m.ratio===null?'N/D':fmt(m.ratio,2)+' · Durand orientativo';
    $('v57PipeDelta').textContent=m.pressureKpa===null?'N/D':fmt(m.pressureKpa)+' kPa';
    $('v57PipeRegime').textContent=m.visualRegime;
    $('v57PipeProfileLabel').textContent=m.profile
      ?'Perfil radial del solver · laminar equivalente'
      :'Perfil de velocidad · esquema no calculado';
    $('v57PipeFlowLabel').textContent=m.velocity<.01?'Sin advección · depósito didáctico progresivo':
      'V '+fmt(m.velocity)+' m/s · d₅₀ '+fmt(m.d50mm,2)+(m.d50mm===null?' (no definido)':' mm')+' · distribución ilustrativa';
    const risk=m.settlingStatus==='risk';
    $('v57PipeInterpretation').textContent=m.ratio===null?
      'Sin relación V/V crítica aplicable. La disposición de partículas solo ilustra una tendencia; no clasifica el régimen real.':
      (risk?'El criterio orientativo señala riesgo de depósito. ':
        'El criterio orientativo no señala depósito crítico. ')+
      'La forma del lecho y la estratificación mostradas son didácticas, no campos resueltos.';
    panel.classList.toggle('v57-pipe-risk',risk);
    if(active)paint(doc.defaultView.performance?.now?.() ?? 0);
  }
  function updateDimensions(){
    const showing3D=render3D&&Boolean(threeD);
    canvas3D.hidden=!showing3D;
    canvas2D.hidden=showing3D;
    const toggle=$('v57PipeDimension');
    toggle.textContent=render3D?'3D activo':'Esquema 2D';
    toggle.classList.toggle('active',render3D);
    $('v57PipeHeroDescription').textContent=showing3D
      ?'MAQUETA 3D SECCIONADA · ESCALA VISUAL AUMENTADA, NO PIEZA CAD'
      :threeDLoading?'PREPARANDO VISTA 3D · ESQUEMA 2D TEMPORAL'
      :threeDError?'VISTA 3D NO DISPONIBLE · ESQUEMA 2D DE RESPALDO'
      :'ESQUEMA 2D · DIÁMETRO AUMENTADO SOLO EN PANTALLA';
    if(showing3D)threeD.resize();
  }
  async function ensure3D(){
    if(threeD||threeDLoading||threeDError||!render3D)return;
    threeDLoading=true;updateDimensions();
    try{
      const {createSlurryPipe3DScene}=await import('./slurryPipe3D.js');
      if(!active||!labActive){threeDLoading=false;return;}
      threeD=createSlurryPipe3DScene({canvas:canvas3D});
      threeD.resize();
    }catch(error){
      threeDError=error?.message??String(error);
      render3D=false;
      console.warn('Inspección 3D no disponible; mostrando esquema 2D:',error);
    }finally{
      threeDLoading=false;updateDimensions();paint(0);
    }
  }
  function paint(t,dt=0) {
    if(!active||!labActive)return;
    if(render3D&&threeD){
      threeD.render({nextModel:lastModel,bedLevel:visualBed,
        tab,animate:playing,dt});
    }else drawHero(t,lastModel);
    drawCross(lastModel);drawVelocity(lastModel);drawWear(lastModel);
  }
  function frame(t) {
    raf=0;if(!active||!labActive)return;
    const dt=previousFrameTime===null?0:clamp((t-previousFrameTime)/1000,0,.1);
    previousFrameTime=t;
    // Smooth qualitative sedimentation/remobilization, not seconds or thickness
    // from an unvalidated deposition kinetics model.
    const rate=visualBed<lastModel.bed ? .72 : 1.1;
    visualBed+=(lastModel.bed-visualBed)*clamp(dt*rate);
    // One scene for the entire V57 mine already renders on this browser.
    // Limit this optional secondary 3D window to ~30 FPS for GPU headroom.
    if(t-lastRenderedFrame>=32){lastRenderedFrame=t;paint(t,dt);}
    if(playing)raf=doc.defaultView.requestAnimationFrame(frame);
  }
  function run() {if(raf)doc.defaultView.cancelAnimationFrame(raf);raf=0;
    previousFrameTime=null;lastRenderedFrame=0;
    if(active&&labActive){paint(0);if(playing)raf=doc.defaultView.requestAnimationFrame(frame);}
  }
  function setOpen(value) {active=Boolean(value)&&labActive;
    if(!active){
      expanded=false;
      $('v57ExpandPipe').textContent='⛶ Ampliar';
    }
    panel.hidden=!active;doc.body.classList.toggle('v57-pipe-open',active);
    doc.body.classList.toggle('v57-pipe-expanded',expanded);
    panel.classList.toggle('expanded',expanded);
    onOpenChange?.(active);
    if(active&&render3D)void ensure3D();
    if(!active&&threeD){threeD.dispose();threeD=null;}
    updateDimensions();run();return active;}
  panel.querySelector('#v57ClosePipe').addEventListener('click',()=>setOpen(false));
  $('v57ExpandPipe').addEventListener('click',()=>{
    expanded=!expanded;panel.classList.toggle('expanded',expanded);
    doc.body.classList.toggle('v57-pipe-expanded',expanded);
    $('v57ExpandPipe').textContent=expanded?'↙ Reducir':'⛶ Ampliar';
    updateDimensions();run();
  });
  $('v57PipeDimension').addEventListener('click',()=>{
    if(threeDError){render3D=false;return;}
    render3D=!render3D;
    if(render3D)void ensure3D();
    updateDimensions();run();
  });
  panel.querySelectorAll('[data-pipe-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    tab=btn.dataset.pipeTab;
    panel.querySelectorAll('[data-pipe-tab]').forEach(node=>node.classList.toggle('active',node===btn));
    paint(0);
  }));
  refresh();
  canvas3D.hidden=true;updateDimensions();
  const onResize=()=>{if(active&&threeD)threeD.resize();};
  doc.defaultView.addEventListener('resize',onResize);
  return {
    open:()=>setOpen(true),close:()=>setOpen(false),
    setLabActive(value){labActive=Boolean(value);if(!labActive)setOpen(false);},
    setPlaying(value){playing=Boolean(value);run();},
    refresh, get status(){return {open:active,expanded,model:lastModel,visualization:threeD?'babylon 3D educational cutaway':'2D fallback',
      render3D,render3DReady:!!threeD,render3DError:threeDError,scene3D:threeD?.status??null,
      cfd:false,sourceGeometryChanged:false}},
    dispose(){setOpen(false);doc.defaultView.removeEventListener('resize',onResize);panel.remove();}
  };
}
