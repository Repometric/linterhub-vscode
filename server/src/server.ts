import {
	IPCMessageReader, ResponseError, InitializeError, IPCMessageWriter,
	createConnection, IConnection, TextDocumentSyncKind,
	TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
	InitializeParams, InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind
} from 'vscode-languageserver';
import { spawn, execSync, exec } from "child_process";
var fs = require('fs');
var path = require('path');

let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
let documents: TextDocuments = new TextDocuments();
let workspaceRoot: string;

documents.listen(connection);

connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath;
	return {
		capabilities: {
			textDocumentSync: documents.syncKind
		}
	}
});

documents.onDidSave((change) => {
	validateProject(change.document);
});

documents.onDidOpen((change) => {
	validateProject(change.document);
});

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

let files: File[];
let appRoot: string = path.resolve(__dirname);
let cli_path: string = appRoot.substr(0, appRoot.length - 6) + "repometric/parser_bin/Metrics.Integrations.Linters.Cli.exe";


connection.onRequest({method: "CreateConfig"}, (params : { Linter : string }) : void => {
	execSync(cli_path + " " + params.Linter + " " + workspaceRoot + " --init");
});

function setStatusBar(s: string)
{
	connection.sendRequest({ method: "SetBarMessage" }, { Message: s });
}

function validateProject(document: TextDocument): void {
	let files: File[] = [];
	let items: string[] = fs.readdirSync(workspaceRoot + "/.linterhub");
	for(let p of items) {
		let linter_name: string = p.substr(0, p.lastIndexOf('.'));
		setStatusBar("execute " + linter_name);
		let stdout: string = execSync(cli_path + " " + linter_name + " " + workspaceRoot).toString();

		//logs
		if (fs.existsSync(workspaceRoot + "/.linterhub_logs")) {
			fs.writeFileSync(workspaceRoot + "/.linterhub_logs/" + Math.floor(Date.now()/1000) + "_"+ linter_name + ".json", stdout);
		}

		try
		{
			var res = JSON.parse(stdout);
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
	}
	setStatusBar("ready");
	files.forEach(x => {
		connection.sendDiagnostics({ uri: x.Name, diagnostics: x.Diagnostics });
	});
}

connection.listen();