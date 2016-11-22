import { NotificationType } from 'vscode-languageserver';
import { RequestType } from 'vscode-languageserver'

export enum Status {
	progressStart = 1,
	progressEnd = 2,
	noCli = 10
}

export interface StatusParams {
	id: string;
	state: Status;
}

export interface NoParams {
}

export interface ActivateParams {
	activate: boolean;
	linter: string;
}

export interface NoResult {
}

export interface CatalogResult {
    linters: string[];
}

export const StatusNotification: NotificationType<StatusParams> = { get method() { return 'linterhub/status'; } };
export const ActivateRequest: RequestType<ActivateParams, NoResult, void> = { get method() { return 'linterhub/activate'; } };
export const CatalogRequest: RequestType<NoParams, CatalogResult, void> = { get method() { return 'linterhub/catalog'; } };