import { IIntegration } from './ide'
import { LinterhubCliLazy, LinterhubMode } from './linterhub-cli'
import { Status, StatusNotification } from './ide.vscode'
import { IConnection, Diagnostic, DiagnosticSeverity, TextDocument } from 'vscode-languageserver';
import * as i from "./linterhub-installer"
import * as path from 'path';

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
        mode: LinterhubMode,
		cliPath: any;
	}
	[key: string]: any;
}

class FileResult
{
    public readonly uri: string;
    public diagnostics: Diagnostic[];
	constructor (uri: string, diagnostics: Diagnostic[]) {
        this.uri = uri;
        this.diagnostics = diagnostics;
	}
}

export class Integration implements IIntegration {
    private systemId: string = "_system";
    private linterhub: LinterhubCliLazy;
    private connection: IConnection;
    private settings: Settings;
    private project: string;

    private onReady: Promise<{}>;

    constructor(project: string, connection: IConnection) {
        this.project = project;
        this.connection = connection;
    }
    initialize(settings: Settings = null) {

        this.settings = settings;
        
        this.settings.linterhub.run = this.settings.linterhub.run.map(value => Run[value.toString()]);
        this.settings.linterhub.mode = LinterhubMode[this.settings.linterhub.mode.toString()];
        this.linterhub = new LinterhubCliLazy(this.connection.console, this.settings.linterhub.cliPath, this.project, this.settings.linterhub.mode);

        let path_cli = path.resolve(__dirname);
        this.connection.console.warn(path_cli);
        this.onReady = this.linterhub.version();
        return this.onReady;
        /*const config = vscode.workspace.getConfiguration();
        const proxy = config.get<string>('http.proxy');
        const strictSSL = config.get('http.proxyStrictSSL', true);*/

        /*const config = vscode.workspace.getConfiguration();
        const proxy = config.get<string>('http.proxy');
        const strictSSL = config.get('http.proxyStrictSSL', true);*/
        /*
        i.install(this.settings.linterhub.mode, null, true, this.connection.console).catch(e => {
            this.connection.console.error(e.toString());
        }).then(x => {
            this.connection.console.info('installed!');
        });
*/
    }
    private run(action: () => Promise<{}>, id: string): Promise<{}> {
        var that = this;
        that.connection.sendNotification(StatusNotification, { state: Status.progressStart, id: id });
        return action().then((result) => {
            that.connection.sendNotification(StatusNotification, { state: Status.progressEnd, id: id });
            return result;
        }).catch((reason) => {
            return this.connection.console.error(reason.toString());
        })      
    }
    analyze() {
        if (this.settings.linterhub.run.indexOf(Run.onStart) < 0) {
            return null;
        }

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
            return document;
        }

        return this.onReady
            .then(() => { this.connection.console.info(`SERVER: analyze file '${path}'.`) })
            .then(() => { this.connection.sendNotification(StatusNotification, { state: Status.progressStart, id: path }) })
            .then(() => this.linterhub.analyzeFile(path))
            .then((data: string) => this.sendDiagnostics(data))
            .then(() => { this.connection.sendNotification(StatusNotification, { state: Status.progressEnd, id: path }) })
            .then(() => { this.connection.console.info(`SERVER: finish analyze file '${path}'.`); })
            .catch((e) => { this.connection.console.error(e.toString()); });
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
    install(): Promise<string> {
        return i.install(
            this.settings.linterhub.mode,
            __dirname + '/../../',
            null,
            true,
            this.connection.console);        
    }
    private sendDiagnostics(data: any) {
        this.connection.console.info("data: " + data);
        let json = JSON.parse(data);

        let files: any[] = [];
        let results: any[] = [];
        // TODO: Simplify logic.
        for (let index = 0; index < json.length; index++) {
            var linterResult = json[index];
            linterResult.Model.Files.forEach((file: any) => {
                let result: FileResult = this.getFileResult(file, linterResult.Name);
                let fileIndex = files.indexOf(file.Path);
                if (fileIndex < 0) {
                    files.push(file.Path);
                    results.push(result);
                } else {
                    results[fileIndex].diagnostics = 
                        results[fileIndex].diagnostics.concat(result.diagnostics);
                }
            });
        }
        
        for (let index = 0; index < results.length; index++) {
            this.connection.sendDiagnostics(results[index]);
        }
    }
    private getFileResult(file: any, name: any): FileResult {
        let path = 'file://' + this.project + '/' + file.Path;
        let diagnostics = file.Errors.map((error: any) => this.convertError(error, name));
        return new FileResult(path, diagnostics);
    }
    private convertError(error: any, name: any): Diagnostic {
        let severity = DiagnosticSeverity.Warning;
        switch(Number(error.Severity))
        {
            case 0: severity = DiagnosticSeverity.Error; break;
            case 1: severity = DiagnosticSeverity.Warning; break;
            case 2: severity = DiagnosticSeverity.Information; break;
            case 3: severity = DiagnosticSeverity.Hint; break;
        }

        let row = error.Row || { Start: error.Line, End: error.Line };
        let column = error.Column || { Start: error.Character, End: error.Character };
        // TODO: Do we need -1 for rows?
        return {
            severity: severity,
            range: {
                start: { line: row.Start - 1, character: column.Start },
                end: { line: row.End - 1, character: column.End }
            },
            message: error.Message,
            source: "linterhub:" + name
        };
    }
}