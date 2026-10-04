# Fixture / reproduction package

Purpose: reproduce the execution-isolation probes with canary-only data. No real credentials and no productive GitHub workflow are used.

Environment observed in the audit: Node v22.16.0, npm 10.9.2, Git 2.47.3. Docker was unavailable and `unshare -n` was denied.

Run:

```bash
python3 run_lab.py
```

The script creates only temporary repositories/directories, executes 44 fixture classes, prints a JSON summary, and removes nothing outside its own temp root. It deliberately demonstrates hostile capabilities on the local host profile; exposed cases are expected evidence for the missing inner sandbox, not successful security containment.
