import { execSync, exec, spawn } from "child_process";
const Catalog = '--mode=catalog';
const Version = '--mode=version';
const Activate = "";
const Deactivate = "";
const Analyze = "--mode=analyze --project={1}";

export class LinterhubCli {
    cliRoot: string;
    cliPath: string;
    cli: string;
    project: string;
    constructor(cliRoot: string, project: string) {
        this.project = project;
        this.cliRoot = cliRoot;
        this.cliPath = cliRoot + 'cli.dll';
        this.cli = 'dotnet ' + this.cliPath + ' ';
    }
    private execute(command: string): Promise<{}> {
        let promise = new Promise((resolve, reject) => {
            // TODO: Use spawn and buffers.
            exec(this.cli + command, { cwd: this.cliRoot, maxBuffer: 1024 * 1024 * 500 }, function (error, stdout, stderr) {
                let execError = stderr.toString();
                if (error) {
                    reject(new Error(error.message));
                } else if (execError !== '') {
                    reject(new Error(execError));
                } else {
                    resolve(stdout);
                }
            });
        });

        return promise;
    }
    analyze(): Promise<{}> {
        return this.execute(Version);
    }
    analyzeFile(path: string): Promise<{}> {
        return this.execute(`--mode=analyze --project=${this.project} --linter=jshint`);
    }
    catalog(): Promise<{}> {
        return this.execute(Catalog);
    }
    activate(linter: string): Promise<{}> {
        return this.execute(Version);;
    }
    deactivate(linter: string): Promise<{}> {
        return this.execute(Version);;
    }
    version() {
        return this.execute(Version);
    }
}