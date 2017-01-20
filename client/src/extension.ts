'use strict';

import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import { window, commands } from 'vscode';
import { LanguageClient, LanguageClientOptions, TransportKind, ServerOptions } from 'vscode-languageclient';
import { StatusNotification, ConfigRequest } from './shared/ide.vscode'
import { Integration } from './shared/ide.vscode.client'

export function activate(context: ExtensionContext) {
	let integration = new Integration(null);
	integration.initialize().then(() => {
		// Setup and start client
		let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
		let debugOptions = { execArgv: ["--nolazy", "--debug=6009"] };
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
		let disposable = client.start();
		client.onRequest(ConfigRequest, () =>
		{
			const config = workspace.getConfiguration();
			let response: any = {};
			response.proxy = config.get<string>('http.proxy');
			response.strictSSL = config.get('http.proxyStrictSSL', true);
			return response;
		});

		return client.onReady().then(() => {
			integration.setClient(client);
			integration.setupUi();
			context.subscriptions.push(
				commands.registerCommand('linterhub.analyze', () => integration.analyze()),
				commands.registerCommand('linterhub.analyzeFile', () => integration.analyzeFile(window.activeTextEditor.document.uri.toString())),
				commands.registerCommand('linterhub.activate', () => integration.activate()),
				commands.registerCommand('linterhub.deactivate', () => integration.deactivate()),
				commands.registerCommand('linterhub.showOutput', () => integration.showOutput()),
				integration.statusBarItem,
				disposable
			);

			// Setup events
			client.onNotification(StatusNotification, (params) => integration.updateStatus(params));
		});
	});
}

