#!/usr/bin/env bash
#
# Build the Kroki "core" image from source, including GoAT (Go ASCII art).
#
# GoAT was merged into Kroki main (PR #2033, 2026-04-02) but is NOT in any
# released image (latest release v0.30.1 predates it). This script builds a
# local "kroki-core:main-goat" image that docker-compose.yml references, so
# the /goat/<format> route is available.
#
# Requirements: Docker with BuildKit. The script installs the `buildx` plugin
# locally if it is missing. The build is heavy (~15-30 min, multi-stage:
# Maven server jar + Rust/Go/Deno/pkg native renderers).
#
# Usage: ./build-kroki-core.sh
#
set -uo pipefail

# Pinned to the verified commit that includes GoAT (override with KROKI_REF=...).
KROKI_REF="${KROKI_REF:-1d20d1d6e518a6c2eab4c44bbf50b02802b94561}"
IMAGE_TAG="${IMAGE_TAG:-ghcr.io/vppillai/kroki-core:goat}"
BUILDX_VERSION="${BUILDX_VERSION:-v0.34.1}"
BUILD_DIR="${BUILD_DIR:-$(cd "$(dirname "$0")" && pwd)/.kroki-src}"

fail() { echo "BUILD_FAIL: $1" >&2; exit 1; }

# 1. Ensure docker buildx is available (install the plugin if missing).
if ! docker buildx version >/dev/null 2>&1; then
  echo "--- installing docker buildx $BUILDX_VERSION ---"
  arch="$(uname -m)"; case "$arch" in aarch64|arm64) ba=arm64 ;; x86_64|amd64) ba=amd64 ;; *) fail "unsupported arch $arch" ;; esac
  mkdir -p "$HOME/.docker/cli-plugins"
  curl -fsSL -o "$HOME/.docker/cli-plugins/docker-buildx" \
    "https://github.com/docker/buildx/releases/download/$BUILDX_VERSION/buildx-$BUILDX_VERSION.linux-$ba" \
    || fail "buildx download"
  chmod +x "$HOME/.docker/cli-plugins/docker-buildx"
fi
docker buildx version >/dev/null 2>&1 || fail "buildx not working"

# 2. A BuildKit container-driver builder (needed for bake + named contexts).
docker buildx inspect kroki-builder >/dev/null 2>&1 \
  || docker buildx create --name kroki-builder --driver docker-container --bootstrap >/dev/null \
  || fail "builder create"
docker buildx use kroki-builder || fail "builder use"

# 3. Sparse, pinned checkout of just the core build contexts.
if [ ! -f "$BUILD_DIR/server/pom.xml" ]; then
  echo "--- cloning kroki (sparse) ---"
  rm -rf "$BUILD_DIR"
  git clone --filter=blob:none --sparse https://github.com/yuzutech/kroki.git "$BUILD_DIR" || fail "clone"
  git -C "$BUILD_DIR" sparse-checkout set server nomnoml vega dbml wavedrom bytefield tikz || fail "sparse-checkout"
fi
git -C "$BUILD_DIR" checkout -q "$KROKI_REF" || fail "checkout $KROKI_REF"
git -C "$BUILD_DIR" sparse-checkout reapply >/dev/null 2>&1 || true
[ -f "$BUILD_DIR/server/src/main/java/io/kroki/server/service/Goat.java" ] || fail "Goat.java missing at $KROKI_REF"
echo "--- kroki @ $(git -C "$BUILD_DIR" rev-parse --short HEAD) (GoAT present) ---"

# 4. Phase 1: Maven build -> server/target/kroki-server.jar (Kroki's Dockerfile expects a pre-built jar).
echo "--- [1/2] mvn package (server) ---"
mkdir -p "$HOME/.m2-kroki"
docker run --rm -v "$BUILD_DIR":/work -w /work -v "$HOME/.m2-kroki":/root/.m2 \
  maven:3-eclipse-temurin-21 \
  mvn -B --no-transfer-progress -DskipTests -f server/pom.xml clean package || fail "maven"
[ -f "$BUILD_DIR/server/target/kroki-server.jar" ] || fail "kroki-server.jar not produced"

# 5. Phase 2: bake the core image (compiles native renderers incl. goat, assembles).
echo "--- [2/2] docker buildx bake kroki -> $IMAGE_TAG ---"
( cd "$BUILD_DIR" && docker buildx bake kroki --set "kroki.tags=$IMAGE_TAG" --load ) || fail "bake"

echo "BUILD_OK: $IMAGE_TAG"
docker image ls "$IMAGE_TAG"

# Optional: push to the registry (requires `docker login ghcr.io`). Use PUSH=1.
if [ "${PUSH:-0}" = "1" ]; then
  echo "--- pushing $IMAGE_TAG ---"
  docker push "$IMAGE_TAG" || fail "push (run: docker login ghcr.io)"
  echo "PUSH_OK: $IMAGE_TAG"
fi
