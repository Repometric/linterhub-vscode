'use strict';

import * as path from 'path';
import { ExtensionContext } from 'vscode';
import { commands, window } from 'vscode';
import { LanguageClient, LanguageClientOptions, TransportKind, ServerOptions } from 'vscode-languageclient';
import { Integration } from './integration';

export function activate(context: ExtensionContext) {
	let integration = new Integration();

	let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
	let debugOptions = { execArgv: ["--nolazy", "--debug=6010"] };

	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	};

	let clientOptions: LanguageClientOptions = {
		initializationFailedHandler: (error) => {
			client.error('Server initialization failed.', error);
			client.outputChannel.show(true);
			return false;
		},
		documentSelector: [{
			pattern: "**/*.*",
			scheme: "file"
		}]
	};

	let client = new LanguageClient('Linterhub', serverOptions, clientOptions);
	let disposable = client.start();

	return client.onReady().then(() => {
		integration.setClient(client);
		integration.setupUi();

		client.sendRequest("linterhub/version").then((version: string) => {
			client.info("CLI VERSION: " + version)
		});

		context.subscriptions.push(
			commands.registerCommand('linterhub.activate', () => integration.activate(true)),
			commands.registerCommand('linterhub.deactivate', () => integration.activate(false)),
			commands.registerCommand('linterhub.showOutput', () => integration.showOutput()),
			commands.registerCommand('linterhub.ignoreWarning', (params) => integration.ignoreWarning(params)),
			integration.statusBarItem,
			disposable
		);
	})
		.catch((e) => {
			window.showErrorMessage(e.toString())
		});
}

