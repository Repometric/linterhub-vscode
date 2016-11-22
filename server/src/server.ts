
import {
	createConnection, IConnection,
	ResponseError, RequestType, RequestHandler, NotificationType, NotificationHandler,
	InitializeResult, InitializeError,
	Diagnostic, DiagnosticSeverity, Position, Range, Files,
	TextDocuments, TextDocument, TextDocumentSyncKind, TextEdit, TextDocumentIdentifier,
	Command,
	ErrorMessageTracker, IPCMessageReader, IPCMessageWriter
} from 'vscode-languageserver';
import { ActivateRequest, CatalogRequest, Status, StatusNotification } from './shared/ide.vscode'

import * as path from 'path';
import { Integration } from './shared/ide.vscode.server'

let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
let documents: TextDocuments = new TextDocuments();
let integration: Integration = null;

documents.listen(connection);
documents.onDidSave((change) => integration.analyzeFile(change.document.uri));
documents.onDidOpen((change) => integration.analyzeFile(change.document.uri));

connection.onInitialize((params): InitializeResult => {
	connection.console.info("SERVER: start.");
	integration = new Integration(params.rootPath, connection);
	return {
		capabilities: {
			textDocumentSync: documents.syncKind
		}
	}
});

connection.onShutdown((params) => {
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

connection.onRequest(CatalogRequest, (params) => {
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

connection.listen();

class File
{
	Name: string;
	Diagnostics: Diagnostic[];
	constructor (name: string, diagn: Diagnostic[])
	{
		this.Name = name;
		this.Diagnostics = diagn;
	}
}

function validateProject(document: TextDocument): void {
	let files: File[] = [];
	//let conf = JSON.parse(fs.readFileSync(workspaceRoot + "/.linterhub.json", "utf-8"));
	setTimeout(function () {
		connection.console.info('Send PE');
		connection.sendNotification(StatusNotification, { state: Status.progressEnd });
	}, 10000);
	connection.console.info('Send PS');
	connection.sendNotification(StatusNotification, { state: Status.progressStart });
	/*
	for(let lint of conf.linters) {
		let linter_name: string = lint.name; 
		setStatusBar("execute " + linter_name);
		exec("dotnet " + cli_path + " --mode=Analyze --linter=" + linter_name + " --project=" + workspaceRoot,
		{
			cwd: cli_root
		},
		function(error, stdout, stderr) {
			if (error) {
				setStatusBar(`exec error: ${error}`);
				return;
			}
			if(stderr.toString() == ""){
				try
				{
					var res = JSON.parse(stdout.toString());
					res.Files.forEach(x => {
						let diagnostics: Diagnostic[] = [];
						x.Errors.forEach(y => {
							let Severity = DiagnosticSeverity.Warning;
							switch(Number(y.Severity))
							{
								case 0: Severity = DiagnosticSeverity.Error; break;
								case 1: Severity = DiagnosticSeverity.Warning; break;
								case 2: Severity = DiagnosticSeverity.Information; break;
								case 3: Severity = DiagnosticSeverity.Hint; break;
							}
							diagnostics.push({
								severity: Severity,
								range: {
									start: { line: y.Row.Start, character: y.Column.Start},
									end: { line: y.Row.End, character: y.Column.End }
								},
								message: y.Message,
								source: linter_name
							});
						});
						let ind: number = document.uri.lastIndexOf('/');
						let uri: string = document.uri.substr(0, ind + 1) + x.Path;
						var fin = files.filter(function(file){
							return file.Name == uri;
						});
						if(fin.length != 0){
							diagnostics.forEach(q => {
								files[files.lastIndexOf(fin[0])].Diagnostics.push(q);
							});
						}
						else
							files[files.length] = new File(uri, diagnostics);
					});
				}
				catch(err)
				{
					setStatusBar("catch some errors while parsing " + linter_name + "'s stdout");
				}
				files.forEach(x => {
					connection.sendDiagnostics({ uri: x.Name, diagnostics: x.Diagnostics });
				});
				setStatusBar("ready");
			}
			else
			{
				setStatusBar(stderr.toString());
			}
		});
	}
	*/
}