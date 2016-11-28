import { IIntegration } from './ide'
import { LinterhubCliLazy } from './linterhub-cli'
import { Status, StatusNotification } from './ide.vscode'
import { IConnection, NotificationType, Diagnostic, DiagnosticSeverity, Position, Range, Files, TextDocument } from 'vscode-languageserver';
import { PlatformInformation } from './platform'
import { Cacheable, executeChildProcess }  from './util'
import * as i from "./linterhub-installer"

export enum Run {
    none,
    force,
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

class FileResult
{
    public readonly uri: string;
    public readonly diagnostics: Diagnostic[];
	constructor (uri: string, diagnostics: Diagnostic[]) {
        this.uri = uri;
        this.diagnostics = diagnostics;
	}
}

let files: File[];

export class Integration implements IIntegration {
    private systemId: string = "_system";
    private linterhub: LinterhubCliLazy;
    private connection: IConnection;
    private settings: Settings;
    private project: string;

    private onReady: Promise<{}>;
    private platform: PlatformInformation;

    constructor(project: string, connection: IConnection) {
        this.project = project;
        this.connection = connection;
    }
    initialize(settings: Settings = null) {
        this.settings = settings;
        this.settings.linterhub.run = this.settings.linterhub.run.map(value => Run[value.toString()]);
        this.linterhub = new LinterhubCliLazy(this.settings.linterhub.cliPath, this.project);
        this.onReady = this.linterhub.version().catch(e => {
            this.connection.console.error(e.toString());
        });
        return this.onReady;
    }
    private run(action: () => Promise<{}>, id: string, before: string = null, after: string = null): Promise<{}> {
        var that = this;
        that.connection.sendNotification(StatusNotification, { state: Status.progressStart, id: id });
        return action().then((result) => {
            that.connection.sendNotification(StatusNotification, { state: Status.progressEnd, id: id });
            return result;
        }).catch((reason) => {
            return this.connection.console.error(reason.toString());
        })      
    }
    stopAnalysis(path: string) {
        // TODO
    }
    analyze() {
        return this.onReady
            .then(() => { this.connection.console.info(`SERVER: analyze project.`) })
            .then(() => { this.connection.sendNotification(StatusNotification, { state: Status.progressStart, id: this.project }) })
            .then(() => this.linterhub.analyze())
            .then((data: string) => this.sendDiagnostics(data))
            .then(() => { this.connection.sendNotification(StatusNotification, { state: Status.progressEnd, id: this.project }) })
            .then(() => { this.connection.console.info(`SERVER: finish analyze project.`); });
    }
    analyzeFile(path: string, document: TextDocument = null, run: Run = Run.none) {
        if (this.settings.linterhub.run.indexOf(run) < 0) {
            return;
        }

        return this.onReady
            .then(() => { this.connection.console.info(`SERVER: analyze file '${path}'.`) })
            .then(() => { this.connection.sendNotification(StatusNotification, { state: Status.progressStart, id: path }) })
            .then(() => this.linterhub.analyzeFile(path))
            .then((data: string) => this.sendDiagnostics(data))
            .then(() => { this.connection.sendNotification(StatusNotification, { state: Status.progressEnd, id: path }) })
            .then(() => { this.connection.console.info(`SERVER: finish analyze file '${path}'.`); });
    }
    catalog(): Promise<any> {
        return this.run(() => {
            return this.linterhub.catalog().then((data: string) => {
                let json: any = JSON.parse(data);
                this.connection.console.info(data);
                return json;
            });
        }, this.systemId);
    }
    activate(name: string): Promise<string> {
        return this.run(() => this.linterhub.activate(name), this.systemId).then(() => name);
    }
    deactivate(name: string) {
        return this.run(() => this.linterhub.deactivate(name), this.systemId).then(() => name);
    }
    private sendDiagnostics(data) {
        let json = JSON.parse(data);
        // TODO: Combine serveral linter results into 1
        json[0].Files.forEach(file => {
            let result: FileResult = this.getFileResult(file);
            this.connection.sendDiagnostics(result);      
        });
    }
    private getFileResult(file: any): FileResult {
        let path = 'file://' + this.project + '/' + file.Path;
        let diagnostics = file.Errors.map(error => this.convertError(error));
        return new FileResult(path, diagnostics);
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