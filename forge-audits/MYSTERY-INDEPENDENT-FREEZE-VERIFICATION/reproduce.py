"""Offline, stdlib-only replay of this lab; leaves checked-in artifacts untouched."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent
REPORT = "MYSTERY-INDEPENDENT-FREEZE-VERIFICATION.html"

def extract_checked(archive, target):
    target = target.resolve()
    with zipfile.ZipFile(archive) as z:
        for member in z.infolist():
            resolved = (target / member.filename).resolve()
            if not resolved.is_relative_to(target):
                raise ValueError("Unsafe archive path")
            if (member.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError("Archive symlink rejected")
        z.extractall(target)

for line in (ROOT / "SHA256SUMS").read_text().splitlines():
    digest, name = line.split("  ", 1)
    assert Path(name).name == name
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest, name

work = Path(tempfile.mkdtemp(prefix="mystery-freeze-reproduction-"))
for name in ["probe.py", "build_report.py", "FREEZE-CRITERIA-PRECOMMITTED.md"]:
    shutil.copyfile(ROOT / name, work / name)
extract_checked(ROOT / "EVIDENCE.zip", work)
extract_checked(
    work / "evidence/library/DIE-LEERE-VITRINE-CASE-PACK.zip",
    work / "evidence/archives/DIE-LEERE-VITRINE-CASE-PACK",
)
with (work / "probe-run.log").open("w") as log:
    subprocess.run([sys.executable, str(work / "probe.py")], cwd=work,
                   stdout=log, stderr=subprocess.STDOUT, check=True)
subprocess.run([sys.executable, str(work / "build_report.py")], cwd=work, check=True)
checks = {}
for name in ["probe-results.json", "probe-run.log", REPORT]:
    checks[name] = (ROOT / name).read_bytes() == (work / name).read_bytes()
assert all(checks.values()), checks
print(json.dumps({"result": "PASS", "identical": checks,
                  "working_directory": str(work)}, ensure_ascii=False))
