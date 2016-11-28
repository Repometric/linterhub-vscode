import { NotificationType } from 'vscode-languageclient';
import { RequestType } from 'vscode-languageclient'

export enum Status {
	progressStart = 1,
	progressEnd = 2,
	noCli = 10
}

export interface NoParams {
}

export interface StatusParams {
	id: string;
	state: Status;
}

export interface ActivateParams {
	activate: boolean;
	linter: string;
}

export interface AnalyzeParams {
	full: boolean;
	path: string;
}

export interface NoResult {
}

export interface LinterResult {
	name: string;
	description: string;
	languages: string;
}

export interface CatalogResult {
    linters: LinterResult[];
}

export const StatusNotification: NotificationType<StatusParams> = { get method() { return 'linterhub/status'; } };
export const ActivateRequest: RequestType<ActivateParams, string, void> = { get method() { return 'linterhub/activate'; } };
export const CatalogRequest: RequestType<NoParams, CatalogResult, void> = { get method() { return 'linterhub/catalog'; } };
export const AnalyzeRequest: RequestType<AnalyzeParams, void, void> = { get method() { return 'linterhub/analyze'; } };