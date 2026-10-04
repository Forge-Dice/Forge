"""Independent standard-library golden check. Does not call/import the Node model."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parent
data=json.loads((root/'golden-vectors.json').read_text())
def utf16(s): return s.encode('utf-16-be')
def canonical(x,sets=False):
    if isinstance(x,dict):
        return '{'+','.join(json.dumps(k,ensure_ascii=False,separators=(',',':'))+':'+canonical(x[k],sets) for k in sorted(x,key=utf16))+'}'
    if isinstance(x,list):
        parts=[canonical(v,sets) for v in x]
        if sets: parts.sort(key=utf16)
        return '['+','.join(parts)+']'
    return json.dumps(x,ensure_ascii=False,separators=(',',':'))
checks=[]
for v in data['vectors']:
    c=canonical(v['input'],v['kind']=='set')
    digest=hashlib.sha256((v['profile']+'\n'+c).encode()).hexdigest()
    assert c==v['canonical'] and digest==v['digest'],v['id']
    checks.append({'id':v['id'],'digest':digest,'passed':True})
alphabet='0123456789abcdefghjkmnpqrstvwxyz'
for v in data['refVectors']:
    digest=hashlib.sha256(v['preimage'].encode()).digest()
    n=int.from_bytes(digest[:10],'big')
    ref='pr1_'+''.join(alphabet[(n>>(5*i))&31] for i in range(15,-1,-1))
    assert ref==v['expected']==v['actual']
    checks.append({'id':v['kind']+'/'+v['id']+'/'+v['salt'],'ref':ref,'passed':True})
result={'implementation':'Python hashlib + separately implemented UTF-16-key JSON serializer','hashVectors':len(data['vectors']),'refVectors':len(data['refVectors']),'checks':checks,'failed':0}
(root/'golden-verification.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'hashVectors':len(data['vectors']),'refVectors':len(data['refVectors']),'failed':0}))
