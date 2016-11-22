'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import { workspace, Disposable, ExtensionContext } from 'vscode';
import { window, commands, languages, Command, Uri, StatusBarAlignment, TextEditor } from 'vscode';
import {
	LanguageClient, LanguageClientOptions, SettingMonitor, RequestType, TransportKind,
	TextDocumentIdentifier, TextEdit, NotificationType, ErrorHandler,
	ErrorAction, CloseAction, ResponseError, InitializeError, ErrorCodes, State as ClientState,
	Protocol2Code, ServerOptions
} from 'vscode-languageclient';
import * as fs from 'fs';
import { spawn, execSync, exec } from "child_process";
//import { Linterhub } from "./notificator";
/*
import { execSync, exec } from "child_process";
import * as vscode from 'vscode';
import {
	LanguageClient, LanguageClientOptions, SettingMonitor, RequestType, TransportKind,
	TextDocumentIdentifier, TextEdit, NotificationType, ErrorHandler,
	ErrorAction, CloseAction, ResponseError, InitializeError, ErrorCodes, State as ClientState,
	Protocol2Code
} from 'vscode-languageclient';
import { window, commands, languages, Command, Uri, StatusBarAlignment, TextEditor } from 'vscode';
import * as utils from './utils'
import * as cli from './cli'
import * as ide from './ide'
*/
import * as ide from './shared/ide'
import { StatusNotification } from './shared/ide.vscode'
import { Integration } from './shared/ide.vscode.client'

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

export function activate(context: ExtensionContext) {
	fromDir(appRoot, 'publish/cli.dll');
	cli_root = "/Volumes/Repositories/Repometric/linterhub-cli/src/cli/bin/Debug/netstandard1.6/osx.10.11-x64/publish/";
	//let event = new Linterhub.Ide.Vscode.Event(client, vscode.window);
	let integration = new Integration(null);
	integration.initialize().then(x => {
		//event.log.info('Supported linters: ' + integration.linters.join(', '));
	}).then(() => {
		// Setup and start client
		let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
		let debugOptions = { execArgv: ["--nolazy", "--debug=6004"] };
		let serverOptions: ServerOptions = {
			run : { module: serverModule, transport: TransportKind.ipc },
			debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
		};
		let clientOptions: LanguageClientOptions = {
			documentSelector: integration.languages,
			synchronize: {
				configurationSection: 'linterhub',
				fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
			}
		};
		let client = new LanguageClient('Linterhub', serverOptions, clientOptions);
		integration.setClient(client);
		// Setup events
		client.onNotification(StatusNotification, (params) => integration.updateStatus(params));
		//client.onRequest({method: "SetBarMessage"}, (params : { Message : string }) : void => status(params.Message));

		let disposable = client.start();
		context.subscriptions.push(disposable);
	}).then(() => {
		integration.setupUi();
		// Setup commands
		context.subscriptions.push(
			commands.registerCommand('linterhub.analyze', () => integration.analyze()),
			commands.registerCommand('linterhub.analyzeFile', () => integration.analyzeFile()),
			commands.registerCommand('linterhub.activate', () => integration.activate()),
			commands.registerCommand('linterhub.deactivate', () => integration.deactivate()),
			commands.registerCommand('linterhub.showOutput', () => integration.showOutput()),
			integration.statusBarItem
		);
	});
}
