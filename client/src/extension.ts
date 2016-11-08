'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import { workspace, Disposable, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, TransportKind } from 'vscode-languageclient';
import * as fs from 'fs';
import { spawn, execSync, exec } from "child_process";

let linters: string[] = [];
let appPath: string = path.resolve(__dirname);
let appRoot: string = path.normalize(appPath + "/../..");
let cli_root: string = path.join(appRoot, "repometric/linterhub-cli/src/cli");
let cli_path: string = null;

function status(s: string): void
{
	vscode.window.setStatusBarMessage("LinterHub: " + s);
}

function fromDir(startPath,filter){
    var files=fs.readdirSync(startPath);
    for(let i=0; i<files.length; ++i){
        var filename=path.join(startPath,files[i]);
        var stat = fs.lstatSync(filename);
        if (stat.isDirectory()){
            fromDir(filename,filter); //recurse
        }
        else if (filename.indexOf(filter)>=0) {
			cli_path = filename;
        };
    };
};

function recompile_cli()
{
	let en_path = path.join(appRoot, "repometric/linterhub-cli/src/engine");
	let cl_path = path.join(appRoot, "repometric/linterhub-cli/src/cli");
	status("restoring Linterhub.Engine...");
	execSync("dotnet restore " + en_path);
	status("restoring Linterhub.Cli...");
	execSync("dotnet restore " + cl_path);
	status("compiling Linterhub.Cli...");
	execSync("dotnet publish " + cl_path);
	fromDir(appRoot, 'publish\\cli.dll');
}

export function activate(context: ExtensionContext) {
	fromDir(appRoot, 'publish\\cli.dll');
	if(cli_path == null)
	{
		recompile_cli();
	}
	if(cli_path == null)
		status("can't find compiled Linterhub.Cli");
	else
	{
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

		status("ready");

		let stdout = execSync("dotnet " + cli_path + " --mode=Catalog", {
			cwd: path.resolve(cli_root)
		}).toString();
		let ds: string[] = [];
		try
		{
			let parsed = JSON.parse(stdout);
			parsed.forEach(element => {
				if(ds.findIndex(x => x == element.languages) == -1) ds.push(element.languages);
				linters.push(element.name);
			});
			clientOptions.documentSelector = ds;
		}
		catch(e)
		{
			status("catch error while parsing linters list");
		}
		
		// Create the language client and start the client.
		let lc = new LanguageClient('LinterHub Server', serverOptions, clientOptions);
		lc.onRequest({method: "SetBarMessage"}, (params : { Message : string }) : void => {
			status(params.Message);
		});
		let disposable = lc.start();
		// Push the disposable to the context's subscriptions so that the 
		// client can be deactivated on extension deactivation
		context.subscriptions.push(disposable);

		let config_path: string = path.join(workspace.rootPath, "/.linterhub.json")

		context.subscriptions.push(vscode.commands.registerCommand('linterhub.activate', () => {
			vscode.window.showQuickPick(linters).then(function(value: string){
				let linter: string = value.charAt(0).toUpperCase() + value.slice(1);
				if (!fs.existsSync(config_path)) {
					let gen_conf =
					{
						mode: "docker",
						linters: []
					}
					fs.writeFileSync(config_path, JSON.stringify(gen_conf, null, "\t"));
				}
				let conf = JSON.parse(fs.readFileSync(config_path, "utf-8"));
				let found: boolean = false;
				conf.linters.forEach(x => {
					if(x.name == value)
						found = true;
				})
				if(found)	
					vscode.window.showWarningMessage(linter + " is already initialized! Open .linterhub.json to edit settings");
				else
				{
					lc.sendRequest({ method: "CreateConfig" }, { Linter: value, Config: config_path });
					vscode.window.showInformationMessage(linter + " is activated! Open .linterhub.json to edit settings");
				}
			});
		}));

		context.subscriptions.push(vscode.commands.registerCommand('linterhub.deactivate', () => {
			if (!fs.existsSync(config_path)) {
				let gen_conf =
				{
					mode: "docker",
					linters: []
				}
				fs.writeFileSync(config_path, JSON.stringify(gen_conf, null, "\t"));
			}
			let conf = JSON.parse(fs.readFileSync(config_path, "utf-8"));
			if(conf.linters.length == 0)
			{
				vscode.window.showWarningMessage("Can't find any active linters");
			}
			else 
			{
				let act_linters: string[] = [];
				conf.linters.forEach(x => {
					act_linters.push(x.name);
				});
				vscode.window.showQuickPick(linters).then(function(value: string){
					let linter: string = value.charAt(0).toUpperCase() + value.slice(1);
					let found: boolean = false;
					let ind: Number = -1;
					conf.linters.forEach(x => {
						if(x.name == value)
						{
							found = true;
							ind = conf.linters.indexOf(x);
						}
					})

					if(found)
					{
						conf.linters.splice(ind, 1);
						fs.writeFileSync(config_path, JSON.stringify(conf, null, "\t"));
						vscode.window.showInformationMessage(linter + " is deactivated!");
					}
					else
						vscode.window.showWarningMessage(linter + " is not initialized");
				});
			}
		}));
	}
}
