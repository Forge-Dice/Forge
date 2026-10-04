"""Test-side driver: lets Vitest call the Task A Python API in one batch process.

Not part of the verifier and never loaded by stage0. Reads JSON lines from stdin, writes one
JSON line per request to stdout.

Request:  {"fn": "module.function", "args": [...], "kwargs": {...}}
Encodings in both directions: {"$b": "<hex>"} is bytes, {"$set": [...]} is a frozenset,
{"$store": {"odb": ..., "private": ..., ...}} becomes objects.ObjectStore(**fields).
Response: {"ok": <encoded result>} or {"fail": <ForgeFail.record()>} or {"error": "<type>"}.
"""

import dataclasses
import importlib
import json
import os
import sys

sys.dont_write_bytecode = True  # never leave __pycache__ in the checkout

TOOLS = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "tools", "forge_v01")
sys.path.insert(0, TOOLS)

from errors import ForgeFail  # noqa: E402

_stores = []


def decode(value):
    if isinstance(value, dict):
        if set(value) == {"$b"}:
            return bytes.fromhex(value["$b"])
        if set(value) == {"$set"}:
            return frozenset(decode(v) for v in value["$set"])
        if set(value) == {"$store"}:
            objects = importlib.import_module("objects")
            store = objects.ObjectStore(**{k: decode(v) for k, v in value["$store"].items()})
            _stores.append(store)
            return store
        return {k: decode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [decode(v) for v in value]
    return value


def encode(value):
    if isinstance(value, (bytes, bytearray)):
        return {"$b": bytes(value).hex()}
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {f.name: encode(getattr(value, f.name)) for f in dataclasses.fields(value)}
    if isinstance(value, (frozenset, set)):
        return sorted((encode(v) for v in value), key=json.dumps)
    if isinstance(value, (list, tuple)):
        return [encode(v) for v in value]
    if isinstance(value, dict):
        return {str(k): encode(v) for k, v in value.items()}
    return value


def call(request):
    module_name, _, fn_name = request["fn"].partition(".")
    fn = getattr(importlib.import_module(module_name), fn_name)
    try:
        return {"ok": encode(fn(*decode(request.get("args", [])), **decode(request.get("kwargs", {}))))}
    except ForgeFail as failure:
        return {"fail": failure.record()}
    finally:
        while _stores:
            _stores.pop().close()


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            response = call(json.loads(line))
        except ForgeFail as failure:
            response = {"fail": failure.record()}
        except Exception as exc:  # reported, never swallowed: the test sees the type
            response = {"error": type(exc).__name__}
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
