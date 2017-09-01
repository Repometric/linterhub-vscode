import { Logger } from "@repometric/linterhub-ide";
import { IConnection } from 'vscode-languageserver';

/**
 * Implementation of Logger Interface
 */
export class VscodeLogger implements Logger {
    private connection: IConnection;
    private prefix: string;

    /**
     * @constructor
     */
    constructor(connection: IConnection, prefix: string = "Linterhub Ide: ") {
        this.connection = connection;
        this.prefix = prefix;
    }

    /**
     * Change logger prefix
     * @method changePrefix
     * @param {string} prefix Prefix for logger
     */
    public changePrefix(prefix: string) {
        this.prefix = prefix;
    }

    /**
	 * Prints ordinary information
	 * @method info
	 * @param {string} text Text to print
	 */
    public info(text: string): void {
        this.connection.console.info(this.prefix + text);
    }

    /**
	 * Prints errors
	 * @method error
	 * @param {string} text Text to print
	 */
    public error(text: string): void {
        this.connection.console.error(this.prefix + text);
    }

    /**
	 * Prints warnings
	 * @method warn
	 * @param {string} text Text to print
	 */
    public warn(text: string): void {
        this.connection.console.warn(this.prefix + text);
    }
}