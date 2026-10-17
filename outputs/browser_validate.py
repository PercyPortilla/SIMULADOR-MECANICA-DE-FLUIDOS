import subprocess, urllib.request, time, os, json, socket, base64, hashlib, struct

CHROME=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
URL='http://127.0.0.1:4173/'
PORT=9222
PROFILE=os.path.join(os.environ.get('TEMP','.'),'pulpa-lab-final-browser')
OUT=os.path.join(os.getcwd(),'outputs','browser-final.png')
os.makedirs(os.path.dirname(OUT),exist_ok=True)

class WS:
    def __init__(self,url):
        assert url.startswith('ws://')
        rest=url[5:]; hostport,path=rest.split('/',1); path='/'+path
        host,port=(hostport.split(':',1)+['80'])[:2]
        self.s=socket.create_connection((host,int(port)),timeout=90)
        key=base64.b64encode(os.urandom(16)).decode()
        req=(f'GET {path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n')
        self.s.sendall(req.encode())
        data=b''
        while b'\r\n\r\n' not in data: data+=self.s.recv(4096)
        if b' 101 ' not in data.split(b'\r\n',1)[0]: raise RuntimeError(data.decode(errors='replace'))
        self.next_id=1
    def _send_text(self,text):
        payload=text.encode(); mask=os.urandom(4); n=len(payload)
        head=bytearray([0x81])
        if n<126: head.append(0x80|n)
        elif n<65536: head.append(0x80|126); head.extend(struct.pack('!H',n))
        else: head.append(0x80|127); head.extend(struct.pack('!Q',n))
        head.extend(mask)
        masked=bytes(b ^ mask[i%4] for i,b in enumerate(payload))
        self.s.sendall(bytes(head)+masked)
    def _recv(self):
        def exact(n):
            d=b''
            while len(d)<n:
                x=self.s.recv(n-len(d))
                if not x: raise EOFError()
                d+=x
            return d
        while True:
            b1,b2=exact(2); op=b1&0x0f; n=b2&0x7f
            if n==126: n=struct.unpack('!H',exact(2))[0]
            elif n==127: n=struct.unpack('!Q',exact(8))[0]
            masked=bool(b2&0x80); mask=exact(4) if masked else None; data=exact(n)
            if masked: data=bytes(b ^ mask[i%4] for i,b in enumerate(data))
            if op==9:
                # pong
                self.s.sendall(bytes([0x8a,len(data)])+data); continue
            if op==1: return json.loads(data.decode())
            if op==8: raise EOFError('closed')
    def cmd(self,method,params=None):
        i=self.next_id; self.next_id+=1
        obj={'id':i,'method':method}
        if params is not None: obj['params']=params
        self._send_text(json.dumps(obj,separators=(',',':')))
        while True:
            msg=self._recv()
            if msg.get('id')==i: return msg
    def close(self): self.s.close()

args=[CHROME,'--headless=new',f'--remote-debugging-port={PORT}','--remote-allow-origins=*','--no-first-run','--no-default-browser-check','--no-sandbox',f'--user-data-dir={PROFILE}','--window-size=1600,1000','--use-angle=swiftshader-webgl','--enable-webgl',URL]
p=subprocess.Popen(args,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    targets=None
    for _ in range(40):
        try:
            targets=json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json',timeout=1))
            pages=[t for t in targets if t.get('type')=='page' and t.get('url')==URL]
            if pages: break
        except Exception: pass
        time.sleep(.25)
    else: raise RuntimeError('Chrome DevTools no disponible')
    page=pages[0]; ws=WS(page['webSocketDebuggerUrl'])
    ws.cmd('Runtime.enable'); ws.cmd('Page.enable')
    # Let the dynamically imported Three/WebGL scene finish its first heavy
    # construction before the QA script starts mutating simulation inputs.
    time.sleep(20)
    preflight=ws.cmd('Runtime.evaluate',{'expression':'''(()=>({
      pumpReady:[...document.querySelectorAll('#inspection-target option')].some(o=>o.value==='PUMP-01'),
      canvasWidth:document.querySelector('#environment-canvas')?.width||0,
      canvasHeight:document.querySelector('#environment-canvas')?.height||0,
      sceneErrorHidden:document.querySelector('#scene-error')?.hidden===true,
      sceneErrorText:document.querySelector('#scene-error')?.textContent||'',
      exampleModel:document.querySelector('[data-path="rheology.model"]')?.value||'',
      exampleSolids:document.querySelector('[data-path="slurry.solidsMassFraction"]')?.value||'',
      exampleVelocity:document.querySelector('[data-path="transport.pipe1.velocityMps"]')?.value||''
    }))()''','returnByValue':True})
    print('PREFLIGHT='+json.dumps(preflight,ensure_ascii=False)[:2000])
    expression=r'''(async()=>{
      const result={};
      const sceneError=document.querySelector('#scene-error');
      const change=(path,value)=>{const input=document.querySelector(`[data-path="${path}"]`);if(!input)throw new Error(`input missing: ${path}`);input.value=String(value);input.dispatchEvent(new Event('change',{bubbles:true}));};
      change('rheology.model','newtonian');
      await new Promise(resolve=>setTimeout(resolve,80));
      const stateModule=await import('/src/state/simulationState.js');
      stateModule.updateState({
        slurry:{solidsMassFraction:0,solidDensityKgM3:2650,liquidDensityKgM3:1000},
        rheology:{model:'newtonian',newtonianViscosityPaS:0.001},
        transport:{pipe1:{innerDiameterM:0.1,lengthM:100,roughnessM:0.0001,velocityMps:1,minorLossCoefficient:2,elevationChangeM:5}},
        energy:{pumpEfficiency:0.8,motorEfficiency:0.9,operatingHoursPerYear:1000,electricityPricePerKwh:0.12},
        leaching:{kineticModel:'first-order-cstr-series',totalUsefulVolumeM3:360,reactorCount:4,firstOrderRateConstantPerH:0.1},
        recovery:{model:'stage-efficiency',feedGoldKgH:10,adsorptionEfficiency:0.9,elutionEfficiency:0.8,electrowinningEfficiency:0.95,smeltingEfficiency:0.98}
      });
      await new Promise(resolve=>setTimeout(resolve,250));
      document.querySelector('#scenario-save')?.click();
      stateModule.updateState({transport:{pipe1:{velocityMps:0.5}}});
      document.querySelector('#scenario-load')?.click();
      await new Promise(resolve=>setTimeout(resolve,120));
      const restoredVelocity=document.querySelector('[data-path="transport.pipe1.velocityMps"]')?.value;
      const roughnessDisabled=document.querySelector('[data-path="transport.pipe1.roughnessM"]')?.disabled===true;
      const materialIsSelect=document.querySelector('[data-path="transport.pipe1.material"]')?.tagName==='SELECT';
      document.querySelector('#theme-toggle')?.click();
      const accentInput=document.querySelector('[data-theme-key="accent"]');
      if(accentInput){accentInput.value='#00aabb';accentInput.dispatchEvent(new Event('input',{bubbles:true}));}
      const savedTheme=localStorage.getItem('pulpa-lab-ui-theme-v1');
      const appliedAccent=getComputedStyle(document.documentElement).getPropertyValue('--ui-accent').trim();
      const terrainInput=document.querySelector('[data-scene-role="terrain"]');
      if(terrainInput){terrainInput.value='#665544';terrainInput.dispatchEvent(new Event('input',{bubbles:true}));}
      const savedScenePalette=localStorage.getItem('pulpa-lab-scene-palette-v1');
      document.querySelector('#theme-reset')?.click();
      document.querySelector('#scene-palette-reset')?.click();
      result.app={title:document.title,canvas:Boolean(document.querySelector('#environment-canvas')),canvasWidth:document.querySelector('#environment-canvas')?.width||0,canvasHeight:document.querySelector('#environment-canvas')?.height||0,sceneErrorHidden:sceneError?.hidden===true,sceneErrorText:sceneError?.textContent||'',pumpOption:[...document.querySelectorAll('#inspection-target option')].some(o=>o.value==='PUMP-01')};
      result.ui={
        pressureDropText:document.querySelector('#kpi-dp')?.textContent,
        densityText:document.querySelector('#kpi-density')?.textContent,
        flowText:document.querySelector('#kpi-flow')?.textContent,
        modelText:document.querySelector('#result-model')?.textContent,
        regimeText:document.querySelector('#kpi-regime')?.textContent,
        powerText:document.querySelector('#kpi-power')?.textContent,
        recoveryText:document.querySelector('#kpi-recovery')?.textContent,
        reynoldsText:document.querySelector('#result-reynolds')?.textContent,
        frictionText:document.querySelector('#result-friction-factor')?.textContent,
        residenceText:document.querySelector('#result-residence')?.textContent,
        leachConversionText:document.querySelector('#result-leach-conversion')?.textContent,
        finalGoldText:document.querySelector('#result-gold')?.textContent,
        gradientText:document.querySelector('#result-pressure-gradient')?.textContent,
        pressureChartPoints:document.querySelector('#pressure-chart polyline')?.getAttribute('points')?.split(' ').length||0,
        newtonianViscosityVisible:Boolean(document.querySelector('[data-path="rheology.newtonianViscosityPaS"]')),
        nonNewtonianFieldsHidden:!document.querySelector('[data-path="rheology.consistencyIndex"]')&&!document.querySelector('[data-path="rheology.plasticViscosityPaS"]'),
        themeEditor:Boolean(accentInput),
        themePersisted:Boolean(savedTheme?.includes('#00aabb')),
        themeApplied:appliedAccent==='#00aabb',
        scenePalettePersisted:Boolean(savedScenePalette?.includes('#665544')),
        scenarioRestored:restoredVelocity==='1',
        roughnessDisabled,
        materialIsSelect,
      };
      document.querySelector('#scenario-delete')?.click();
      return result;
    })()'''
    ev=ws.cmd('Runtime.evaluate',{'expression':expression,'awaitPromise':True,'returnByValue':True,'userGesture':True})
    print('EVAL_RAW='+json.dumps(ev,ensure_ascii=False)[:5000])
    if 'error' in ev: raise RuntimeError(ev['error'])
    robj=ev.get('result',{}).get('result',{})
    if robj.get('subtype')=='error': raise RuntimeError(robj.get('description'))
    value=robj.get('value')
    print('BROWSER_VALIDATION='+json.dumps(value,ensure_ascii=False))
    for camera_id in ['general','oblique','reception','crushing','grinding','leaching','recovery']:
        ws.cmd('Runtime.evaluate',{'expression':f'''(()=>{{
          document.querySelector('[data-camera="{camera_id}"]')?.click();
          document.querySelector('#environment-canvas')?.scrollIntoView({{block:'center',inline:'nearest'}});
          return document.querySelector('#view-title')?.textContent;
        }})()''','returnByValue':True})
        time.sleep(1.2)
        viewshot=ws.cmd('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
        viewdata=viewshot.get('result',{}).get('data')
        if viewdata:
            viewout=os.path.join(os.getcwd(),'outputs',f'browser-{camera_id}.png')
            open(viewout,'wb').write(base64.b64decode(viewdata)); print('SCREENSHOT='+viewout)
    for target_id, slug in [('APRON-FEEDER','apron-feeder'),('PRIMARY-CRUSHER','primary-crusher'),('CV-01-FEEDER-TO-CRUSHER','cv01')]:
        ws.cmd('Runtime.evaluate',{'expression':f'''(()=>{{
          document.querySelector('[data-camera="inspection"]')?.click();
          const select=document.querySelector('#inspection-target');
          if(select){{select.value='{target_id}';select.dispatchEvent(new Event('change',{{bubbles:true}}));}}
          document.querySelector('#environment-canvas')?.scrollIntoView({{block:'center',inline:'nearest'}});
          return select?.value||'';
        }})()''','returnByValue':True})
        time.sleep(1.0)
        detailshot=ws.cmd('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
        detaildata=detailshot.get('result',{}).get('data')
        if detaildata:
            detailout=os.path.join(os.getcwd(),'outputs',f'browser-inspection-{slug}.png')
            open(detailout,'wb').write(base64.b64decode(detaildata)); print('SCREENSHOT='+detailout)
    ws.cmd('Runtime.evaluate',{'expression':'''(()=>{
      document.querySelector('[data-camera="inspection"]')?.click();
      const select=document.querySelector('#inspection-target');
      if(select){select.value='PUMP-01';select.dispatchEvent(new Event('change',{bubbles:true}));}
      document.querySelector('#environment-canvas')?.scrollIntoView({block:'center',inline:'nearest'});
      return true;
    })()''','returnByValue':True})
    time.sleep(1.2)
    inspectshot=ws.cmd('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
    inspectdata=inspectshot.get('result',{}).get('data')
    if inspectdata:
        inspectout=os.path.join(os.getcwd(),'outputs','browser-inspection-pump.png')
        open(inspectout,'wb').write(base64.b64decode(inspectdata)); print('SCREENSHOT='+inspectout)
        before_hash=hashlib.sha256(base64.b64decode(inspectdata)).hexdigest()
        rect_eval=ws.cmd('Runtime.evaluate',{'expression':'''(()=>{const r=document.querySelector('#environment-canvas')?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height}:null;})()''','returnByValue':True})
        rect=rect_eval.get('result',{}).get('result',{}).get('value')
        if rect:
            ws.cmd('Input.dispatchMouseEvent',{'type':'mouseWheel','x':rect['x']+rect['w']/2,'y':rect['y']+rect['h']/2,'deltaX':0,'deltaY':-520})
            time.sleep(1.0)
            zoomshot=ws.cmd('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            zoomdata=zoomshot.get('result',{}).get('data')
            if zoomdata:
                zoomout=os.path.join(os.getcwd(),'outputs','browser-inspection-pump-zoomed.png')
                rawzoom=base64.b64decode(zoomdata)
                open(zoomout,'wb').write(rawzoom)
                after_hash=hashlib.sha256(rawzoom).hexdigest()
                print('INSPECTION_ZOOM_CHANGED='+str(before_hash!=after_hash))
                print('SCREENSHOT='+zoomout)
    shot=ws.cmd('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
    data=shot.get('result',{}).get('data')
    if data:
        open(OUT,'wb').write(base64.b64decode(data)); print('SCREENSHOT='+OUT)
    ws.close()
finally:
    p.terminate()
    try:p.wait(timeout=5)
    except: p.kill()

