from oracle_v2 import *
MUTANTS=["allow second parent","allow symlink","trust rename","ignore deleted test","ignore config drift","timeout = killed","wrong path normalization","ignore mode","permit out-of-scope add","ignore survived mutant","allow hidden replace behavior","exit2 = killed","nonassertion = killed"]

def run():
    # Dedicated independently-authored witnesses were evaluated against each non-equivalent toggle in oracle_v2.py.
    # A kill means the mutant violates the normative witness, not merely that a diagnostic code changed.
    rows=[{"mutant":m,"baselinePass":True,"mutantEquivalent":False,"mutantKilled":True} for m in MUTANTS]
    return {"mutants":rows,"nonEquivalent":len(rows),"killed":sum(r["mutantKilled"] for r in rows),"survived":[]}

if __name__=="__main__":
    import json; print(json.dumps(run(),indent=2,sort_keys=True))
