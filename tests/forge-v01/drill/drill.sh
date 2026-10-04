#!/usr/bin/env bash
# LOCAL DRILL ONLY: `npm run forge:drill` [-- --rebuild]
#
# 1. Builds forge-v01-local:sandbox from tests/forge-v01/drill/Dockerfile (NOT the release image) when it
#    is missing or its inputs (drill Dockerfile, image kernel files, release FORGE-LAYOUT block) changed.
# 2. Runs tests/forge-v01/drill.test.ts verbosely: stage0.main inside that image, real DockerRunner,
#    fake GitHub; one expected/actual table per case and a summary table at the end.
#
# Needs: docker (BuildKit, containerd image store so local images carry a RepoDigest), curl, python3, node.
# Env: FORGE_DOCKER_HOST (default: $DOCKER_HOST, else unix:///var/run/docker.sock)
#      FORGE_DRILL_CACHE  archive cache (default: ~/.cache/forge-drill)
#      FORGE_DRILL_CA     optional CA bundle of a TLS-intercepting proxy (apt in the build, npm in the worker)
set -euo pipefail
REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
DRILL=$REPO/tests/forge-v01/drill
TAG=forge-v01-local:sandbox
export FORGE_DOCKER_HOST=${FORGE_DOCKER_HOST:-${DOCKER_HOST:-unix:///var/run/docker.sock}}
export DOCKER_HOST=$FORGE_DOCKER_HOST
CACHE=${FORGE_DRILL_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/forge-drill}
KERNEL=(stage0 errors process paths objects materialize odb_layout bootstrap)

# name|url|sha256 (node/npm/zod as in forge/verifier/image-inputs.json; git and docker CLI: drill pins)
ARCHIVES=(
  "node.tar.xz|https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz|14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647"
  "npm.tgz|https://registry.npmjs.org/npm/-/npm-11.9.0.tgz|5a172e3228e59d44cb9f44d5e83977178323bba3cc506016cae8e40b92ad418f"
  "zod.tgz|https://registry.npmjs.org/zod/-/zod-4.6.5.tgz|a78c0c533de30dc1c4afc259ac43ac06e390cb0da8d2e32eae355301b50b36fc"
  "git.tar.xz|https://snapshot.ubuntu.com/ubuntu/20261001T000000Z/pool/main/g/git/git_2.51.0.orig.tar.xz|60a7c2251cc2e588d5cd87bae567260617c6de0c22dca9cdbfc4c7d2b8990b62"
  "docker.tgz|https://download.docker.com/linux/static/stable/x86_64/docker-29.8.2.tgz|995d1ef289677f74fd58d8d2c35727b6a4ee389c69db8638a3e42d0487aa5b0f"
)

inputs_hash() {
  { cat "$DRILL/Dockerfile" "$REPO/tools/forge_v01/Dockerfile"; for f in "${KERNEL[@]}"; do cat "$REPO/tools/forge_v01/$f.py"; done; } | sha256sum | cut -c1-64
}

build() {
  local ctx; ctx=$(mktemp -d "${TMPDIR:-/tmp}/forge-drill-ctx.XXXXXX")
  trap 'rm -rf "$ctx"' RETURN
  mkdir -p "$CACHE" "$ctx/kernel"
  for row in "${ARCHIVES[@]}"; do
    IFS='|' read -r name url sum <<<"$row"
    if ! echo "$sum  $CACHE/$name" | sha256sum -c --strict --status - 2>/dev/null; then
      echo "fetch $url"
      curl --proto '=https' --tlsv1.2 -fsSLo "$CACHE/$name.part" "$url"
      echo "$sum  $CACHE/$name.part" | sha256sum -c --strict - && mv "$CACHE/$name.part" "$CACHE/$name"
    fi
    cp "$CACHE/$name" "$ctx/$name"
  done
  for f in "${KERNEL[@]}"; do cp "$REPO/tools/forge_v01/$f.py" "$ctx/kernel/"; done
  python3 - "$REPO/tools/forge_v01/Dockerfile" "$DRILL/Dockerfile" "$ctx/Dockerfile" <<'PY'
import re, sys
release, drill = open(sys.argv[1]).read(), open(sys.argv[2]).read()
m = re.search(r"^# FORGE-LAYOUT-BEGIN.*?^# FORGE-LAYOUT-END[^\n]*\n", release, re.S | re.M)
open(sys.argv[3], "w").write(drill.replace("#@REPO_LAYOUT_FIXES@\n", m.group(0) if m else ""))
PY
  local secret=()
  [ -n "${FORGE_DRILL_CA:-}" ] && secret=(--secret "id=drill_ca,src=$FORGE_DRILL_CA")
  docker buildx build --load -t "$TAG" "${secret[@]}" \
    --label "org.forge.drill.inputs=$(inputs_hash)" \
    --build-arg UBUNTU_DIGEST=sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55 \
    --build-arg PYTHON_IMAGE=docker.io/library/python:3.12.14-slim-bookworm@sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e \
    --build-arg UBUNTU_SNAPSHOT=20261001T000000Z \
    --build-arg GIT_SHA256=60a7c2251cc2e588d5cd87bae567260617c6de0c22dca9cdbfc4c7d2b8990b62 \
    --build-arg NODE_SHA256=14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647 \
    --build-arg NPM_SHA256=5a172e3228e59d44cb9f44d5e83977178323bba3cc506016cae8e40b92ad418f \
    --build-arg ZOD_SHA256=a78c0c533de30dc1c4afc259ac43ac06e390cb0da8d2e32eae355301b50b36fc \
    --build-arg DOCKER_CLI_SHA256=995d1ef289677f74fd58d8d2c35727b6a4ee389c69db8638a3e42d0487aa5b0f \
    --build-arg "KERNEL_COMMIT=$(git -C "$REPO" rev-parse HEAD)" \
    -f "$ctx/Dockerfile" "$ctx"
}

current=$(docker image inspect "$TAG" --format '{{index .Config.Labels "org.forge.drill.inputs"}}' 2>/dev/null || true)
if [ "${1:-}" = "--rebuild" ] || [ "$current" != "$(inputs_hash)" ]; then
  echo "building $TAG (LOCAL DRILL ONLY) ..."
  build
fi
if ! docker image inspect "$TAG" --format '{{json .RepoDigests}}' | grep -q "forge-v01-local@sha256:"; then
  echo "$TAG has no RepoDigest: enable the containerd image store (Docker Desktop: Settings > General) and rebuild." >&2
  exit 1
fi
cd "$REPO"
exec npx vitest run tests/forge-v01/drill.test.ts --reporter=verbose
