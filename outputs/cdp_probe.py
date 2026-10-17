import subprocess, json, time, os, sys
chrome=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
profile=os.path.join(os.environ.get('TEMP','.'),'pulpa-lab-pipe')
args=[chrome,'--headless=new','--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--no-sandbox',f'--user-data-dir={profile}','http://127.0.0.1:4173']
p=subprocess.Popen(args,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
def send(obj):
    p.stdin.write(json.dumps(obj).encode()+b'\0'); p.stdin.flush()
def recv(timeout=5):
    data=b''; start=time.time()
    while time.time()-start<timeout:
        b=p.stdout.read(1)
        if not b: break
        if b==b'\0':
            if data: return json.loads(data)
            continue
        data+=b
    return None
send({'id':1,'method':'Target.getTargets'})
print(recv(5))
p.terminate()
