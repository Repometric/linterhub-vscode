import { IIntegration } from './ide'
import { LinterhubCli } from './linterhub-cli'
import { Status, StatusNotification } from './ide.vscode'
import { IConnection, NotificationType,
    Diagnostic, DiagnosticSeverity, Position, Range, Files, TextDocument } from 'vscode-languageserver';

export enum Run {
    none,
    onStart,
    onOpen,
    onType,
    onSave
}

export interface Settings {
	linterhub: {
		enable: boolean;
        run: Run[];
		cliPath: any;
	}
	[key: string]: any;
}

export class Cacheable {
    private value: {} = null;
    private action: () => Promise<{}>;
    constructor(action: () => Promise<{}>) {
        this.action = action;
    }
    getValue(): Promise<{}> {
        let that = this;
        let promise = new Promise((resolve, reject) => {
            if (that.value == null) {
                that.action().then(value => {
                    that.value = value;
                    resolve(that.value);
                });
            } else {
                resolve(that.value);
            }
        });
        return promise;
    }
}

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

export class Integration implements IIntegration {
    private systemId: string = "_system";
    private linterhub: LinterhubCli;
    private connection: IConnection;
    private settings: Settings;
    private project: string;
    private onReady: Promise<{}>;
    private linters: Cacheable;
    private version: Cacheable;
    constructor(project: string, connection: IConnection) {
        this.project = project;
        this.connection = connection;
    }
    initialize(settings: Settings = null) {
        this.settings = settings;
        this.settings.linterhub.run = [ Run.onOpen, Run.onSave ];
        this.linterhub = new LinterhubCli(this.settings.linterhub.cliPath, this.project);
        this.linters = new Cacheable(() => this.linterhub.catalog());
        this.version = new Cacheable(() => this.linterhub.version());
        this.onReady = this.version.getValue();
        return this.onReady;
    }
    private run(action: Promise<{}>, id: string): Promise<{}> {
        var that = this;
        return this.onReady.then(() => {
            that.connection.sendNotification(StatusNotification, { state: Status.progressStart, id: id });
            return action.then((result) => {
                that.connection.sendNotification(StatusNotification, { state: Status.progressEnd, id: id });
                return result;
            }).catch((reason) => {
                return this.connection.console.error(reason.toString());
            })
        });      
    }
    analyze() {
        return this.run(this.linterhub.analyze(), this.project);
    }
    stopAnalysis(path: string) {
        // TODO:
    }
    analyzeFile(path: string, document: TextDocument = null, run: Run = Run.none) {
        if (this.settings.linterhub.run.indexOf(run) < 0) {
            return;
        }

        this.connection.console.info(`SERVER: analyze file '${path}'.`);
        return this.run(this.linterhub.analyzeFile(path), path).then((data: string) => {
            let json = JSON.parse(data);
            this.connection.console.info(`SERVER: finish analyze file '${path}'.`);
            json[0].Files.forEach(file => {
                // TODO: Combine serveral linter results into 1
                let diagnostics: Diagnostic[] = file.Errors.map(error => this.convertError(error));
                this.connection.sendDiagnostics({ uri: 'file://' + this.project + '/' + file.Path, diagnostics: diagnostics });      
            });

            files.forEach(x => { 
                this.connection.console.info("SERVER: diagnostic for " + x);
                this.connection.sendDiagnostics({ uri: x.Name, diagnostics: x.Diagnostics });
            });
            
            return json;
        });
    }
    catalog() {
        return this.run(this.linters.getValue(), this.systemId).then((data: string) => {
            let json = JSON.parse(data);
            let linters = json.map(x => x.name).sort();
            return linters;
        });
    }
    activate(linter: string) {
        return this.run(this.linterhub.activate(linter), this.systemId);
    }
    deactivate(linter: string) {
        return this.run(this.linterhub.deactivate(linter), this.systemId);
    }
    private convertError(error: any): Diagnostic {
        let severity = DiagnosticSeverity.Warning;
        switch(Number(error.Severity))
        {
            case 0: severity = DiagnosticSeverity.Error; break;
            case 1: severity = DiagnosticSeverity.Warning; break;
            case 2: severity = DiagnosticSeverity.Information; break;
            case 3: severity = DiagnosticSeverity.Hint; break;
        }

        return {
            severity: severity,
            range: {
                start: { line: error.Row.Start, character: error.Column.Start},
                end: { line: error.Row.End, character: error.Column.End }
            },
            message: error.Message,
            source: "linterhub:jshint"
        };
    }
}