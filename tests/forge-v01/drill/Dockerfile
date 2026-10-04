# LOCAL DRILL ONLY. NOT the release image. Never deploy, never put its digest into the trusted workflow.
#
# Builds forge-v01-local:sandbox for `npm run forge:drill` (tests/forge-v01/drill/drill.sh) from the same
# layout as tools/forge_v01/Dockerfile, while that recipe's inputs are still unresolved
# (forge/verifier/image-inputs.json). Differences from the release recipe:
#  1. Python 3.12.14 is copied from the official docker.io/library/python:3.12.14-slim-bookworm image
#     (pinned by digest) instead of compiled from python.org; git is built with the release make line from
#     Ubuntu's pinned-snapshot git_2.51.0.orig.tar.xz (2.51.1 has no resolved hash yet).
#  2. Archives are fetched by drill.sh on the host, sha256-checked there and again here, and COPY'd.
#  3. Optional TLS-intercepting proxy: if drill.sh got FORGE_DRILL_CA, apt and the worker's npm trust it.
# Kernel files (/opt/forge/bootstrap) come from the working tree; the FORGE-LAYOUT block of the release
# Dockerfile is spliced in at #@REPO_LAYOUT_FIXES@ by drill.sh.
ARG UBUNTU_DIGEST
ARG PYTHON_IMAGE
FROM ${PYTHON_IMAGE} AS python-substitute

FROM docker.io/library/ubuntu@${UBUNTU_DIGEST} AS build
ARG UBUNTU_SNAPSHOT
ARG GIT_SHA256
ARG NODE_SHA256
ARG NPM_SHA256
ARG ZOD_SHA256
ARG DOCKER_CLI_SHA256
ARG KERNEL_COMMIT
SHELL ["/bin/bash", "-euo", "pipefail", "-c"]
RUN for v in UBUNTU_SNAPSHOT GIT_SHA256 NODE_SHA256 NPM_SHA256 ZOD_SHA256 DOCKER_CLI_SHA256 KERNEL_COMMIT; do \
      test -n "${!v}" || { echo "unresolved image input: $v" >&2; exit 1; }; done
RUN --mount=type=secret,id=drill_ca,required=false,mode=0444 \
    ca=(); if [ -s /run/secrets/drill_ca ]; then ca=(-o Acquire::https::CAInfo=/run/secrets/drill_ca); fi \
 && apt-get "${ca[@]}" update --snapshot "${UBUNTU_SNAPSHOT}" \
 && apt-get "${ca[@]}" install -y --no-install-recommends --snapshot "${UBUNTU_SNAPSHOT}" \
      ca-certificates curl xz-utils build-essential pkg-config libssl-dev zlib1g-dev libffi-dev \
      libbz2-dev liblzma-dev libsqlite3-dev libreadline-dev libexpat1-dev libcurl4-openssl-dev gettext
WORKDIR /src
COPY node.tar.xz npm.tgz zod.tgz docker.tgz git.tar.xz /src/
RUN check() { echo "$2  $1" | sha256sum -c --strict -; } \
 && check git.tar.xz "${GIT_SHA256}" && check node.tar.xz "${NODE_SHA256}" && check npm.tgz "${NPM_SHA256}" \
 && check zod.tgz "${ZOD_SHA256}" && check docker.tgz "${DOCKER_CLI_SHA256}"
RUN mkdir git && tar -xJf git.tar.xz -C git --strip-components=1 && cd git \
 && make -j"$(nproc)" prefix=/usr NO_TCLTK=1 NO_PERL=1 NO_PYTHON=1 NO_GETTEXT=1 install
RUN mkdir -p /opt/node && tar -xJf node.tar.xz -C /opt/node --strip-components=1 \
 && rm -rf /opt/node/lib/node_modules/npm /opt/node/lib/node_modules/corepack /opt/node/bin/corepack \
 && mkdir /opt/node/lib/node_modules/npm && tar -xzf npm.tgz -C /opt/node/lib/node_modules/npm --strip-components=1 \
 && ln -sf ../lib/node_modules/npm/bin/npm-cli.js /opt/node/bin/npm \
 && mkdir -p /trusted/node_modules/zod && tar -xzf zod.tgz -C /trusted/node_modules/zod --strip-components=1 \
 && tar -xzf docker.tgz -C /usr/local/bin --strip-components=1 docker/docker
COPY kernel/stage0.py kernel/errors.py kernel/process.py kernel/paths.py kernel/objects.py kernel/materialize.py kernel/odb_layout.py kernel/bootstrap.py /opt/forge/bootstrap/
RUN echo "${KERNEL_COMMIT}" > /opt/forge/bootstrap/KERNEL_COMMIT

FROM docker.io/library/ubuntu@${UBUNTU_DIGEST}
ARG UBUNTU_SNAPSHOT
SHELL ["/bin/bash", "-euo", "pipefail", "-c"]
RUN --mount=type=secret,id=drill_ca,required=false,mode=0444 \
    ca=(); if [ -s /run/secrets/drill_ca ]; then ca=(-o Acquire::https::CAInfo=/run/secrets/drill_ca); fi \
 && apt-get "${ca[@]}" update --snapshot "${UBUNTU_SNAPSHOT}" \
 && apt-get "${ca[@]}" install -y --no-install-recommends --snapshot "${UBUNTU_SNAPSHOT}" ca-certificates libssl3t64 zlib1g libffi8 libexpat1 libcurl4t64 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=python-substitute /usr/local /opt/python
COPY --from=build /opt/node /opt/node
COPY --from=build /usr/bin/git /usr/bin/git
COPY --from=build /usr/libexec/git-core /usr/libexec/git-core
COPY --from=build /trusted/node_modules /trusted/node_modules
COPY --from=build /usr/local/bin/docker /usr/bin/docker
COPY --from=build /opt/forge/bootstrap /opt/forge/bootstrap
RUN --mount=type=secret,id=drill_ca,required=false,mode=0444 \
    if [ -s /run/secrets/drill_ca ]; then install -m 0444 /run/secrets/drill_ca /etc/forge-drill-ca.pem \
      && printf 'cafile=/etc/forge-drill-ca.pem\n' > /opt/node/lib/node_modules/npm/npmrc; fi
#@REPO_LAYOUT_FIXES@
RUN chmod -R a-w /opt/forge/bootstrap /trusted \
 && /opt/python/bin/python3.12 -I -c "import sys; assert sys.version_info[:3] == (3, 12, 14)" \
 && /usr/bin/git --version | grep -qx "git version 2.51.0" \
 && test "$(/opt/node/bin/node --version)" = "v24.19.0" \
 && test "$(PATH=/opt/node/bin:/usr/bin:/bin /opt/node/bin/npm --version)" = "11.9.0"
WORKDIR /opt/forge/bootstrap
LABEL org.forge.drill="local drill only, not the release image"
ENTRYPOINT ["/opt/python/bin/python3.12", "-I", "-B", "/opt/forge/bootstrap/stage0.py"]
