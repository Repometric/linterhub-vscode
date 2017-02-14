#/bin/sh

sh script/setup.sh

# npm dependencies
echo "==> npm: build server"
cd src/server && \
npm install && \
cd ../..

echo "==> npm: build client"
cd src/client && \
tsc -p ./ && \
cd ../..
