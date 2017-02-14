npm install -g vsce && \
mkdir -p bin && \
cd src && \
cd client && \
vsce package --out ../../bin/linterhub.vsix && \
cd .. && \
cd ..