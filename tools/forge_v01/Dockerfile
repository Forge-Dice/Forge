# Forge V0.1 tool image (PKG §2 "Stage 0", §6; contract C §13).
#
# Every input comes from forge/verifier/image-inputs.json and is passed as a build ARG. No ARG has a
# default: a build without the real, resolved inputs fails at FROM or at the first checksum. Tool
# archives are verified by SHA-256 before use; nothing is installed from an unpinned "latest" source.
# Build packages come only from the pinned Ubuntu snapshot. The OCI digest of the result is a build
# output and is never written back into this file.

ARG UBUNTU_DIGEST
FROM docker.io/library/ubuntu@${UBUNTU_DIGEST} AS build
ARG UBUNTU_SNAPSHOT
ARG PYTHON_SHA256
ARG GIT_SHA256
ARG NODE_SHA256
ARG NPM_SHA256
ARG ZOD_SHA256
ARG DOCKER_CLI_VERSION
ARG DOCKER_CLI_SHA256
ARG KERNEL_COMMIT
SHELL ["/bin/bash", "-euo", "pipefail", "-c"]
RUN for v in UBUNTU_SNAPSHOT PYTHON_SHA256 GIT_SHA256 NODE_SHA256 NPM_SHA256 ZOD_SHA256 DOCKER_CLI_VERSION DOCKER_CLI_SHA256 KERNEL_COMMIT; do \
      test -n "${!v}" || { echo "unresolved image input: $v" >&2; exit 1; }; done
RUN apt-get update --snapshot "${UBUNTU_SNAPSHOT}" \
 && apt-get install -y --no-install-recommends --snapshot "${UBUNTU_SNAPSHOT}" \
      ca-certificates curl xz-utils build-essential pkg-config libssl-dev zlib1g-dev libffi-dev \
      libbz2-dev liblzma-dev libsqlite3-dev libreadline-dev libexpat1-dev libcurl4-openssl-dev gettext
WORKDIR /src
RUN fetch() { curl --proto '=https' --tlsv1.2 -fsSLo "$2" "$1" && echo "$3  $2" | sha256sum -c --strict -; } \
 && fetch https://www.python.org/ftp/python/3.12.14/Python-3.12.14.tar.xz python.tar.xz "${PYTHON_SHA256}" \
 && fetch https://www.kernel.org/pub/software/scm/git/git-2.51.1.tar.xz git.tar.xz "${GIT_SHA256}" \
 && fetch https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz node.tar.xz "${NODE_SHA256}" \
 && fetch https://registry.npmjs.org/npm/-/npm-11.9.0.tgz npm.tgz "${NPM_SHA256}" \
 && fetch https://registry.npmjs.org/zod/-/zod-4.6.5.tgz zod.tgz "${ZOD_SHA256}" \
 && fetch "https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_CLI_VERSION}.tgz" docker.tgz "${DOCKER_CLI_SHA256}"
RUN mkdir python && tar -xJf python.tar.xz -C python --strip-components=1 && cd python \
 && ./configure --prefix=/opt/python --without-ensurepip --disable-test-modules \
 && make -j"$(nproc)" && make install
RUN mkdir git && tar -xJf git.tar.xz -C git --strip-components=1 && cd git \
 && make -j"$(nproc)" prefix=/usr NO_TCLTK=1 NO_PERL=1 NO_PYTHON=1 NO_GETTEXT=1 install
RUN mkdir -p /opt/node && tar -xJf node.tar.xz -C /opt/node --strip-components=1 \
 && rm -rf /opt/node/lib/node_modules/npm /opt/node/lib/node_modules/corepack /opt/node/bin/corepack \
 && mkdir /opt/node/lib/node_modules/npm && tar -xzf npm.tgz -C /opt/node/lib/node_modules/npm --strip-components=1 \
 && ln -sf ../lib/node_modules/npm/bin/npm-cli.js /opt/node/bin/npm \
 && mkdir -p /trusted/node_modules/zod && tar -xzf zod.tgz -C /trusted/node_modules/zod --strip-components=1 \
 && tar -xzf docker.tgz -C /usr/local/bin --strip-components=1 docker/docker
COPY stage0.py errors.py process.py paths.py objects.py materialize.py bootstrap.py /opt/forge/bootstrap/
RUN echo "${KERNEL_COMMIT}" > /opt/forge/bootstrap/KERNEL_COMMIT

FROM docker.io/library/ubuntu@${UBUNTU_DIGEST}
ARG UBUNTU_SNAPSHOT
RUN apt-get update --snapshot "${UBUNTU_SNAPSHOT}" \
 && apt-get install -y --no-install-recommends --snapshot "${UBUNTU_SNAPSHOT}" ca-certificates libssl3t64 zlib1g libffi8 libexpat1 libcurl4t64 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /opt/python /opt/python
COPY --from=build /opt/node /opt/node
COPY --from=build /usr/bin/git /usr/bin/git
COPY --from=build /usr/libexec/git-core /usr/libexec/git-core
COPY --from=build /trusted/node_modules /trusted/node_modules
COPY --from=build /usr/local/bin/docker /usr/bin/docker
COPY --from=build /opt/forge/bootstrap /opt/forge/bootstrap
RUN chmod -R a-w /opt/forge/bootstrap /trusted \
 && /opt/python/bin/python3.12 -I -c "import sys; assert sys.version_info[:3] == (3, 12, 14)" \
 && /usr/bin/git --version | grep -qx "git version 2.51.1" \
 && test "$(/opt/node/bin/node --version)" = "v24.19.0" \
 && test "$(/opt/node/bin/npm --version)" = "11.9.0"
WORKDIR /opt/forge/bootstrap
# python -I does not put the script directory on sys.path, and stage0.py does not add it itself; the
# entry therefore adds exactly /opt/forge/bootstrap (PKG §2) and then runs stage0.py as __main__.
ENTRYPOINT ["/opt/python/bin/python3.12", "-I", "-B", "/opt/forge/bootstrap/stage0.py"]
