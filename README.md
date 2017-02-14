Linterhub VSCode Extension
=====
[![Build Status](https://travis-ci.org/Repometric/linterhub-vscode.svg?branch=master)](https://travis-ci.org/Repometric/linterhub-vscode)
[![Issue Count](https://codeclimate.com/github/Repometric/linterhub-vscode/badges/issue_count.svg)](https://codeclimate.com/github/Repometric/linterhub-vscode)

Extension to integrate [Linterhub](https://github.com/Repometric/linterhub-cli) into VSCode: analyze your code using different linters.

## Requirements
* [Visual Studio Code](https://code.visualstudio.com) v1.4.0 or higher.

## How to build from terminal
* Run `bash script/cibuild.sh` from project folder.

## How to develop
* Install all dependencies for client and server part. Run `npm install` in client and server directories.
* Open client and server part in different windows.
* Server: press `Ctrl + Shift + P`, choose `Tasks: Run task` and execute `Compile and run` task.
* Client: press `Ctrl + F5`. After that vsc will open new instance of **Extension Development Host**.
