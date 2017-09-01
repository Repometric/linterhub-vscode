import {
	createConnection, IConnection,
	InitializeResult, InitializeParams,
	TextDocuments, TextDocumentChangeEvent,
	IPCMessageReader, IPCMessageWriter, CodeActionParams, Command, Diagnostic
} from 'vscode-languageserver';
import * as path from 'path';
import Uri from 'vscode-uri';
import { Converter } from './converter'
import { Linterhub, ProgressManager, LinterhubVersion, EngineResult, Engine, Component, DetectedEngine } from '@repometric/linterhub-ide';
import { VscodeLogger } from "./logger";

class Server {
	private static connection: IConnection;
	private static log: VscodeLogger;
	private static documents: TextDocuments;
	private static project: string;
	private static converter: Converter;

	private static analyzeTimer: NodeJS.Timer = null;

	public static Init(): void {
		this.connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
		this.log = new VscodeLogger(this.connection, "Linterhub Server: ");

		this.connection.onInitialize(this.onInit);
		this.connection.onRequest("linterhub/version", this.onVersion);
		this.connection.onRequest("linterhub/version/engine", this.onEngineVersion);
		this.connection.onShutdown(() => this.log.info("Stopped"));
		this.connection.onRequest("linterhub/catalog", this.onCatalog);
		this.connection.onRequest("linterhub/fetch", this.onFetch);
		this.connection.onRequest("linterhub/activate", this.onActivate);
		this.connection.onRequest("linterhub/ignore", this.onIgnore);
		this.connection.onCodeAction(this.onCodeAction);

		this.documents = new TextDocuments();
		this.documents.onDidOpen(this.onAnalyze);
		this.documents.onDidChangeContent(this.onAnalyze);
		this.documents.onDidSave(this.onAnalyze);

		this.connection.listen();
		this.documents.listen(this.connection);

	}

	private static onVersion(): Promise<string> {
		return new Promise((resolve) => {
			Linterhub.version()
				.then((data: LinterhubVersion) => {
					resolve(data.version);
				})
		});
	}

	private static onEngineVersion(engine: string): Promise<Component> {
		return new Promise((resolve) => {
			Linterhub.engineVersion(engine)
				.then((data: Component) => {
					resolve(data);
				})
		});
	}

	private static onActivate(params: any): Promise<{}> {
		return new Promise((resolve) => {
			Server.log.info(`${params.activate ? "Activating" : "Deactivating"} ${params.engine}...`);
			Linterhub.engineConfig(Server.project, params.engine, params.activate)
				.then(() => {
					resolve();
				})
		});
	}

	private static onIgnore(params: any): Promise<{}> {
		return new Promise((resolve) => {
			Linterhub.addIgnoreRule(Server.project, params.folder, params.file, params.line, params.ruleId, params.engine)
				.then(() => {
					resolve();
				})
		});
	}

	private static onInit(params: InitializeParams): Promise<InitializeResult> {
		Server.project = params.rootPath;
		Server.converter = new Converter(Server.project);
		Server.log.info("Opened project: " + Server.project);
		Server.log.info("Starting Server");
		let integr = {
			logger: new VscodeLogger(Server.connection),
			progress: new ProgressManager(
				(visibility: boolean) => { Server.connection.sendNotification("linterhub/progress/visibility", visibility) },
				(text: string) => { Server.connection.sendNotification("linterhub/progress/text", text) })
		}
		return new Promise((resolve) => {
			Linterhub.initialize(integr)
				.then(() => {
					resolve({
						capabilities: {
							textDocumentSync: Server.documents.syncKind,
							codeActionProvider: true
						}
					});
				})
				.catch(() => {
					Server.log.error("Cant initialize Linterhub");
				})
		});
	}

	private static parsePath(uri: string) {
		let folder: string = null;
		let file: string = null;

		if (uri != null && Server.project != null) {
			let _path: path.ParsedPath = path.parse(Uri.parse(uri).fsPath);
			if (Server.project != path.normalize(_path.dir)) {
				folder = _path.dir;
			}
			file = _path.base;
		}
		else {
			return null;
		}

		return {
			file: file,
			folder: folder
		}
	}

	private static onCatalog() {
		return new Promise((resolve) => {
			Linterhub.catalog(Server.project)
				.then((data: Engine[]) => {
					resolve(data);
				})
		});
	}

	private static onFetch() {
		return new Promise((resolve) => {
			Linterhub.fetch(Server.project)
				.then((data: DetectedEngine[]) => {
					resolve(data);
				})
		});
	}

	private static onAnalyze(event: TextDocumentChangeEvent) {
		if (Server.analyzeTimer != null) {
			clearTimeout(Server.analyzeTimer);
			Server.analyzeTimer = null;
		}

		Server.analyzeTimer = setTimeout((event: TextDocumentChangeEvent) => {
			let path_ = Server.parsePath(event.document.uri);
			Linterhub.analyze(Server.project, path_.folder, path_.file, null, event.document.getText())
				.then((data: EngineResult[]) => {
					if (data.length == 0) {
						Server.connection.sendDiagnostics({
							uri: event.document.uri,
							diagnostics: []
						})
					}
					Server.converter.analyze(data).forEach(Server.connection.sendDiagnostics);
					Server.analyzeTimer = null;
				})
				.catch((x) => {
					Server.log.info(x);
				})
		}, 500, event);
	}

	private static onCodeAction(params: CodeActionParams) {
		let result: Command[] = [];
		let file: string = Server.parsePath(params.textDocument.uri).file;
		let folder: string = Server.parsePath(params.textDocument.uri).folder;
		let diagnostics: Diagnostic[] = params.context.diagnostics;
		diagnostics.forEach(diagnostic => {
			let engine: string = diagnostic.source.replace("Linterhub:", "");
			result.push(
				Command.create(
					'Ignore ' + diagnostic.code + ' in this file',
					'linterhub.ignoreWarning',
					{ line: null, file: file, folder: folder, ruleId: diagnostic.code, engine: engine }));
			result.push(
				Command.create(
					'Ignore ' + diagnostic.code + ' on line ' + (diagnostic.range.start.line + 1),
					'linterhub.ignoreWarning',
					{ line: diagnostic.range.start.line + 1, file: file, folder: folder, ruleId: diagnostic.code, engine: engine }));
		});
		if (diagnostics.length > 0) {
			result.push(
				Command.create(
					`Ignore whole file`,
					'linterhub.ignoreWarning',
					{ line: null, file: file, folder: folder, ruleId: null, engine: null }));
		}
		return result;
	};

}

Server.Init();