import { NotificationType } from 'vscode-languageserver';
import { RequestType } from 'vscode-languageserver'
import { Types } from 'linterhub-ide';

export enum Status {
	progressStart = 1,
	progressEnd = 2,
	noCli = 10
}

export interface UpdateConfigParams {
	cliPath: string;
	mode: any;
}

export const StatusNotification: NotificationType<Types.StatusParams> = { get method() { return 'linterhub/status'; } };
export const ActivateRequest: RequestType<Types.ActivateParams, string, void> = { get method() { return 'linterhub/activate'; } };
export const CatalogRequest: RequestType<Types.NoParams, Types.CatalogResult, void> = { get method() { return 'linterhub/catalog'; } };
export const AnalyzeRequest: RequestType<Types.AnalyzeParams, void, void> = { get method() { return 'linterhub/analyze'; } };
export const InstallRequest: RequestType<Types.NoParams, Types.InstallResult, void> = { get method() { return 'linterhub/install'; } };
export const ConfigRequest: RequestType<Types.NoParams, any, void> = { get method() { return 'linterhub/config'; } };
export const LinterVersionRequest: RequestType<Types.LinterVersionParams, Types.LinterVersionResult, void> = { get method() { return 'linterhub/linterVersion'; } };
export const LinterInstallRequest: RequestType<Types.LinterVersionParams, Types.LinterVersionResult, void> = { get method() { return 'linterhub/linterInstall'; } };
export const UpdateConfigRequest: RequestType<UpdateConfigParams, any, void> = { get method() { return 'linterhub/updateconfig'; } };