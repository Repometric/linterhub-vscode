Linterhub VSCode Extension
=====
[![Build Status](https://travis-ci.org/Repometric/linterhub-vscode.svg?branch=master)](https://travis-ci.org/Repometric/linterhub-vscode)

This is an extension for vsc that analyze your code using different linters.
Extension needs:
* Docker (or Docker Toolbox)
* .Net Core
* Visual Studio Code v1.4.0 or higher

## How to build
First of all, u need to initiate all submodules and build Linterhub. The easiest way is to run `build.bat`. Also u can do this by using VS or VSC, just rebuild all solution.

Any way extension will rebuild cli if it can't find the compiled one.

Then install all dependencies for client and server part. Run `npm install` in client and server directories.

## How to develop
Open client and server part in different windows.

To run server part u should press `Ctrl + Shift + P`, choose `Tasks: Run task` and execute `Compile and run` task.

As for client, u need to run it by pressing `Ctrl + F5`. After that vsc will open new instance of **Extension Development Host**.
