npm install -g vsce && \
mkdir -p bin && \
cd client && \
vsce package --out ../bin/linterhub.vsix && \
cd ..