import {
	createConnection, IConnection,
	InitializeResult,
	TextDocuments,
	IPCMessageReader, IPCMessageWriter, Command, Diagnostic
} from 'vscode-languageserver';
import { ActivateRequest, AnalyzeRequest, IgnoreWarningRequest, CatalogRequest, Status, StatusNotification, LinterVersionRequest, LinterInstallRequest } from 'linterhub-vscode-shared';
import { IntegrationLogic, Logger } from './integrationLogic';
import { Linterhub, LinterhubTypes } from 'linterhub-ide';
import * as path from 'path';

let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
let documents: TextDocuments = new TextDocuments();
let integrationLogic: IntegrationLogic = null;
let projectRoot: string = null;
let logger: Logger = null;
documents.listen(connection);

documents.onDidOpen((event) => {
	Linterhub.analyzeFile(event.document.uri, LinterhubTypes.Run.onOpen, event.document);
});

documents.onDidSave((event) => {
	Linterhub.analyzeFile(event.document.uri, LinterhubTypes.Run.onSave, event.document);
});

documents.onDidClose(() => {
	//integration.stopAnalysis(event.document.uri);
});

connection.onInitialize((params): InitializeResult => {
	logger = new Logger(connection);
	logger.changePrefix("Linterhub Server: ");
	logger.info("Start");
	projectRoot = params.rootPath;
	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
			codeActionProvider: true
		}
	};
});

connection.onShutdown(() => {
	logger.info("Stop");
});

connection.onDidChangeConfiguration((params) => {
	logger.info("Initialize");
	for (let i = 0; i < params.settings.linterhub.run.length; ++i) {
		params.settings.linterhub.run[i] = LinterhubTypes.Run[params.settings.linterhub.run[i]];
	}
	params.settings.linterhub.cliRoot = path.join(__dirname, "/../");
	integrationLogic = new IntegrationLogic(projectRoot, connection, "0.3.4");
	Linterhub.initializeLinterhub(integrationLogic, params.settings);
	Linterhub.version().then(version => {
		logger.info(version.toString().replace(/(?:\r\n|\r|\n)/g, ', '));
	}).catch(function (reason) {
		logger.error(reason.toString());
		logger.error(reason.message);
		connection.sendNotification(StatusNotification, { state: Status.noCli, id: null });
	});
});

connection.onRequest(CatalogRequest, () => {
	logger.info("Get catalog...");
	return Linterhub.catalog().then(linters => {
		return { linters: linters };
	});
});

connection.onRequest(ActivateRequest, (params) => {
	if (params.activate) {
		logger.info("Activate linter " + params.linter);
		return Linterhub.activate(params.linter);
	} else {
		logger.info("Deactivate linter " + params.linter);
		return Linterhub.deactivate(params.linter);
	}
});

connection.onRequest(LinterVersionRequest, (params) => {
	logger.info("Request " + params.linter + " version...");
	return Linterhub.linterVersion(params.linter, false);
});

connection.onRequest(LinterInstallRequest, (params) => {
	logger.info("Trying to install " + params.linter + "...");
	return Linterhub.linterVersion(params.linter, true);
});

connection.onRequest(AnalyzeRequest, (params) => {
	if (params.full) {
		return Linterhub.analyze();
	} else {
		return Linterhub.analyzeFile(params.path, LinterhubTypes.Run.force);
	}
});

connection.onRequest(IgnoreWarningRequest, (params: LinterhubTypes.IgnoreWarningParams) => {
	return Linterhub.ignoreWarning(params).then(() => Linterhub.analyzeFile(integrationLogic.constructURI(params.file), LinterhubTypes.Run.force));
});

connection.onCodeAction((params) => {
	let result: Command[] = [];
	let uri: string = path.relative(projectRoot, integrationLogic.normalizePath(params.textDocument.uri));
	let diagnostics: Diagnostic[] = params.context.diagnostics;
	diagnostics.forEach(diagnostic => {
		result.push(
			Command.create(
				'Ignore ' + diagnostic.code + ' in this file',
				'linterhub.ignoreWarning',
				{ line: null, file: uri, error: diagnostic.code }));
		result.push(
			Command.create(
				'Ignore ' + diagnostic.code + ' on line ' + (diagnostic.range.start.line + 1),
				'linterhub.ignoreWarning',
				{ line: diagnostic.range.start.line + 1, file: uri, error: diagnostic.code }));
	});
	if (diagnostics.length > 0) {
		result.push(
			Command.create(
				`Ignore whole file`,
				'linterhub.ignoreWarning',
				{ line: null, file: uri, error: null }));
	}
	return result;
});

connection.listen();