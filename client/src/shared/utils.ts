export class ProgressStep {
    parts: string[] =  process.platform === 'win32' ?
        ['-', '\\', '|', '/'] :
        ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    index: number = 0;

    next() {
        return this.parts[this.index = ++this.index % this.parts.length];
    }
}

export class Progress {
    id: number;
    interval: number;
    progressStep: ProgressStep;
    callback: (step: string) => void;
    inProgress: boolean = false;
    constructor(callback: (step: string) => void, progressStep: ProgressStep = defaultProgress, interval: number = 50) {
        this.callback = callback;
        this.progressStep = progressStep;
        this.interval = interval;
    }
    start() {
        if (this.inProgress) {
            this.stop();
        }

        this.id = setInterval(function () {                   
            this.callback(this.progressStep.next());
        }.bind(this), this.interval);
        this.inProgress = true;
    }
    stop() {
        if (this.inProgress) {
            clearInterval(this.id);
            this.inProgress = false;
            this.callback('⠀')
        }
    }
}

const defaultProgress: ProgressStep = new ProgressStep();
export function progress() {
    return defaultProgress.next();
}