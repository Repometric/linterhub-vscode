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
*/
import * as ide from './shared/ide'
import { StatusNotification } from './shared/ide.vscode'
import { Integration } from './shared/ide.vscode.client'

export function activate(context: ExtensionContext) {
	//let event = new Linterhub.Ide.Vscode.Event(client, vscode.window);
	let integration = new Integration(null);
	integration.initialize().then(() => {
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
				fileEvents: workspace.createFileSystemWatcher('**/.linterhub')
			}
		};
		let client = new LanguageClient('Linterhub', serverOptions, clientOptions);
		integration.setClient(client);
		integration.setupUi();
		// Setup events
		client.onNotification(StatusNotification, (params) => integration.updateStatus(params));

		let disposable = client.start();
		context.subscriptions.push(disposable);
	}).then(() => {
		// Setup commands
		context.subscriptions.push(
			commands.registerCommand('linterhub.analyze', () => integration.analyze()),
			commands.registerCommand('linterhub.analyzeFile', () => integration.analyzeFile(window.activeTextEditor.document.uri.toString())),
			commands.registerCommand('linterhub.activate', () => integration.activate()),
			commands.registerCommand('linterhub.deactivate', () => integration.deactivate()),
			commands.registerCommand('linterhub.showOutput', () => integration.showOutput()),
			integration.statusBarItem
		);
	});
}
