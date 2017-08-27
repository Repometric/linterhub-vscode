Linterhub VSCode Extension
=====
[![Build Status](https://travis-ci.org/repometric/linterhub-vscode.svg?branch=master)](https://travis-ci.org/repometric/linterhub-vscode)
[![Build Status](https://circleci.com/gh/repometric/linterhub-vscode.svg?style=shield)](https://circleci.com/gh/repometric/linterhub-vscode)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/1b144c20d0e34388a9ca21d764782181)](https://www.codacy.com/app/repometric/linterhub-vscode?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=repometric/linterhub-vscode&amp;utm_campaign=Badge_Grade)
[![Issue Count](https://codeclimate.com/github/Repometric/linterhub-vscode/badges/issue_count.svg)](https://codeclimate.com/github/Repometric/linterhub-vscode)

Extension to integrate [Linterhub](https://github.com/repometric/linterhub-cli) into VSCode: analyze your code using different linters.

## Requirements
* [Visual Studio Code](https://code.visualstudio.com) v1.8.0 or higher.

## How to build from terminal
* Run `bash script/cibuild.sh` from project folder.

## How to develop
* Install all dependencies for client and server part. Run `npm install` in client and server directories.
* Open client and server part in different windows.
* Server: press `Ctrl + Shift + P`, choose `Tasks: Run task` and execute `Compile and run` task.
* Client: press `Ctrl + F5`. After that vsc will open new instance of **Extension Development Host**.
