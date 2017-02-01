import { LoggerInterface, StatusInterface } from 'linterhub-ide'
import { Status, StatusNotification } from './ide.vscode'
import { IConnection, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import Uri from 'vscode-uri'

class FileResult {
    public readonly uri: string;
    public diagnostics: Diagnostic[];
    constructor(uri: string, diagnostics: Diagnostic[]) {
        this.uri = uri;
        this.diagnostics = diagnostics;
    }
}

class Logger implements LoggerInterface
{
    private connection: IConnection;
    private prefix: string = "SERVER: ";

    constructor(connection: IConnection)
    {
        this.connection = connection;
    }

    public info(string: string): void
    {
        this.connection.console.info(this.prefix + string);
    }
    public error(string: string): void
    {
        this.connection.console.error(this.prefix + string);
    }
    public warn(string: string): void
    {
        this.connection.console.warn(this.prefix + string);
    }
}

class StatusLogger implements StatusInterface
{
    private connection: IConnection;
    private prefix: string = "SERVER: ";

    constructor(connection: IConnection)
    {
        this.connection = connection;
    }

    public update(params: any, progress?: boolean, text?: string)
    {
        params = null;
        progress = null;
        this.connection.console.info(this.prefix + text);
    }
}

export class IntegrationLogic
{
    public connection: IConnection;
    public linterhub_version: string;
    public logger: Logger;
    public status: StatusLogger;
    public project: string;

    protected sendNotification(params: any, progress: boolean): void {
        params.state = progress ? Status.progressStart : Status.progressEnd;
        this.connection.sendNotification(StatusNotification, params)
    }

    public normalizePath(path: string): string
    {
        return Uri.parse(path).fsPath;
    }

    constructor(project: string, connection: IConnection, version: string) {
        this.connection = connection;
        this.logger = new Logger(this.connection);
        this.status = new StatusLogger(this.connection);
        this.project = project;
        this.linterhub_version = version;
    }

    public sendDiagnostics(data: string, document: any = null): any[] {
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
        return results;
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
        switch (Number(message.Severity)) {
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