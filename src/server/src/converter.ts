import { Diagnostic, DiagnosticSeverity, PublishDiagnosticsParams } from 'vscode-languageserver';
import * as path from 'path';
import { EngineResult, AnalyzeResult, AnalyzeMessage } from '@repometric/linterhub-ide';
import Uri from 'vscode-uri';

class FileResult {
    public readonly uri: string;
    public diagnostics: Diagnostic[];
    constructor(uri: string, diagnostics: Diagnostic[]) {
        this.uri = uri;
        this.diagnostics = diagnostics;
    }
}


export class Converter {

    private project: string;

    public constructor(project: string) {
        this.project = project;
    }

    public analyze(data: EngineResult[]): PublishDiagnosticsParams[] {
        let files: string[] = [];
        let results: PublishDiagnosticsParams[] = [];

        for (let index = 0; index < data.length; index++) {
            var engineResult = data[index].result;
            // Iterate files in linter result
            if (engineResult) {
                engineResult.forEach((file: AnalyzeResult) => {
                    let result: FileResult = this.getFileResult(file, data[index].engine);
                    // Group messages by file name
                    let fileIndex: number = files.indexOf(file.path);
                    if (fileIndex < 0) {
                        files.push(file.path);
                        results.push(result);
                    } else {
                        results[fileIndex].diagnostics =
                            results[fileIndex].diagnostics.concat(result.diagnostics);
                    }
                });
            }
        }

        return results;
    }

    private constructURI(path_: string): string {
        return Uri.file(path.join(this.project, path_)).toString();
    }

    private getFileResult(file: AnalyzeResult, engine: string): FileResult {
        let fullPath = this.constructURI(file.path);
        let diagnostics: Diagnostic[] = [];
        if (file.messages) {
            diagnostics = file.messages.map((error: AnalyzeMessage) => this.convertError(error, engine));
        }
        return new FileResult(fullPath.toString(), diagnostics);
    }

    /**
     * Convert message from Linterhub to vscode format.
     *
     * @param message The message from Linterhub.
     * @param name The engine name.
     */
    private convertError(message: AnalyzeMessage, engine: string): Diagnostic {

        let severity: DiagnosticSeverity = DiagnosticSeverity.Warning;

        switch (message.severity) {
            case "error": severity = DiagnosticSeverity.Error; break;
            case "warning": severity = DiagnosticSeverity.Warning; break;
            case "information": severity = DiagnosticSeverity.Information; break;
            case "hint": severity = DiagnosticSeverity.Hint; break;
        }

        if (!message.columnEnd) {
            message.columnEnd = 1000; // fix this in cli
        }

        return {
            severity: severity,
            range: {
                start: { line: message.line, character: message.column },
                end: { line: message.lineEnd, character: message.columnEnd }
            },
            message: message.message,
            source: "Linterhub:" + engine,
            code: message.ruleId
        };
    }
}