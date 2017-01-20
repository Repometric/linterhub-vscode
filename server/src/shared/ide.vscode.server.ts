import { LinterhubCliLazy, LinterhubMode } from './linterhub-cli'
import { Status, StatusNotification, LinterResult, ConfigRequest, ConfigResult } from './ide.vscode'
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

export class Integration {
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
    private initializeLinterhub() {
        this.linterhub = new LinterhubCliLazy(this.connection.console, this.settings.linterhub.cliPath, this.project, this.settings.linterhub.mode);
        let path_cli = path.resolve(__dirname);
        this.connection.console.warn(path_cli);
        this.onReady = this.linterhub.version();
        return this.onReady;
    }
    initialize(settings: Settings = null) {
        this.settings = settings;
        this.settings.linterhub.run = this.settings.linterhub.run.map(value => Run[value.toString()]);
        this.settings.linterhub.mode = LinterhubMode[this.settings.linterhub.mode.toString()];
        this.connection.sendRequest(ConfigRequest)
            .then((x: ConfigResult) => { this.connection.console.info(x.proxy); });

        return this.initializeLinterhub();
        
        /*
        i.install(this.settings.linterhub.mode, null, true, this.connection.console).catch(e => {
            this.connection.console.error(e.toString());
        }).then(x => {
            this.connection.console.info('installed!');
        });
*/
    }
    update(text: string) {
        this.connection.console.info(text);
    }
    install(): Promise<string> {
        this.connection.sendNotification(StatusNotification, { state: Status.progressStart, id: this.systemId });
        
        return i.getDotnetVersion()
            .then(() => { this.settings.linterhub.mode = LinterhubMode.dotnet; })
            .catch(() => { this.settings.linterhub.mode = LinterhubMode.native; })
            .then(() => { this.connection.console.info(`SERVER: start download.`); })
            .then(() => { this.connection.console.info(this.settings.linterhub.mode.toString()) })
            .then(() => {
            
                return i.install(this.settings.linterhub.mode, __dirname + '/../../', null, true, this.connection.console, this)
                    .then((data) => {
                        this.connection.console.info(`SERVER: finish download.`);
                        this.initializeLinterhub();
                        return data;
                    })
                    .catch((reason) => { 
                        this.connection.console.error(`SERVER: error catalog '${reason}.toString()'.`);
                        return [];
                    })
                    .then((result) => {
                        this.connection.sendNotification(StatusNotification, { state: Status.progressEnd, id: this.systemId });
                        return result;
                    });
            });
        
    }
    /**
     * Analyze project.
     *
     */
    analyze(): Promise<void> {
        return this.onReady
            .then(() => { this.connection.console.info(`SERVER: analyze project.`) })
            .then(() => { this.connection.sendNotification(StatusNotification, { state: Status.progressStart, id: this.project }) })
            .then(() => this.linterhub.analyze())
            .then((data: string) => this.sendDiagnostics(data))
            .catch((reason) => { this.connection.console.error(`SERVER: error analyze project '${reason}.toString()'.`) })
            .then(() => { this.connection.sendNotification(StatusNotification, { state: Status.progressEnd, id: this.project }) })
            .then(() => { this.connection.console.info(`SERVER: finish analyze project.`) });
    }
    /**
     * Analyze single file.
     *
     * @param path The relative path to file.
     * @param run The run mode (when).
     * @param document The active document.
     */
    analyzeFile(path: string, run: Run = Run.none, document: TextDocument = null): Promise<void> {
        if (this.settings.linterhub.run.indexOf(run) < 0) {
            return null;
        }

        if (document != null) {
            // TODO
        }

        return this.onReady
            .then(() => this.connection.console.info(`SERVER: analyze file '${path}'.`))
            .then(() => this.connection.sendNotification(StatusNotification, { state: Status.progressStart, id: path }))
            .then(() => this.linterhub.analyzeFile(path))
            .then((data: string) => this.sendDiagnostics(data, document))
            .catch((reason) => { this.connection.console.error(`SERVER: error analyze file '${reason}.toString()'.`) })
            .then(() => this.connection.sendNotification(StatusNotification, { state: Status.progressEnd, id: path }))
            .then(() => this.connection.console.info(`SERVER: finish analyze file '${path}'.`));
    }
    /**
     * Get linters catalog.
     *
     */
    catalog(): Promise<LinterResult[]> {
        return this.onReady
            .then(() => this.connection.sendNotification(StatusNotification, { state: Status.progressStart, id: this.systemId }))
            .then(() => this.linterhub.catalog())
            .then((data: string) => {
                let json: any = JSON.parse(data);
                this.connection.console.info(data);
                return json;
            })
            .catch((reason) => {
                this.connection.console.error(`SERVER: error catalog '${reason}.toString()'.`);
                return [];
            })
            .then((result) => {
                this.connection.sendNotification(StatusNotification, { state: Status.progressEnd, id: this.systemId });
                return result;
            });
    }
    /**
     * Activate linter.
     *
     * @param path The linter name.
     */
    activate(name: string): Promise<string> {
        return this.onReady
            .then(() => this.connection.sendNotification(StatusNotification, { state: Status.progressStart, id: this.systemId }))
            .then(() => this.linterhub.activate(name))
            .catch((reason) => { this.connection.console.error(`SERVER: error activate '${reason}.toString()'.`) })
            .then(() => this.connection.sendNotification(StatusNotification, { state: Status.progressEnd, id: this.systemId }))
            .then(() => name);
    }
    /**
     * Deactivate linter.
     *
     * @param path The linter name.
     */
    deactivate(name: string): Promise<string> {
        return this.onReady
            .then(() => this.connection.sendNotification(StatusNotification, { state: Status.progressStart, id: this.systemId }))
            .then(() => this.linterhub.deactivate(name))
            .catch((reason) => { this.connection.console.error(`SERVER: error deactivate '${reason}.toString()'.`) })
            .then(() => this.connection.sendNotification(StatusNotification, { state: Status.progressEnd, id: this.systemId }))
            .then(() => name);
    }
    /**
     * Show diagnostic messages (results).
     *
     * @param data The raw data from CLI.
     */
    private sendDiagnostics(data: any, document: any = null) {
        let json = JSON.parse(data);
        let files: any[] = [];
        let results: any[] = [];
        // TODO: Simplify logic.
        // Iterate linters
        for (let index = 0; index < json.length; index++) {
            var linterResult = json[index];
            // Iterate files in linter result
            linterResult.Model.Files.forEach((file: any) => {
                let result: FileResult = this.getFileResult(file, linterResult.Name, document);
                // Group messages by file name
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
        // Show messages
        for (let index = 0; index < results.length; index++) {
            this.connection.sendDiagnostics(results[index]);
        }
    }
    /**
     * Convert file result.
     *
     * @param file The file object.
     * @param name The linter name.
     */
    private getFileResult(file: any, name: any, document: any): FileResult {
        // TODO: Construct it as URI.
        let fullPath = document != null ? document.uri : 'file://' + this.project + '\\' + file.Path;
        let diagnostics = file.Errors.map((error: any) => this.convertError(error, name));
        return new FileResult(fullPath.toString(), diagnostics);
    }
    /**
     * Convert message from CLI to IDE format.
     *
     * @param message The message from CLI.
     * @param name The linter name.
     */
    private convertError(message: any, name: any): Diagnostic {
        let severity = DiagnosticSeverity.Warning;
        switch(Number(message.Severity))
        {
            case 0: severity = DiagnosticSeverity.Error; break;
            case 1: severity = DiagnosticSeverity.Warning; break;
            case 2: severity = DiagnosticSeverity.Information; break;
            case 3: severity = DiagnosticSeverity.Hint; break;
        }

        let row = message.Row || { Start: message.Line, End: message.Line };
        let column = message.Column || { Start: message.Character, End: message.Character };
        // TODO: Do we need -1 for rows?
        return {
            severity: severity,
            range: {
                start: { line: row.Start - 1, character: column.Start },
                end: { line: row.End - 1, character: column.End }
            },
            message: message.Message,
            source: "linterhub:" + name
        };
    }
}