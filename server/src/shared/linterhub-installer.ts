import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import { parse as parseUrl } from 'url';
import { getProxyAgent } from './proxy';
import { executeChildProcess } from './util';
import { LinterhubMode } from './linterhub-cli'
import { PlatformInformation } from './platform'
import { mkdirp } from 'mkdirp';
import * as yauzl from 'yauzl';

export function install(mode: LinterhubMode, folder: string, proxy: string, strictSSL: boolean, log: any) : Promise<string> {
    // TODO
    if (mode == LinterhubMode.docker) {
        return downloadDock("repometric/linterhub-cli");
    } else {
        return PlatformInformation.GetCurrent().then(info => {
            log.info("Platform: " + info.toString());
            let url = mode == LinterhubMode.native ? buildPackageUrl(/*info*/) : "https://github.com/Repometric/linterhub-cli/releases/download/0.2/linterhub-cli-osx.10.11-x64-0.2.zip";
            log.info("URL: " + url);
            return downloadFile(url, folder + "temp.zip", proxy, strictSSL).then(() => {
                log.info("File downloaded");
                return installFile(folder + "temp.zip", folder, log);
            });
        });
    }
}

function installFile(pathx: string, folder: any, log: any) {
    return new Promise<string>((resolve, reject) => {

        yauzl.open(pathx, { autoClose: true, lazyEntries: true }, (err, zipFile) => {
            if (err) {
                return reject(new Error('Immediate zip file error'));
            }

            zipFile.readEntry();

            zipFile.on('entry', (entry: yauzl.Entry) => {
                let absoluteEntryPath = path.resolve(/*getBaseInstallPath(pkg)*/
                folder, entry.fileName);

                if (entry.fileName.endsWith('/')) {
                    // Directory - create it
                    mkdirp(absoluteEntryPath, { mode: 0o775 }, err => {
                        if (err) {
                            return reject(new Error('Error creating directory for zip directory entry:' + err.code || ''));
                        }

                        zipFile.readEntry();
                    });
                }
                else {
                    // File - extract it
                    zipFile.openReadStream(entry, (err, readStream) => {
                        if (err) {
                            return reject(new Error('Error reading zip stream'));
                        }

                        mkdirp(path.dirname(absoluteEntryPath), { mode: 0o775 }, err => {
                            if (err) {
                                return reject(new Error('Error creating directory for zip file entry'));
                            }

                            // Make sure executable files have correct permissions when extracted
                            let fileMode = true //pkg.binaries && pkg.binaries.indexOf(absoluteEntryPath) !== -1
                                ? 0o755
                                : 0o664;

                            readStream.pipe(fs.createWriteStream(absoluteEntryPath, { mode: fileMode }));
                            readStream.on('end', () => zipFile.readEntry());
                        });
                    });
                }
            });

            zipFile.on('end', () => {
                resolve( path.resolve(folder, 'bin', 'osx.10.11-x64') );
            });

            zipFile.on('error', (err: any) => {
                log.error(err.toString());
                reject(new Error('Zip File Error:' + err.code || ''));
            });
        })
    })

}

function buildPackageUrl(/*info: PlatformInformation, proxy: string = null, strictSSL: boolean = false*/): string {
    /*let releasesUrl = "https://api.github.com/repos/repometric/linterhub-cli/releases";
    let promise = downloadJson(releasesUrl, proxy, strictSSL).then(data => {
        let json = JSON.parse(data);
        let releases = json[0]["assets"].map(x => x.browser_download_url);

    })
    return promise;*/
    // TODO: Improve this logic.
    /*let arch = info.architecture == "x86_64" ? "64" : "86";
    let version = "0.2"
    let platform = info.isMacOS() ? "osx.10.11-x64" : info.isWindows() ? "win10-x64" : "debian.8-x64" ;
    let template = "https://github.com/Repometric/linterhub-cli/releases/download/${version}/linterhub-cli-${platform}-${version}.zip";
    return template;*/
    return "https://github.com/Repometric/linterhub-cli/releases/download/0.2/linterhub-cli-osx.10.11-x64-0.2.zip";
}

export function getDockerVersion() {
    return executeChildProcess("docker version --format '{{.Server.Version}}'").then(removeNewLine);
}

export function getDotnetVersion() {
    return executeChildProcess('dotnet --version').then(removeNewLine);
}

function removeNewLine(out: string): string {
    return out.replace('\n', '').replace('\r', '');
}

export function downloadDock(name: string): Promise<string> {
    return executeChildProcess("docker pull " + name);
}

export function downloadContent(urlString: any, proxy: string, strictSSL: boolean): Promise<string> {
    const url = parseUrl(urlString);
    const options: https.RequestOptions = {
        host: url.host,
        path: url.path,
        agent: getProxyAgent(url, proxy, strictSSL),
        rejectUnauthorized: strictSSL
    };
    return new Promise<string>((resolve, reject) => {
        https.get(options, function(response){
            var body = '';

            response.on('data', function(chunk){
                body += chunk;
            });

            response.on('end', function(){
                resolve(body);
            });

            response.on('error', err => {
                reject(new Error(err.message));
            });
        })
    });
}

export function downloadFile(urlString: string, pathx: string, proxy: string, strictSSL: boolean): Promise<string> {
    const url = parseUrl(urlString);

    const options: https.RequestOptions = {
        host: url.host,
        path: url.path,
        agent: getProxyAgent(url, proxy, strictSSL),
        rejectUnauthorized: strictSSL
    };

    return new Promise<string>((resolve, reject) => {
        let request = https.request(options, response => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Redirect - download from new location
                return resolve(downloadFile(response.headers.location, pathx, proxy, strictSSL));
            }

            if (response.statusCode != 200) {
                return reject(new Error(response.statusCode.toString()));
            }
            
            // Downloading - hook up events
            let packageSize = parseInt(response.headers['content-length'], 10);
            let downloadedBytes = 0;
            let downloadPercentage = 0;
            let tmpFile = fs.createWriteStream(pathx);

            response.on('data', data => {
                downloadedBytes += data.length;

                // Update status bar item with percentage
                let newPercentage = Math.ceil(100 * (downloadedBytes / packageSize));
                if (newPercentage !== downloadPercentage) {
                    downloadPercentage = newPercentage;
                }
            });

            response.on('end', () => {
                resolve();
            });

            response.on('error', err => {
                reject(new Error(err.message));
            });

            // Begin piping data from the response to the package file
            response.pipe(tmpFile, { end: false });
        });

        request.on('error', error => {
            reject(new Error(error.message));
        });

        // Execute the request
        request.end();
    });
}