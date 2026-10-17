import subprocess, urllib.request, time, os, json, socket, base64, struct

CHROME=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
URL='http://127.0.0.1:4173/'
PORT=9223
PROFILE=os.path.join(os.environ.get('TEMP','.'),'pulpa-lab-scientific-browser')

class WS:
    def __init__(self,url):
        rest=url[5:]; hostport,path=rest.split('/',1); path='/'+path
        host,port=(hostport.split(':',1)+['80'])[:2]
        self.s=socket.create_connection((host,int(port)),timeout=90)
        key=base64.b64encode(os.urandom(16)).decode()
        req=(f'GET {path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n')
        self.s.sendall(req.encode()); data=b''
        while b'\r\n\r\n' not in data: data+=self.s.recv(4096)
        if b' 101 ' not in data.split(b'\r\n',1)[0]: raise RuntimeError(data.decode(errors='replace'))
        self.next_id=1
    def _send(self,text):
        payload=text.encode(); mask=os.urandom(4); n=len(payload); head=bytearray([0x81])
        if n<126: head.append(0x80|n)
        elif n<65536: head.append(0x80|126); head.extend(struct.pack('!H',n))
        else: head.append(0x80|127); head.extend(struct.pack('!Q',n))
        head.extend(mask); self.s.sendall(bytes(head)+bytes(b^mask[i%4] for i,b in enumerate(payload)))
    def _recv(self):
        def exact(n):
            d=b''
            while len(d)<n:
                x=self.s.recv(n-len(d))
                if not x: raise EOFError()
                d+=x
            return d
        while True:
            b1,b2=exact(2); op=b1&0xf; n=b2&0x7f
            if n==126:n=struct.unpack('!H',exact(2))[0]
            elif n==127:n=struct.unpack('!Q',exact(8))[0]
            mask=exact(4) if b2&0x80 else None; data=exact(n)
            if mask:data=bytes(b^mask[i%4] for i,b in enumerate(data))
            if op==9:self.s.sendall(bytes([0x8a,len(data)])+data);continue
            if op==1:return json.loads(data.decode())
            if op==8:raise EOFError('closed')
    def cmd(self,method,params=None):
        i=self.next_id; self.next_id+=1; obj={'id':i,'method':method}
        if params is not None:obj['params']=params
        self._send(json.dumps(obj,separators=(',',':')))
        while True:
            msg=self._recv()
            if msg.get('id')==i:return msg
    def close(self):self.s.close()

os.makedirs(os.path.join(os.getcwd(),'outputs'),exist_ok=True)
args=[CHROME,'--headless=new',f'--remote-debugging-port={PORT}','--remote-allow-origins=*','--no-first-run','--no-default-browser-check','--no-sandbox',f'--user-data-dir={PROFILE}','--window-size=1600,1100','--use-angle=swiftshader-webgl','--enable-webgl',URL]
p=subprocess.Popen(args,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(60):
        try:
            targets=json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json',timeout=1)); pages=[t for t in targets if t.get('type')=='page' and t.get('url')==URL]
            if pages:break
        except Exception:pass
        time.sleep(.25)
    else:raise RuntimeError('Chrome DevTools no disponible')
    ws=WS(pages[0]['webSocketDebuggerUrl']); ws.cmd('Runtime.enable'); ws.cmd('Page.enable'); time.sleep(20)
    setup=ws.cmd('Runtime.evaluate',{'expression':r'''(async()=>{
      window.__qaErrors=[]; window.addEventListener('error',e=>window.__qaErrors.push(String(e.message||e.error)));
      localStorage.removeItem('pulpa-lab-simulation-scenarios-v2');
      localStorage.removeItem('pulpa-lab-simulation-scenario-v1');
      const stateModule=await import('/src/state/simulationState.js');
      stateModule.resetState();
      stateModule.updateState({
        slurry:{solidsMassFraction:.35,solidDensityKgM3:4200,liquidDensityKgM3:1000,referenceSolidsMassFraction:.35,temperatureC:25,referenceTemperatureC:25,d50M:.0001,d80M:.0002},
        rheology:{model:'hb',yieldStressPa:20,consistencyIndex:.8,flowIndex:.55,concentrationExponent:2,empiricalScalingEnabled:false},
        transport:{settlingFactorFl:1.34,pipe1:{innerDiameterM:.15,lengthM:100,velocityMps:1.5,roughnessM:.000046,minorLossCoefficient:0,elevationChangeM:0,accessories:{valvesCount:1,valveK:.2,elbowsCount:2,elbowK:.9,teesCount:0,teeK:1.8,reducersCount:1,reducerK:.4,otherK:0}}},
        energy:{pumpEfficiency:.75,motorEfficiency:1,operatingHoursPerYear:8000,electricityPricePerKwh:.12},
        process:{tankDischargeM3h:95.43,tankVolumeM3:50,balanceToleranceFraction:.05},
        leaching:{kineticModel:'first-order-cstr-series',totalUsefulVolumeM3:50,reactorCount:4,firstOrderRateConstantPerH:.1,temperatureC:25,ph:2,feedGradeGL:5},
        recovery:{model:'stage-efficiency',feedGoldKgH:10,adsorptionEfficiency:.9,elutionEfficiency:.8,electrowinningEfficiency:.95,smeltingEfficiency:.98}
      });
      await new Promise(r=>setTimeout(r,500));
      const name=document.querySelector('#scenario-name'); if(name)name.value='QA científico'; document.querySelector('#scenario-save')?.click();
      stateModule.updateState({transport:{pipe1:{velocityMps:1.6}}}); await new Promise(r=>setTimeout(r,120)); document.querySelector('#scenario-compare')?.click();
      document.querySelector('[data-palette-preset="upn"]')?.click();
      let fullscreenActual=false;
      try{
        const card=document.querySelector('.scene-card'); const button=document.querySelector('#scene-fullscreen');
        button?.click(); await new Promise(r=>setTimeout(r,250));
        fullscreenActual=document.fullscreenElement===card||card?.classList.contains('is-pseudo-fullscreen');
        button?.click(); await new Promise(r=>setTimeout(r,120));
        if(document.fullscreenElement)await document.exitFullscreen();
      }catch(_error){}
      window.__fullscreenActual=fullscreenActual;
      return true;
    })()''','awaitPromise':True,'returnByValue':True,'userGesture':True})
    if setup.get('result',{}).get('result',{}).get('subtype')=='error':raise RuntimeError(setup['result']['result'].get('description'))
    time.sleep(1)
    validation=ws.cmd('Runtime.evaluate',{'expression':r'''(()=>({
      logo:Boolean(document.querySelector('.brand-logo[src="/upn-logo.svg"]')),
      tabs:[...document.querySelectorAll('[data-workspace-tab]')].map(b=>b.dataset.workspaceTab),
      paletteCount:document.querySelectorAll('[data-palette-preset]').length,
      accent:getComputedStyle(document.documentElement).getPropertyValue('--ui-accent').trim(),
      scenarioCompact:Boolean(document.querySelector('.scenario-primary-row')),
      scenarioComparisonRows:document.querySelectorAll('#scenario-comparison tbody tr').length,
      fullscreenButton:Boolean(document.querySelector('#scene-fullscreen')),
      fullscreenApi:typeof document.querySelector('.scene-card')?.requestFullscreen==='function',
      fullscreenActual:Boolean(window.__fullscreenActual),
      canvas:[document.querySelector('#environment-canvas')?.width||0,document.querySelector('#environment-canvas')?.height||0],
      sceneErrorHidden:document.querySelector('#scene-error')?.hidden===true,
      sceneErrorText:document.querySelector('#scene-error')?.textContent||'',
      errors:window.__qaErrors||[]
    }))()''','returnByValue':True}).get('result',{}).get('result',{}).get('value')
    print('SCIENTIFIC_PREFLIGHT='+json.dumps(validation,ensure_ascii=False))
    summaries={}
    for tab in ['circuit','curves','balance','memory']:
        ev=ws.cmd('Runtime.evaluate',{'expression':f'''(async()=>{{document.querySelector('[data-workspace-tab="{tab}"]')?.click();await new Promise(r=>setTimeout(r,{1600 if tab=='curves' else 700}));const root=document.querySelector('[data-tab-panel="{tab}"]');root?.scrollIntoView({{block:'start'}});return {{tab:'{tab}',charts:root?.querySelectorAll('.science-chart').length||0,probeMetrics:root?.querySelectorAll('.probe-metrics div').length||0,balanceCards:root?.querySelectorAll('.balance-card').length||0,sensitivity:Boolean(root?.querySelector('.sensitivity-panel')),memoSections:root?.querySelectorAll('.calculation-memo section').length||0,memoPdf:Boolean(root?.querySelector('#memo-pdf')),memoCsv:Boolean(root?.querySelector('#memo-csv'))}};}})()''','awaitPromise':True,'returnByValue':True})
        value=ev.get('result',{}).get('result',{}).get('value'); summaries[tab]=value
        shot=ws.cmd('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False}); data=shot.get('result',{}).get('data')
        if data:
            filename=os.path.join(os.getcwd(),'outputs',f'browser-tab-{tab}.png'); open(filename,'wb').write(base64.b64decode(data)); print('SCREENSHOT='+filename)
    print('SCIENTIFIC_TABS='+json.dumps(summaries,ensure_ascii=False))
    ws.close()
finally:
    p.terminate()
    try:p.wait(timeout=5)
    except: p.kill()
