import { ActivateRequest, AnalyzeRequest, CatalogRequest, Status, LinterVersionRequest, LinterInstallRequest, IgnoreWarningRequest } from 'linterhub-vscode-shared';
import { LinterhubTypes } from '@repometric/linterhub-ide';
import { window, StatusBarAlignment, TextEditor } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import * as utils from './utils';

export class Integration {
    private client: LanguageClient;
    public languages: string[];
    private progressControl: utils.ProgressManager;
    public statusBarItem: any;
    private progressBarItem: any;

    public setClient(client: LanguageClient): void {
        this.client = client;
    }

    public analyze(): Thenable<void> {
        return this.client.sendRequest(AnalyzeRequest, { full: true });
    }

    public analyzeFile(path: string): Thenable<void> {
        return this.client.sendRequest(AnalyzeRequest, { path: path });
    }

    public ignoreWarning(params: LinterhubTypes.IgnoreWarningParams): Thenable<string> {
        return this.client.sendRequest(IgnoreWarningRequest, params);
    }

    private selectLinter(): Thenable<{label: string, description: string}> {
        // TODO: Show added-and-active(for deactivate)/missing-or-not-active(for activate) linters?
        return this.client.sendRequest(CatalogRequest, { })
            .then((catalog) => {
                this.client.info(catalog.toString());
                return catalog.linters.map(linter => {
                    return { label: linter.name, description: linter.description };
                });
            })
            .then(catalog => window.showQuickPick(catalog, { matchOnDescription: true }));
    }

    public activate(): Thenable<string> {
        return this.selectLinter()
            .then(item => {
                if (item) {
                    let name = item.label;
                    return this.client.sendRequest(LinterVersionRequest, { linter: name })
                        .then((result: LinterhubTypes.LinterVersionResult) => {
                            if(result.Installed)
                            {
                                return this.client.sendRequest(ActivateRequest, { activate: true, linter: name })
                                    .then(() => window.showInformationMessage(`Linter "${name}" was sucesfully activated.`));
                            }
                            else
                            {
                                window.showWarningMessage(`Linter "${name}" is not installed. Trying to install...`);
                                return this.client.sendRequest(LinterInstallRequest, { linter: name })
                                    .then((result: LinterhubTypes.LinterVersionResult) => {
                                        if(result.Installed)
                                        {
                                            return this.client.sendRequest(ActivateRequest, { activate: true, linter: name })
                                                .then(() => window.showInformationMessage(`Linter "${name}" was sucesfully installed and activated.`));
                                        }
                                        else
                                        {
                                            window.showWarningMessage(`Can't install "${name}". Perhaps cli can't execute script as administrator`);
                                            return null;
                                        }
                                    });
                            }
                        });
                }

                return null;
            });
    }

    public deactivate(): Thenable<string> {
        return this.selectLinter()
            .then(item => {
                if (item) {
                    let name = item.label;
                    return this.client.sendRequest(ActivateRequest, { activate: false, linter: name })
                        .then(() => window.showInformationMessage(`Linter "${name}" was sucesfully deactivated.`));
                } else {
                    return null;
                }
            });
    }

    public showOutput(): void {
        return this.client.outputChannel.show();
    }

    public updateStatus(params: LinterhubTypes.StatusParams): void {
        if (params.state === Status.progressStart) {
            return this.progressControl.update(params.id, true);
        }
        if (params.state === Status.progressEnd) {
            return this.progressControl.update(params.id, false);
        }
        if (params.state === Status.noCli) {
            return this.progressControl.update(params.id, false);
        }

    }

    private showBar(bar: any, show: boolean): void {
        if (show) {
            bar.show();
        } else {
            bar.hide();
        }
    }

    public updateProgressVisibility(editor: TextEditor) {
        this.client.info('OPEN: ' + editor.document.uri.toString());
        this.progressControl.update(editor.document.uri.toString());
    }

    public setupUi() {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10.1);
        this.statusBarItem.text = 'Linterhub';
        this.statusBarItem.command = 'linterhub.showOutput';
        this.showBar(this.statusBarItem, true);

        this.progressBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);
        this.showBar(this.progressBarItem, false);

        window.onDidChangeActiveTextEditor((doc) => {
            this.updateProgressVisibility(doc);
        });
    }

    public initialize(): Promise<{}> {
        let promise = new Promise((resolve) => {
            this.languages = ["javascript"];
            this.progressControl = new utils.ProgressManager(
                (visible) => this.showBar(this.progressBarItem, visible),
                (text) => this.progressBarItem.text = text);
            resolve();
        });

        return promise;
    }
}