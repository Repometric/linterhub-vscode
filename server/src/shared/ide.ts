export interface IIntegration {
    initialize(): any;
    analyze(): any;
    analyzeFile(path: string): any;
    activate(linter: string): any;
    deactivate(linter: string): any;
}