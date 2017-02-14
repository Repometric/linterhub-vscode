#!/bin/bash

set -e

# git
which -s git
if [[ $? != 0 ]] ; then
    echo "==> git: not installed"
    exit 1
fi
echo "==> git: " && git --version

# node
which -s node
if [[ $? != 0 ]] ; then
    echo "==> node: not installed"
    exit 1
fi
echo "==> node: " && node --version

# npm
which -s npm
if [[ $? != 0 ]] ; then
    echo "==> npm: not installed"
    exit 1
fi
echo "==> npm: " && npm --version

# git submodules
echo "==> git: update submodules"
git submodule update --init --recursive

# graphics
echo "==> app: copy icon"
\cp -r src/assets/vector/lh-logo-border.svg src/client/icon.svg
