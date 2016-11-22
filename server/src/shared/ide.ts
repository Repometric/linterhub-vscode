export interface IIntegration {
    initialize();
    analyze();
    analyzeFile(path: string);
    activate(linter: string);
    deactivate(linter: string);
}