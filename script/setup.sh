#!/bin/bash

set -e
bash script/bootstrap.sh
echo "==> app: setup"

# npm dependencies
echo "==> npm: server dependencies"
cd src/server && \
npm install && \
cd ../..

echo "==> npm: client dependencies"
cd src/client && \
npm install && \
cd ../..
