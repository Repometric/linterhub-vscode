#/bin/sh

sh script/bootstrap.sh

# npm dependencies
echo "==> npm: server dependencies"
cd src/server && \
npm install && \
cd ../..

echo "==> npm: client dependencies"
cd src/client && \
npm install && \
cd ../..
