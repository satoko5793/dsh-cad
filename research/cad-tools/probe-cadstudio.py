import json, math, pathlib, urllib.request
import cadquery as cq

ROOT=pathlib.Path(__file__).resolve().parent
OUT=ROOT/'evidence'/'cadstudio'; OUT.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:3101'
def call(route,payload=None,method=None):
    data=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(BASE+route,data=data,method=method or ('POST' if data else 'GET'),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=90) as response:return json.load(response)
def shape(label):
    file=OUT/f'{label}.step'; urllib.request.urlretrieve(BASE+'/api/export/step',file)
    wp=cq.importers.importStep(str(file)); s=wp.val();b=s.BoundingBox()
    return {'size':[b.xlen,b.ylen,b.zlen],'volume':s.Volume(),'solids':len(s.Solids()),'valid':s.isValid(),'step_bytes':file.stat().st_size}
def sketch(diameter):
    points=[(-40,-20),(40,-20),(40,20),(-40,20)]
    loops=[[{'type':'line','x1':a[0],'y1':a[1],'x2':b[0],'y2':b[1]} for a,b in zip(points,points[1:]+points[:1])]]
    loops.extend([[{'type':'circle','cx':x,'cy':y,'r':diameter/2}] for x,y in [(-32,-12),(32,-12),(-32,12),(32,12)]])
    return {'plane':'XY','loops':loops}

results={}
call('/api/reset',{})
call('/api/feature',{'feature':{'id':'profile','type':'sketch','name':'Plate and four holes','params':sketch(6)}})
call('/api/feature',{'feature':{'id':'plate','type':'extrude','name':'Plate extrusion','params':{'sketch':'profile','distance':5,'operation':'new'}}})
results['initial']=shape('plate-v1')
assert abs(results['initial']['volume']-(80*40*5-4*math.pi*9*5))<.01
call('/api/feature/profile',{'params':sketch(8)},'PATCH')
call('/api/feature/plate',{'params':{'sketch':'profile','distance':8,'operation':'new'}},'PATCH')
results['modified']=shape('plate-v2')
assert abs(results['modified']['volume']-(80*40*8-4*math.pi*16*8))<.01
call('/api/undo',{})
results['undo']=shape('undo')
assert abs(results['undo']['size'][2]-5)<1e-6
call('/api/redo',{})
results['redo']=shape('redo')
assert abs(results['redo']['size'][2]-8)<1e-6
code=call('/api/code')['code'];(OUT/'exported.py').write_text(code,encoding='utf8')
reply=call('/api/run_code',{'code':code})
results['code_roundtrip']={'ok':reply.get('ok'),'method':reply.get('method'),'feature_count':len(reply.get('features',[]))}
features=call('/api/features');(OUT/'features.json').write_text(json.dumps(features,indent=2),encoding='utf8')
results['final']=shape('plate-final')
urllib.request.urlretrieve(BASE+'/api/export/stl',OUT/'plate-final.stl')
(OUT/'results.json').write_text(json.dumps(results,indent=2),encoding='utf8')
print(json.dumps(results,ensure_ascii=False,indent=2))
