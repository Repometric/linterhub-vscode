npm install -g vsce && \
mkdir bin && \
cd client && \
vsce package --out ../bin/linterhub.vsix && \
cd ..