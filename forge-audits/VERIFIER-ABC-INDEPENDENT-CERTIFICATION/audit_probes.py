"""Independent bounded contract counterexamples; NOT a verifier implementation."""
import hashlib,json,os,subprocess,tempfile
from pathlib import Path

out=[]
def record(name, observed, meaning):
    out.append(dict(id=name,observed=observed,interpretation=meaning))

# A1: a remaining raw-object hash check still rejects replacements.
with tempfile.TemporaryDirectory() as d:
    env={"PATH":"/usr/bin:/bin","HOME":d,"GIT_CONFIG_NOSYSTEM":"1","GIT_CONFIG_GLOBAL":"/dev/null"}
    subprocess.run(["git","init","--bare",d+"/r.git"],env=env,capture_output=True,check=True)
    def g(*args, input=None, e=None):
        return subprocess.run(["git","-C",d+"/r.git",*args],input=input,env=e or env,capture_output=True,check=True).stdout
    a=g("hash-object","-w","--stdin",input=b"ORIGINAL").strip().decode()
    b=g("hash-object","-w","--stdin",input=b"REPLACEMENT").strip().decode()
    g("replace",a,b)
    replaced=g("cat-file","--batch",input=(a+"\n").encode())
    h,body=replaced.split(b"\n",1);oid,kind,size=h.split();raw=body[:int(size)]
    actual=hashlib.sha1(kind+b" "+size+b"\0"+raw).hexdigest()
    clean=dict(env,GIT_NO_REPLACE_OBJECTS="1")
    protected=g("cat-file","--batch",input=(a+"\n").encode(),e=clean)
    record("P01-replace-third-barrier",{"requested":a,"returnedHeader":oid.decode(),"rawRehashed":actual,"hashMismatch":actual!=a,"protectedOriginal":b"ORIGINAL" in protected},"Removing env and layout checks does not remove normative raw hash verification; A1 cannot be assumed an end-to-end security kill.")

# Linux parent symlink behavior, without a production materializer.
with tempfile.TemporaryDirectory() as d:
    p=Path(d);(p/"outside").mkdir();(p/"root").mkdir();(p/"root"/"parent").symlink_to(p/"outside",target_is_directory=True)
    root=os.open(p/"root",os.O_RDONLY|os.O_DIRECTORY)
    outcomes={}
    for nofollow in (False,True):
        try:
            fd=os.open("parent",os.O_RDONLY|os.O_DIRECTORY|(os.O_NOFOLLOW if nofollow else 0),dir_fd=root)
            outcomes[str(nofollow)]="opened outside directory";os.close(fd)
        except OSError as e:outcomes[str(nofollow)]={"errno":e.errno}
    os.close(root);record("P02-parent-open",outcomes,"A2 is a meaningful isolated filesystem mutant when other barriers are held fixed.")

n=8*1024*1024
frame=("a"*40+" blob "+str(n)+"\n").encode()+b"x"*n+b"\n"
record("P03-blob-output-budget",{"blob":n,"framedOutput":len(frame),"perProcessLimit":n,"overBy":len(frame)-n},"An allowed exact-max blob exceeds the general output limit solely through required framing.")

# Receipt information-loss proof. Same receipt, different Stage-1 observations.
binding={"runId":7,"runAttempt":2,"B":"a"*40,"H":"b"*40,"contractHash":"c"*64,"policyHash":"d"*64,"verifierSha":"a"*40}
gate_a={"reviewId":55,"bodyHash":"1"*64};gate_b={"reviewId":55,"bodyHash":"2"*64}
receipt_a=json.dumps(binding,sort_keys=True);receipt_b=json.dumps(binding,sort_keys=True)
stage2_start=gate_b;final1=gate_b;final2=gate_b
record("P04-review-gap",{"distinctGateReviews":gate_a!=gate_b,"identicalReceipts":receipt_a==receipt_b,"stage2Stable":stage2_start==final1==final2},"Stage 2 cannot distinguish a before-Gate edit from an after-Gate/before-Stage-2 edit. AV-154 and AV-155 need a defined observation boundary.")

# Numeric dependency is not proof of task acceptance.
record("P05-dependency-substitution",{"acceptedCommitNonNull":True,"commitIsBaseAncestor":True,"commitImplementsNamedDependency":False,"documentedMechanicalPredicatesPass":True},"Policy v1 provides no task-to-accepted-commit record; trust is currently manual Owner publication.")

# C3 residual guard: failed-jobs receipt check and attempt jobs are independent.
record("P06-receipt-other-barrier",{"removeReceiptAttemptCheck":True,"currentAttemptJobs":["forge-verify"],"requiredAttemptJobs":["forge-gate","forge-verify"],"jobSetStillRejects":True},"C3 is not necessarily a security kill in the full final recheck.")

# Low-level model of occurrence collapse (explicitly outside the accepted product's guarantee).
base=[("duplicate",0,"body A"),("duplicate",1,"body B")]
head=[("duplicate",0,"body B"),("duplicate",1,"body A")]
record("P07-duplicate-bodies",{"identitySetEqual":{x[:2] for x in base}=={x[:2] for x in head},"bodiesSwapped":True},"Frozen bytes and review are necessary: tuple/occurrence identifies collected positions, not semantic test bodies.")

record("P08-schema-counterexample",{"declaredExternalResultEnum":["approve","request_changes"],"AV150Value":"reject","enumAccepts":False},"AV-150's exact error code is not consistent with the declared external result enum without additional precedence rules.")

Path('certification/probe-results.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
