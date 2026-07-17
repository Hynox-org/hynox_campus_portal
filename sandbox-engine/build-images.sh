#!/bin/sh
# Builds all per-language sandbox images. Run from the sandbox-engine/ directory:
#   sh build-images.sh
set -e
cd "$(dirname "$0")/docker"

docker build -f js.Dockerfile -t hynox-sandbox-js .
docker build -f ts.Dockerfile -t hynox-sandbox-ts .
docker build -f python.Dockerfile -t hynox-sandbox-python .
docker build -f java.Dockerfile -t hynox-sandbox-java .
docker build -f c.Dockerfile -t hynox-sandbox-c .
docker build -f cpp.Dockerfile -t hynox-sandbox-cpp .

echo "All sandbox images built."
