'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import { workspace, Disposable, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, TransportKind } from 'vscode-languageclient';
var fs = require('fs');
import { spawn, execSync, exec } from "child_process";

let linters: string[] = [];
let appPath: string = path.resolve(__dirname);
let appRoot: string = appPath.substr(0, appPath.length - 7);
let cli_path: string = "dotnet " + appRoot + "repometric/Integrations.Linters/src/Metrics.Integrations.Linters.Cli/bin/publish/Metrics.Integrations.Linters.Cli.dll";
let config_path: string = appRoot + "repometric/Integrations.Linters/src/Metrics.Integrations.Linters.Cli/config.Windows.json";

function status(s: string): void
{
	vscode.window.setStatusBarMessage("LinterHub: " + s);
}

export function activate(context: ExtensionContext) {
	let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
	let debugOptions = { execArgv: ["--nolazy", "--debug=6004"] };
	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run : { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	}

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		documentSelector: [],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	}

	let stdout = execSync(cli_path + " --mode Linters --config " + config_path).toString();
	let parsed = JSON.parse(stdout);
	let ds: string[] = [];
	parsed.forEach(element => {
		if(ds.findIndex(x => x == element.languages) == -1) ds.push(element.languages);
		linters.push(element.name);
	});
	clientOptions.documentSelector = ds;
	
	// Create the language client and start the client.
	let lc = new LanguageClient('LinterHub Server', serverOptions, clientOptions);
	lc.onRequest({method: "SetBarMessage"}, (params : { Message : string }) : void => {
		status(params.Message);
	});
	let disposable = lc.start();
	// Push the disposable to the context's subscriptions so that the 
	// client can be deactivated on extension deactivation
	context.subscriptions.push(disposable);

	context.subscriptions.push(vscode.commands.registerCommand('linterhub.activate', () => {
		vscode.window.showQuickPick(linters).then(function(value: string){
			let linter: string = value.charAt(0).toUpperCase() + value.slice(1);
			let fpath: string = workspace.rootPath + "/.linterhub/" + value + "/config.json";
			if (fs.existsSync(fpath)) {
				vscode.window.showInformationMessage(linter + " is already initialized! Open .linterhub/" + value + ".json to edit settings");
			}
			else{
				lc.sendRequest({ method: "CreateConfig" }, { Linter: value });
				vscode.window.showInformationMessage(linter + " is activated! Open .linterhub/" + value + ".json to edit settings");
			}
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('linterhub.deactivate', () => {
		vscode.window.showQuickPick(linters).then(function(value: string){
			let linter: string = value.charAt(0).toUpperCase() + value.slice(1);
			let fpath: string = workspace.rootPath + "/.linterhub/" + value + "/config.json";
			if (!fs.existsSync(fpath)) {
				vscode.window.showInformationMessage(linter + " is not initialized");
			}
			else{
				fs.unlink(fpath, function(err) {
    				if(err) {
						vscode.window.showErrorMessage("Error: " + err);
					}
					else
						vscode.window.showInformationMessage(linter + " is deactivated!");
				}); 
			}
		});
	}));
	status("ready");
}
