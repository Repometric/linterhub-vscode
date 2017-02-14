#!/bin/bash

bash script/update.sh

echo "==> npm: install vsce"
npm install -g vsce

echo "==> app: package"
mkdir -p bin && \
cd src/client && \
vsce package --out ../../bin/linterhub.vsix && \
cd ../..
