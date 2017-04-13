export class ProgressStep {
    private parts: string[] =  process.platform === 'win32' ?
        ['-', '\\', '|', '/'] :
        ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    private index: number = 0;

    next(): string {
        return this.parts[this.index = ++this.index % this.parts.length];
    }
}

const defaultProgress: ProgressStep = new ProgressStep();
export function progress(): string {
    return defaultProgress.next();
}

export class Progress {
    private id: NodeJS.Timer;
    private interval: number;
    private progressStep: ProgressStep;
    private callback: (step: string) => void;
    private inProgress: boolean = false;
    constructor(callback: (step: string) => void, progressStep: ProgressStep = defaultProgress, interval: number = 80) {
        this.callback = callback;
        this.progressStep = progressStep;
        this.interval = interval;
    }
    start(): void {
        if (this.inProgress) {
            // There is no reason to create another timer
            return;
        }

        this.id = setInterval(function () {
            this.callback(this.progressStep.next());
        }.bind(this), this.interval);
        this.inProgress = true;
    }
    stop(): void {
        if (this.inProgress) {
            clearInterval(this.id);
            this.inProgress = false;
            this.callback('⠀');
        }
    }
}

export const systemProgressId: string = '_system';

export class ProgressQueue {
    private updateVisibility: (visible: boolean) => void;
    private ids: Array<string> = [];
    constructor(updateVisibility: (visible: boolean) => void) {
        this.updateVisibility = updateVisibility;
    }
    enqueue(id: string): void {
        this.ids.push(id);
        this.updateVisibility(true);
    }
    dequeue(id: string): void {
        let index = this.ids.indexOf(id);
        if (index>= 0) {
            this.ids.splice(index, 1);
        }
        this.update(id);
    }
    update(id: string): boolean {
        let index = this.ids.indexOf(id);
        let systemIndex = this.ids.indexOf(systemProgressId);
        let condition = index >= 0 || systemIndex >= 0;
        this.updateVisibility(condition);
        return condition;
    }
}

// TODO: Simplify logic.
export class ProgressManager {
    progress: Progress;
    queue: ProgressQueue;
    visibility: (visible: boolean) => void;
    constructor(visibility: (visible: boolean) => void, text: (step: string) => void) {
        this.queue = new ProgressQueue(visibility);
        this.progress = new Progress(text);
    }
    update(id: string, inProgress?: boolean): void {
        // Progress is unknown
        if (inProgress === null) {
            if (this.queue.update(id)) {
                // Display progress
                this.progress.start();
                this.visibility(true);
            } else {
                // Hide progress
                this.progress.stop();
                this.visibility(false);
            }
            return;
        }

        // Progress is known
        if (inProgress) {
            // Start progress
            this.progress.start();
            this.queue.enqueue(id);
        } else {
            // Stop progress
            this.progress.stop();
            this.queue.dequeue(id);
        }
    }
}