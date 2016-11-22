export interface IIntegration {
    initialize();
    analyze();
    analyzeFile(path: string);
    activate(linter: string);
    deactivate(linter: string);
}

export interface IUiIntegration extends IIntegration {
    activate();
    deactivate();
}