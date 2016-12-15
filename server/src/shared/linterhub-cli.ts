import { execSync, exec, spawn, ChildProcess } from "child_process";
import { executeChildProcess, Cacheable } from './util'
import * as path from 'path';

export enum LinterhubMode {
    dotnet,
    native,
    docker
}

export class LinterhubArgs {
    private cliRoot: string;
    private cliPath: string;
    private project: string;
    private mode: LinterhubMode;
    constructor(cliRoot: string, project: string, mode: LinterhubMode = LinterhubMode.dotnet) {
        this.project = project;
        this.cliRoot = cliRoot;
        this.mode = mode;
        this.cliPath = this.prefix() + ' ';
    }
    private prefix(): string {
        switch (this.mode) {
            case LinterhubMode.dotnet:
                return 'dotnet ' + path.join(this.cliRoot, 'cli.dll');
            case LinterhubMode.native:
                return path.join(this.cliRoot, 'cli');
            case LinterhubMode.docker:
                return 'TODO';
        }

        return 'unknown';
    }
    analyze(): string {
        return this.cliPath + `--mode=analyze --project=${this.project} --linter=jshint`;
    }
    analyzeFile(file: string): string {
        // TODO: Improve this code.
        let normalizedPath = file.replace('file://', '')
            .replace(this.project + '/', '')
            .replace(this.project + '\\', '');
        return this.cliPath + `--mode=analyze --project=${this.project} --file=${normalizedPath}`;
    }
    activate(linter: string): string {
        return this.cliPath + `--mode=activate --project=${this.project} --active=true --linter=${linter}`;
    }
    deactivate(linter: string): string {
        return this.cliPath + `--mode=activate --project=${this.project} --active=false --linter=${linter}`;
    }
    catalog(): string {
        return this.cliPath + `--mode=catalog`;
    }
    version(): string {
        return this.cliPath + `--mode=version`;
    }
}

export class LinterhubCli {
    private args: LinterhubArgs;
    private cliRoot: string;
    private log: any;
    constructor(log: any, cliRoot: string, project: string, mode: LinterhubMode = LinterhubMode.dotnet) {
        this.args = new LinterhubArgs(cliRoot, project, mode);
        this.cliRoot = cliRoot;
        this.log = log;
    }
    private execute(command: string): Promise<{}> {
        // TODO: Return ChildProcess in order to stop analysis when document is closed
        this.log.info('Execute command: ' + command);
        return executeChildProcess(command, this.cliRoot);
    }
    analyze(): Promise<{}> {
        return this.execute(this.args.analyze());
    }
    analyzeFile(file: string): Promise<{}> {
        return this.execute(this.args.analyzeFile(file));
    }
    catalog(): Promise<{}> {
        return this.execute(this.args.catalog());
    }
    activate(linter: string): Promise<{}> {
        return this.execute(this.args.activate(linter));
    }
    deactivate(linter: string): Promise<{}> {
        return this.execute(this.args.deactivate(linter));;
    }
    version() {
        return this.execute(this.args.version());
    }
}

export class LinterhubCliLazy extends LinterhubCli {
    private catalogValue: Cacheable;
    private versionValue: Cacheable;
    constructor(log: any, cliRoot: string, project: string, mode: LinterhubMode = LinterhubMode.dotnet) {
        super(log, cliRoot, project, mode);
        this.catalogValue = new Cacheable(() => super.catalog());
        this.versionValue = new Cacheable(() => super.version());
    }
    catalog() {
        return this.catalogValue.getValue();
    }
    version() {
        return this.versionValue.getValue();
    }
}