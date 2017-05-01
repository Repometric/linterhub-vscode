import { LinterhubTypes } from '@repometric/linterhub-ide';
import { IConnection, Diagnostic, DiagnosticSeverity, PublishDiagnosticsParams } from 'vscode-languageserver';
import Uri from 'vscode-uri';
import * as path from 'path';
import { UpdateConfigRequest, StatusNotification, Status } from 'linterhub-vscode-shared';

class FileResult {
    public readonly uri: string;
    public diagnostics: Diagnostic[];
    constructor(uri: string, diagnostics: Diagnostic[]) {
        this.uri = uri;
        this.diagnostics = diagnostics;
    }
}

export class Logger implements LinterhubTypes.LoggerInterface {
    private connection: IConnection;
    private prefix: string = "Linterhub Ide: ";

    constructor(connection: IConnection) {
        this.connection = connection;
    }

    public changePrefix(prefix: string)
    {
        this.prefix = prefix;
    }

    public info(string: string): void {
        this.connection.console.info(this.prefix + string);
    }
    public error(string: string): void {
        this.connection.console.error(this.prefix + string);
    }
    public warn(string: string): void {
        this.connection.console.warn(this.prefix + string);
    }
}

class StatusLogger implements LinterhubTypes.StatusInterface {
    private connection: IConnection;

    constructor(connection: IConnection) {
        this.connection = connection;
    }

    public update(id: string, progress: boolean) {
        this.connection.sendNotification(StatusNotification, { state: progress ? Status.progressStart : Status.progressEnd, id: id });
    }
}



export class IntegrationLogic {
    private linterhub_version: string;
    public logger: LinterhubTypes.LoggerInterface;
    private connection: IConnection;
    public status: LinterhubTypes.StatusInterface;
    public project: string;


    constructor(project: string, connection: IConnection, version: string) {
        this.connection = connection;
        this.logger = new Logger(this.connection);
        this.status = new StatusLogger(this.connection);
        this.project = project;
        this.linterhub_version = version;
    }


    public normalizePath(path_: string): string {
        /*path_ = path_.replace('file://', '')
            .replace(this.project + '/', '')
            .replace(this.project + '\\', '');*/
        return path.relative(this.project, Uri.parse(path_).fsPath);
    }

    public saveConfig(settings: LinterhubTypes.Settings): void {
        this.connection.sendRequest(UpdateConfigRequest, { cliPath: settings.linterhub.cliPath, mode: settings.linterhub.mode });
    }

    /**
     * Show diagnostic messages (results).
     *
     * @param data The raw data from CLI.
     */
    public sendDiagnostics(data: string, document: any = null) {
        let json: LinterhubTypes.AnalyzeResultInterface[] = JSON.parse(data);
        let files: string[] = [];
        let results: PublishDiagnosticsParams[] = [];
        // TODO: Simplify logic.
        // Iterate linters
        for (let index = 0; index < json.length; index++) {
            var linterResult = json[index];
            // Iterate files in linter result
            linterResult.Model.Files.forEach((file: LinterhubTypes.AnalyzeFileInterface) => {
                let result: FileResult = this.getFileResult(file, linterResult.Name, document);
                // Group messages by file name
                let fileIndex: number = files.indexOf(file.Path);
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

    public constructURI(path: string): string {
        return 'file://' + this.project + '/' + path;
    }

    private getFileResult(file: LinterhubTypes.AnalyzeFileInterface, name: string, document: any): FileResult {
        // TODO: Construct it as URI.
        let fullPath = document !== null ? document.uri : this.constructURI(file.Path);
        let diagnostics = file.Errors.map((error: LinterhubTypes.AnalyzeErrorInterface) => this.convertError(error, name));
        return new FileResult(fullPath.toString(), diagnostics);
    }

    /**
     * Convert message from CLI to IDE format.
     *
     * @param message The message from CLI.
     * @param name The linter name.
     */
    private convertError(message: LinterhubTypes.AnalyzeErrorInterface, name: string): Diagnostic {
        let severity = DiagnosticSeverity.Warning;
        switch (Number(message.Severity)) {
            case 0: severity = DiagnosticSeverity.Error; break;
            case 1: severity = DiagnosticSeverity.Warning; break;
            case 2: severity = DiagnosticSeverity.Information; break;
            case 3: severity = DiagnosticSeverity.Hint; break;
        }

        let row = message.Row || { Start: message.Line, End: message.Line };
        let column = message.Column;
        return {
            severity: severity,
            range: {
                start: { line: row.Start - 1, character: column.Start },
                end: { line: row.End - 1, character: column.End }
            },
            message: message.Message,
            source: "Linterhub: " + name,
            code: message.Rule.Name
        };
    }
}