import { IIntegration, IUiIntegration } from './ide'
import { ActivateRequest, CatalogRequest, Status, StatusParams } from './ide.vscode'
import { window, commands, languages, Command, Uri, StatusBarAlignment, TextEditor } from 'vscode';
import { LanguageClient, NotificationType, RequestType } from 'vscode-languageclient';
import * as utils from './utils'

export interface INotificator {
    info(message: string);
    warn(message: string);
    error(message: string);
}

export class Message implements INotificator {
    info(message: string) {
        window.showInformationMessage(message);
    }
    warn(message: string) {
        window.showWarningMessage(message);
    }
    error(message: string) {
        window.showErrorMessage(message);
    }
}

export class Log implements INotificator {
    private client: LanguageClient;
    constructor(client: LanguageClient) {
        this.client = client;
    }
    info(message: string) {
        this.client.info(message);
    }
    warn(message: string) {
        this.client.warn(message);
    }
    error(message: string) {
        this.client.error(message);
    }
}

export class Event {
    status: INotificator;
    log: INotificator;
    message: INotificator;
    constructor(status: INotificator, message : INotificator, log: INotificator) {
        this.status = status;
        this.log = log;
        this.message = message;
    }
    start() {
        //this.log.info('Start.');
    }
    stop() {
        //this.log.info('Stop.');
    }
    noCli() {
        this.message.error("Could not find Linterhub cli.");
    }
    noLinters() {
        let message = `No linters enabled for this project.`;
        this.message.warn(message);
    }
    linterActivated(name: string) {
        let message = `Linter "${name}" was sucesfully activated.`;
        this.log.info(message)
        this.message.info(message);
    }
    linterDeactivated(name: string) {
        let message = `Linter "${name}" was sucesfully deactivated.`;
        this.log.info(message)
        this.message.info(message);
    }
}

export class Integration implements IUiIntegration  {
    client: LanguageClient;
    languages: string[];
    linters: string[];
    event: Event;
    constructor(client: LanguageClient) {
        this.client = client;
    }
    setClient(client: LanguageClient) {
        this.client = client;
        this.event = new Event(null, new Message(), new Log(client));
    }
    analyze() {

    }
    analyzeFile() {

    }
    deactivate() {
        this.client.sendRequest(CatalogRequest, { }).then(x => this.deactivateByList(x.linters));
    }
    activate() {
        this.client.sendRequest(CatalogRequest, { }).then(x => this.activateByList(x.linters));
    }
    deactivateByList(linters: string[]) {
        let that = this;
        window.showQuickPick(linters).then((name: string) => {
            that.deactivateByName(name);
        });           
    }
    activateByList(linters: string[]) {
        let that = this;
        window.showQuickPick(linters).then((name: string) => {
            if (name !== undefined)
            that.activateByName(name);
        });
    }
    deactivateByName(linter: string) {
        //this.progress.start();
        return this.client.sendRequest(ActivateRequest, { activate: false, linter: linter }).then(x => {
            this.event.linterActivated(linter);
            //this.progress.stop();
        }); 
    }
    activateByName(linter: string) {
        return this.client.sendRequest(ActivateRequest, { activate: true, linter: linter }).then(x => {
            this.event.linterActivated(linter);
        }); 
    }
    showOutput() {
        this.client.outputChannel.show();
    }
    progress: utils.Progress;
    updateStatus(x: StatusParams) {
        this.client.info("Get command: " + x.id);
        if (x.state == Status.progressStart) {
            this.client.info("Start: " + x.id);
            this.progress.start();
        }
        if (x.state == Status.progressEnd) {
            this.progress.stop();
            //this.statusBarItem.text = 'Linterhub';
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
    showStatusBarItem(show: boolean): void {
        if (show) {
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }
    setupUi() {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);
        this.statusBarItem.text = 'Linterhub';
        this.statusBarItem.command = 'linterhub.showOutput';
        this.showStatusBarItem(true);
    }
    initialize() {
        let promise = new Promise((resolve, reject) => {
            this.languages = ["javascript"];
            this.progress = new utils.Progress((step) => {
                this.statusBarItem.text = 'Linterhub ' + step;
            });
            resolve();
        });

        return promise;
        /*return this.linterhub.catalog().then((data: string) => {
            let json = JSON.parse(data);
            //this.linters = json.map(x => x.name).sort();
            this.languages = json.map(x => x.languages);

            this.progress = new utils.Progress((step) => {
                this.statusBarItem.text = 'Linterhub ' + step;
            });
        })*/
    }
}