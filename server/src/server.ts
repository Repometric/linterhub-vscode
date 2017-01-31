
import {
	createConnection, IConnection,
	InitializeResult,
	TextDocuments,
	IPCMessageReader, IPCMessageWriter
} from 'vscode-languageserver';
import { InstallRequest, ActivateRequest, AnalyzeRequest, CatalogRequest, Status, StatusNotification, LinterVersionRequest, LinterInstallRequest } from './shared/ide.vscode'

import { IntegrationVScode } from './shared/ide.vscode.server'
import { Run } from 'linterhub-ide'

let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

let documents: TextDocuments = new TextDocuments();
let integration: IntegrationVScode = null;

documents.listen(connection);

documents.onDidOpen((event) => {
	integration.analyzeFile(event.document.uri, Run.onOpen, event.document);
});

documents.onDidSave((event) => {
	integration.analyzeFile(event.document.uri, Run.onSave, event.document);
});

documents.onDidClose(() => {
	//integration.stopAnalysis(event.document.uri);
});

connection.onInitialize((params): InitializeResult => {
	connection.console.info("SERVER: start.");
	integration = new IntegrationVScode(params.rootPath, connection)
	return {
		capabilities: {
			textDocumentSync: documents.syncKind
		}
	}
});

connection.onShutdown(() => {
	connection.console.info("SERVER: stop.");
});

connection.onDidChangeConfiguration((params) => {
	connection.console.info("SERVER: initialize.");

	integration.initialize(params.settings).then(version => {
		connection.console.info("SERVER: " + version.toString().replace(/(?:\r\n|\r|\n)/g, ', '));
	}).catch(function (reason) {
		connection.console.error(reason.toString());
		connection.console.error(reason.message);
		connection.sendNotification(StatusNotification, { state: Status.noCli, id: null });
	});
});

connection.onRequest(CatalogRequest, () => {
	connection.console.info("SERVER: get catalog.");
	return integration.catalog().then(linters => {
		return { linters: linters };
	});
});

connection.onRequest(ActivateRequest, (params) => {
	if (params.activate) {
		connection.console.info(JSON.stringify(params));
		connection.console.info("SERVER: activate linter.");
		return integration.activate(params.linter);
	} else {
		connection.console.info("SERVER: deactivate linter.");
		return integration.deactivate(params.linter);
	}
});

connection.onRequest(LinterVersionRequest, (params) => {
	connection.console.info("SERVER: request " + params.linter + " version...");
	return integration.linterVersion(params.linter, false);
});

connection.onRequest(LinterInstallRequest, (params) => {
	connection.console.info("SERVER: trying to install " + params.linter + "...");
	return integration.linterVersion(params.linter, true);
});

connection.onRequest(AnalyzeRequest, (params) => {
	if (params.full) {
		return integration.analyze();
	} else {
		return integration.analyzeFile(params.path, Run.force);
	}
});

connection.onRequest(InstallRequest, () => {
	connection.console.info("SERVER: install cli.");
	return integration.install().then((value) => { 
		return { path: value }
	});
});

connection.listen();