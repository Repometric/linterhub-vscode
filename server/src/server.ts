
import {
	createConnection, IConnection,
	InitializeResult,
	TextDocuments,
	IPCMessageReader, IPCMessageWriter
} from 'vscode-languageserver';
import { InstallRequest, ActivateRequest, AnalyzeRequest, CatalogRequest, Status, StatusNotification } from './shared/ide.vscode'

import { Integration, Run } from './shared/ide.vscode.server'

let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

let documents: TextDocuments = new TextDocuments();
let integration: Integration = null;

documents.listen(connection);

documents.onDidOpen((event) => {
	integration.analyzeFile(event.document.uri, event.document, Run.onOpen);
});

documents.onDidSave((event) => {
	integration.analyzeFile(event.document.uri, event.document, Run.onSave);
});

documents.onDidClose(() => {
	//integration.stopAnalysis(event.document.uri);
});

connection.onInitialize((params): InitializeResult => {
	connection.console.info("SERVER: start.");
	integration = new Integration(params.rootPath, connection)
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
		connection.sendNotification(StatusNotification, { state: Status.noCli });
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
		connection.console.info("SERVER: activate linter.");
		return integration.activate(params.linter);
	} else {
		connection.console.info("SERVER: deactivate linter.");
		return integration.deactivate(params.linter);
	}
});

connection.onRequest(AnalyzeRequest, (params) => {
	if (params.full) {
		return integration.analyze();
	} else {
		return integration.analyzeFile(params.path, null, Run.force);
	}
});

connection.onRequest(InstallRequest, () => {
	connection.console.info("SERVER: install cli.");
	return integration.install().then((value) => { 
		return { path: value }
	});
});

connection.listen();