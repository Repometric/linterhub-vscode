import { IIntegration, IUiIntegration } from './ide'
import { ActivateRequest, AnalyzeRequest, CatalogRequest, Status, StatusParams } from './ide.vscode'
import { window, commands, languages, Command, Uri, StatusBarAlignment, TextEditor, QuickPickItem, QuickPickOptions } from 'vscode';
import { LanguageClient, NotificationType, RequestType } from 'vscode-languageclient';
import * as utils from './utils'

export class Integration implements IUiIntegration  {
    client: LanguageClient;
    languages: string[];
    linters: string[];
    constructor(client: LanguageClient) {
        this.client = client;
    }
    setClient(client: LanguageClient) {
        this.client = client;
    }
    analyze() {
        return this.client.sendRequest(AnalyzeRequest, { full: true });
    }
    analyzeFile(path: string) {
        return this.client.sendRequest(AnalyzeRequest, { path: path });
    }
    selectLinter() {
        // TODO: Show added-and-active(for deactivate)/missing-or-not-active(for activate) linters?
        return this.client.sendRequest(CatalogRequest, { })
            .then((catalog) => {
                this.client.info(catalog.toString());
                return catalog.linters.map<QuickPickItem>(linter => { 
                    return { label: linter.name, description: linter.description }
                }) 
            })
            .then(catalog => window.showQuickPick(catalog, { matchOnDescription: true }));
    }
    activate() {
        return this.selectLinter()
            .then(item => {
                if (item) {
                    let name = item.label;
                    return this.client.sendRequest(ActivateRequest, { activate: true, linter: name })
                        .then(() => window.showInformationMessage(`Linter "${name}" was sucesfully activated.`));
                }
            });
        
    }
    deactivate() {
        return this.selectLinter()
            .then(item => {
                if (item) {
                    let name = item.label;
                    return this.client.sendRequest(ActivateRequest, { activate: true, linter: name })
                        .then(() => window.showInformationMessage(`Linter "${name}" was sucesfully deactivated.`));
                }
            });
    }
    showOutput(): void {
        return this.client.outputChannel.show();
    }
    updateStatus(x: StatusParams) {
        if (x.state == Status.progressStart) {
            this.client.info("Start: " + x.id);
            this.progressControl.update(x.id, true);
        }
        if (x.state == Status.progressEnd) {
            this.progressControl.update(x.id, false);
        }

        if (x.state == Status.noCli) {
            window.showWarningMessage("Unable to find Linterhub cli.", 'Download', 'Visit Website').then(function (selection) {
                if (selection === 'Visit Website') {
                    commands.executeCommand('vscode.open', Uri.parse('https://google.com'));
                } else if (selection = 'Download') {
                    // TODO
                }
            });
        }
    }
    statusBarItem: any;
    progressBarItem: any;
    showBar(bar, show: boolean): void {
        if (show) {
            bar.show();
        } else {
            bar.hide();
        }
    }
    updateProgressVisibility(editor: TextEditor) {
        this.client.info('OPEN: ' + editor.document.uri.toString());
        this.progressControl.update(editor.document.uri.toString());
    }
    setupUi() {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10.1);
        this.statusBarItem.text = 'Linterhub';
        this.statusBarItem.command = 'linterhub.showOutput';
        this.showBar(this.statusBarItem, true);

        this.progressBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);
        this.showBar(this.progressBarItem, false);

        window.onDidChangeActiveTextEditor((doc) => {
            this.updateProgressVisibility(doc)
        });
    }
    progressControl: utils.ProgressManager;
    initialize(): Promise<{}> {
        let promise = new Promise((resolve, reject) => {
            this.languages = ["javascript"];
            this.progressControl = new utils.ProgressManager(
                (visible) => this.showBar(this.progressBarItem, visible),
                (text) => this.progressBarItem.text = text);
            resolve();
        });

        return promise;
    }
}