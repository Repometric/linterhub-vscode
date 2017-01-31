import { NotificationType } from 'vscode-languageserver';
import { RequestType } from 'vscode-languageserver'
import {StatusParams, ActivateParams, CatalogResult, NoParams, LinterVersionParams, LinterVersionResult, AnalyzeParams, InstallResult} from 'linterhub-ide';

export enum Status {
	progressStart = 1,
	progressEnd = 2,
	noCli = 10
}

export const StatusNotification: NotificationType<StatusParams> = { get method() { return 'linterhub/status'; } };
export const ActivateRequest: RequestType<ActivateParams, string, void> = { get method() { return 'linterhub/activate'; } };
export const CatalogRequest: RequestType<NoParams, CatalogResult, void> = { get method() { return 'linterhub/catalog'; } };
export const AnalyzeRequest: RequestType<AnalyzeParams, void, void> = { get method() { return 'linterhub/analyze'; } };
export const InstallRequest: RequestType<NoParams, InstallResult, void> = { get method() { return 'linterhub/install'; } };
export const ConfigRequest: RequestType<NoParams, any, void> = { get method() { return 'linterhub/config'; } };
export const LinterVersionRequest: RequestType<LinterVersionParams, LinterVersionResult, void> = { get method() { return 'linterhub/linterVersion'; } };
export const LinterInstallRequest: RequestType<LinterVersionParams, LinterVersionResult, void> = { get method() { return 'linterhub/linterInstall'; } };