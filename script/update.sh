#!/bin/bash

set -e
bash script/setup.sh
echo "==> app: update"

# npm dependencies
echo "==> npm: build server"
cd src/server && \
npm install && \
cd ../..

echo "==> npm: build client"
cd src/client && \
tsc -p ./ && \
cd ../..
