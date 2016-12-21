export interface IIntegration {
    initialize(): Promise<{}>;
    analyze(): Thenable<void>;
    analyzeFile(path: string): Thenable<void>;
}

export interface IUiIntegration extends IIntegration {
    activate(): Thenable<string>;
    deactivate(): Thenable<string>;
}