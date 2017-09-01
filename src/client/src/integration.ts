import { window, StatusBarAlignment, StatusBarItem } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { Engine, DetectedEngine, DetectType } from '@repometric/linterhub-ide';

export class Integration {
    private client: LanguageClient;
    public languages: string[];
    public statusBarItem: StatusBarItem;
    private progressBarItem: StatusBarItem;

    public setClient(client: LanguageClient): void {
        this.client = client;
        /*client.onNotification("linterhub/proxy", () =>
		{
			const config = workspace.getConfiguration();
			return {
				proxy: config.get<string>('http.proxy'),
				strictSSL: config.get('http.proxyStrictSSL', true)
			};
		});*/
        client.onNotification("linterhub/progress/visibility", (visibility: boolean) => this.showBar(this.progressBarItem, visibility));
        client.onNotification("linterhub/progress/text", (text: string) => this.progressBarItem.text = text);
    }

    public ignoreWarning(params: any): Thenable<string> {
        return this.client.sendRequest("linterhub/ignore", params);
    }

    private selectLinter(type: boolean): Thenable<{ label: string, description: string }> {
        return this.client.sendRequest("linterhub/catalog")
            .then((catalog: Engine[]) => {
                return this.client.sendRequest("linterhub/fetch")
                .then((fetched: DetectedEngine[]) => {
                    return catalog.filter(x => x.active != type).map(linter => {
                        let description = linter.description;
                        fetched.filter(x => x.name == linter.name).forEach(x => {
                            switch(x.found){
                                case DetectType.sourceExtension:
                                    description = `[by extension] ${description}`;
                                    break;
                                case DetectType.projectConfig:
                                    description = `[declarated in project config] ${description}`;
                                    break;
                                case DetectType.engineConfig:
                                    description += `[found engine config] ${description}`;
                                    break;
                            }
                        })
                        return { label: linter.name, description: description };
                    });
                });
            })
            .then(catalog => window.showQuickPick(catalog, { matchOnDescription: true }));
    }

    public activate(type: boolean): Thenable<string> {
        return this.selectLinter(type)
            .then(item => {
                if (item) {
                    let name = item.label;
                    return this.client.sendRequest("linterhub/activate", { activate: type, engine: name })
                        .then(() => window.showInformationMessage(`Engine "${name}" was sucesfully ${type ? "activated" : "deactivated"}.`));
                } else {
                    return null;
                }
            });
    }

    public showOutput(): void {
        return this.client.outputChannel.show();
    }

    private showBar(bar: any, show: boolean): void {
        if (show) {
            bar.show();
        } else {
            bar.hide();
        }
    }

    public setupUi() {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10.1);
        this.statusBarItem.text = 'Linterhub';
        this.statusBarItem.command = 'linterhub.showOutput';
        this.showBar(this.statusBarItem, true);

        this.progressBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);
        this.showBar(this.progressBarItem, false);
    }
}