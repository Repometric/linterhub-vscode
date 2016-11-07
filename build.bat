git submodule update --init --recursive
dotnet restore client/repometric/linterhub-cli/src/engine
dotnet restore client/repometric/linterhub-cli/src/cli
dotnet publish client/repometric/linterhub-cli/src/cli