"use strict";
/**
 * Copyright 2023 actions-toolkit authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Buildx = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const core = __importStar(require("@actions/core"));
const semver = __importStar(require("semver"));
const git_1 = require("../buildkit/git");
const docker_1 = require("../docker/docker");
const github_1 = require("../github");
const exec_1 = require("../exec");
const util_1 = require("../util");
class Buildx {
    constructor(opts) {
        this._standalone = opts === null || opts === void 0 ? void 0 : opts.standalone;
        this._version = '';
        this._versionOnce = false;
    }
    static get configDir() {
        return process.env.BUILDX_CONFIG || path_1.default.join(docker_1.Docker.configDir, 'buildx');
    }
    static get refsDir() {
        return path_1.default.join(Buildx.configDir, 'refs');
    }
    static get refsGroupDir() {
        return path_1.default.join(Buildx.refsDir, '__group__');
    }
    static get certsDir() {
        return path_1.default.join(Buildx.configDir, 'certs');
    }
    isStandalone() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const standalone = (_a = this._standalone) !== null && _a !== void 0 ? _a : !(yield docker_1.Docker.isAvailable());
            core.debug(`Buildx.isStandalone: ${standalone}`);
            return standalone;
        });
    }
    getCommand(args) {
        return __awaiter(this, void 0, void 0, function* () {
            const standalone = yield this.isStandalone();
            return {
                command: standalone ? 'buildx' : 'docker',
                args: standalone ? args : ['buildx', ...args]
            };
        });
    }
    isAvailable() {
        return __awaiter(this, void 0, void 0, function* () {
            const cmd = yield this.getCommand([]);
            const ok = yield exec_1.Exec.getExecOutput(cmd.command, cmd.args, {
                ignoreReturnCode: true,
                silent: true
            })
                .then(res => {
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    core.debug(`Buildx.isAvailable cmd err: ${res.stderr.trim()}`);
                    return false;
                }
                return res.exitCode == 0;
            })
                .catch(error => {
                core.debug(`Buildx.isAvailable error: ${error}`);
                return false;
            });
            core.debug(`Buildx.isAvailable: ${ok}`);
            return ok;
        });
    }
    version() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._versionOnce) {
                return this._version;
            }
            this._versionOnce = true;
            const cmd = yield this.getCommand(['version']);
            this._version = yield exec_1.Exec.getExecOutput(cmd.command, cmd.args, {
                ignoreReturnCode: true,
                silent: true
            }).then(res => {
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    throw new Error(res.stderr.trim());
                }
                return Buildx.parseVersion(res.stdout.trim());
            });
            return this._version;
        });
    }
    printVersion() {
        return __awaiter(this, void 0, void 0, function* () {
            const cmd = yield this.getCommand(['version']);
            yield exec_1.Exec.exec(cmd.command, cmd.args, {
                failOnStdErr: false
            });
        });
    }
    static parseVersion(stdout) {
        const matches = /\sv?([0-9a-f]{7}|[0-9.]+)/.exec(stdout);
        if (!matches) {
            throw new Error(`Cannot parse buildx version`);
        }
        return matches[1];
    }
    versionSatisfies(range, version) {
        return __awaiter(this, void 0, void 0, function* () {
            const ver = version !== null && version !== void 0 ? version : (yield this.version());
            if (!ver) {
                core.debug(`Buildx.versionSatisfies false: undefined version`);
                return false;
            }
            const res = semver.satisfies(ver, range) || /^[0-9a-f]{7}$/.exec(ver) !== null;
            core.debug(`Buildx.versionSatisfies ${ver} statisfies ${range}: ${res}`);
            return res;
        });
    }
    static resolveCertsDriverOpts(driver, endpoint, cert) {
        let url;
        try {
            url = new URL(endpoint);
        }
        catch (e) {
            return [];
        }
        if (url.protocol != 'tcp:') {
            return [];
        }
        const driverOpts = [];
        if (Object.keys(cert).length == 0) {
            return driverOpts;
        }
        let host = url.hostname;
        if (url.port.length > 0) {
            host += `-${url.port}`;
        }
        if (cert.cacert !== undefined) {
            const cacertpath = path_1.default.join(Buildx.certsDir, `cacert_${host}.pem`);
            fs_1.default.writeFileSync(cacertpath, cert.cacert);
            driverOpts.push(`cacert=${cacertpath}`);
        }
        if (cert.cert !== undefined) {
            const certpath = path_1.default.join(Buildx.certsDir, `cert_${host}.pem`);
            fs_1.default.writeFileSync(certpath, cert.cert);
            driverOpts.push(`cert=${certpath}`);
        }
        if (cert.key !== undefined) {
            const keypath = path_1.default.join(Buildx.certsDir, `key_${host}.pem`);
            fs_1.default.writeFileSync(keypath, cert.key);
            driverOpts.push(`key=${keypath}`);
        }
        if (driver != 'remote') {
            return [];
        }
        return driverOpts;
    }
    static localState(ref, dir) {
        const [builderName, nodeName, id] = ref.split('/');
        if (!builderName || !nodeName || !id) {
            throw new Error(`Invalid build reference: ${ref}`);
        }
        const lsPath = path_1.default.join(dir || Buildx.refsDir, builderName, nodeName, id);
        if (!fs_1.default.existsSync(lsPath)) {
            throw new Error(`Local state not found in ${lsPath}`);
        }
        return Buildx.fixLocalState(JSON.parse(fs_1.default.readFileSync(lsPath, 'utf8')));
    }
    // https://github.com/docker/buildx/pull/2560
    static fixLocalState(ls) {
        const fnTrimToValidContext = function (inp) {
            const match = inp.match(/(.*)(https?:\/{1,2}\S+|ssh:\/{1,2}\S+|git:\/{1,2}\S+)/i);
            if (match && match.length == 3) {
                const trimed = match[1];
                let url = match[2];
                if (url.startsWith('https:/') && !url.startsWith('https://')) {
                    url = url.replace('https:/', 'https://');
                }
                if (url.startsWith('http:/') && !url.startsWith('http://')) {
                    url = url.replace('http:/', 'http://');
                }
                if (url.startsWith('ssh:/') && !url.startsWith('ssh://')) {
                    url = url.replace('ssh:/', 'ssh://');
                }
                if (url.startsWith('git:/') && !url.startsWith('git://')) {
                    url = url.replace('git:/', 'git://');
                }
                return [url, trimed, true];
            }
            return [inp, '', false];
        };
        const [contextPath, trimedPath, isURL] = fnTrimToValidContext(ls.LocalPath);
        if (isURL) {
            ls.LocalPath = contextPath;
            if (ls.DockerfilePath.indexOf(trimedPath) === 0) {
                ls.DockerfilePath = ls.DockerfilePath.substring(trimedPath.length);
            }
        }
        ls.LocalPath = ls.LocalPath.endsWith('/-') ? '-' : ls.LocalPath;
        ls.DockerfilePath = ls.DockerfilePath.endsWith('/-') ? '-' : ls.DockerfilePath;
        return ls;
    }
    static refs(opts, refs = {}) {
        const { dir, builderName, nodeName, since } = opts;
        let dirpath = path_1.default.resolve(dir);
        if (opts.builderName) {
            dirpath = path_1.default.join(dirpath, opts.builderName);
        }
        if (opts.nodeName) {
            dirpath = path_1.default.join(dirpath, opts.nodeName);
        }
        if (!fs_1.default.existsSync(dirpath)) {
            return refs;
        }
        const files = fs_1.default.readdirSync(dirpath);
        for (const file of files) {
            const filePath = path_1.default.join(dirpath, file);
            const stat = fs_1.default.statSync(filePath);
            if (stat.isDirectory()) {
                const nopts = Object.assign({}, opts);
                if (!builderName) {
                    if (file === '__group__') {
                        continue;
                    }
                    nopts.builderName = file;
                }
                else if (!nodeName) {
                    nopts.nodeName = file;
                }
                Buildx.refs(nopts, refs);
            }
            else {
                if (since && stat.mtime < since) {
                    continue;
                }
                const localState = Buildx.fixLocalState(JSON.parse(fs_1.default.readFileSync(filePath, 'utf8')));
                const ref = `${builderName}/${nodeName}/${file}`;
                refs[ref] = localState;
            }
        }
        return refs;
    }
    static convertWarningsToGitHubAnnotations(warnings, buildRefs, refsDir) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (warnings.length === 0) {
                return;
            }
            const fnGitURL = function (inp) {
                try {
                    return git_1.Git.parseURL(inp);
                }
                catch (e) {
                    // noop
                }
            };
            const fnLocalState = function (ref) {
                try {
                    return Buildx.localState(ref, refsDir);
                }
                catch (e) {
                    core.debug(`Buildx.convertWarningsToGitHubAnnotations(${ref}): local state not found: ${e.message}`);
                }
            };
            const dockerfiles = [];
            for (const ref of buildRefs) {
                const ls = fnLocalState(ref);
                if (!ls) {
                    continue;
                }
                if (ls.DockerfilePath == '-') {
                    // exclude dockerfile from stdin
                    core.debug(`Buildx.convertWarningsToGitHubAnnotations(${ref}): skipping stdin Dockerfile`);
                    continue;
                }
                else if (ls.DockerfilePath == '') {
                    ls.DockerfilePath = 'Dockerfile';
                }
                const gitURL = fnGitURL(ls.LocalPath);
                if (gitURL) {
                    core.debug(`Buildx.convertWarningsToGitHubAnnotations(${ref}): git context detected: ${ls.LocalPath}`);
                    const remoteHost = gitURL.host.replace(/:.*/, '');
                    if (remoteHost !== 'github.com' && !remoteHost.endsWith('.ghe.com')) {
                        // we only support running actions on GitHub for now
                        // we might add support for GitLab in the future
                        core.debug(`Buildx.convertWarningsToGitHubAnnotations(${ref}): not a GitHub repo: ${remoteHost}`);
                        continue;
                    }
                    // if repository matches then we can link to the Dockerfile
                    const remoteRepo = gitURL.path.replace(/^\//, '').replace(/\.git$/, '');
                    if (remoteRepo !== github_1.GitHub.repository) {
                        core.debug(`Buildx.convertWarningsToGitHubAnnotations(${ref}): not same GitHub repo: ${remoteRepo} != ${github_1.GitHub.repository}`);
                        continue;
                    }
                    dockerfiles.push({
                        path: ls.DockerfilePath, // dockerfile path is always relative for a git context
                        remote: true
                    });
                    continue;
                }
                if (!fs_1.default.existsSync(ls.DockerfilePath)) {
                    core.debug(`Buildx.convertWarningsToGitHubAnnotations: Dockerfile not found from localstate ref ${ref}: ${ls.DockerfilePath}`);
                    continue;
                }
                const workspaceDir = github_1.GitHub.workspace;
                // only treat dockerfile path relative to GitHub actions workspace dir
                if (util_1.Util.isPathRelativeTo(workspaceDir, ls.DockerfilePath)) {
                    dockerfiles.push({
                        path: path_1.default.relative(workspaceDir, ls.DockerfilePath),
                        content: Buffer.from(fs_1.default.readFileSync(ls.DockerfilePath, { encoding: 'utf-8' }), 'utf-8').toString('base64')
                    });
                }
                else {
                    core.debug(`Buildx.convertWarningsToGitHubAnnotations: skipping Dockerfile outside of workspace: ${ls.DockerfilePath}`);
                }
            }
            if (dockerfiles.length === 0) {
                core.debug(`Buildx.convertWarningsToGitHubAnnotations: no Dockerfiles found`);
                return;
            }
            core.debug(`Buildx.convertWarningsToGitHubAnnotations: found ${dockerfiles.length} Dockerfiles: ${JSON.stringify(dockerfiles, null, 2)}`);
            const annotations = [];
            for (const warning of warnings) {
                if (!warning.detail || !warning.short) {
                    core.debug(`Buildx.convertWarningsToGitHubAnnotations: skipping warning without detail or short`);
                    continue;
                }
                const warningSourceFilename = (_a = warning.sourceInfo) === null || _a === void 0 ? void 0 : _a.filename;
                const warningSourceData = (_b = warning.sourceInfo) === null || _b === void 0 ? void 0 : _b.data;
                if (!warningSourceFilename || !warningSourceData) {
                    core.debug(`Buildx.convertWarningsToGitHubAnnotations: skipping warning without source info filename or data`);
                    continue;
                }
                const title = warning.detail.map(encoded => atob(encoded)).join(' ');
                let message = atob(warning.short).replace(/\s\(line \d+\)$/, '');
                if (warning.url) {
                    // https://github.com/docker/buildx/blob/d8c9ebde1fdcf659f1fa3efa6ccc27a28b0f1564/commands/build.go#L854
                    message += `\nMore info: ${warning.url}`;
                }
                // GitHub's annotations don't clearly show ranges of lines, so we'll just
                // show the first line: https://github.com/orgs/community/discussions/129899
                const startLine = warning.range && warning.range.length > 0 ? (_c = warning.range[0]) === null || _c === void 0 ? void 0 : _c.start.line : undefined;
                // TODO: When GitHub's annotations support showing ranges properly, we can use this code
                // let startLine: number | undefined, endLine: number | undefined;
                // for (const range of warning.range ?? []) {
                //   if (range.start.line && (!startLine || range.start.line < startLine)) {
                //     startLine = range.start.line;
                //   }
                //   if (range.end.line && (!endLine || range.end.line > endLine)) {
                //     endLine = range.end.line;
                //   }
                // }
                let annotated = false;
                for (const dockerfile of dockerfiles) {
                    // a valid dockerfile path and content is required to match the warning
                    // source info or always assume it's valid if this is a remote git
                    // context as we can't read the content of the Dockerfile in this case.
                    if (dockerfile.remote || (dockerfile.path.endsWith(warningSourceFilename) && dockerfile.content === warningSourceData)) {
                        annotations.push({
                            title: title,
                            message: message,
                            file: dockerfile.path,
                            startLine: startLine
                        });
                        annotated = true;
                        break;
                    }
                }
                if (!annotated) {
                    core.debug(`Buildx.convertWarningsToGitHubAnnotations: skipping warning without matching Dockerfile ${warningSourceFilename}: ${title}`);
                }
            }
            return annotations;
        });
    }
}
exports.Buildx = Buildx;
Buildx.containerNamePrefix = 'buildx_buildkit_';
//# sourceMappingURL=buildx.js.map