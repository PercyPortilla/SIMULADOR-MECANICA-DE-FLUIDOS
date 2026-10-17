import subprocess, urllib.request, time, os, json
chrome=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
profile=os.path.join(os.environ.get('TEMP','.'),'pulpa-lab-port')
args=[chrome,'--headless=new','--remote-debugging-port=9222','--remote-allow-origins=*','--no-first-run','--no-default-browser-check','--no-sandbox',f'--user-data-dir={profile}','http://127.0.0.1:4173']
p=subprocess.Popen(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
for i in range(30):
    try:
        data=json.load(urllib.request.urlopen('http://127.0.0.1:9222/json',timeout=1))
        print(json.dumps(data,indent=2)); break
    except Exception as e:
        time.sleep(.2)
else:
    print('FAILED',p.poll(),p.stderr.read().decode(errors='replace')[:2000])
p.terminate()
