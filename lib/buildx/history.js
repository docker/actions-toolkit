"use strict";
/**
 * Copyright 2024 actions-toolkit authors
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
exports.History = void 0;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const core = __importStar(require("@actions/core"));
const buildx_1 = require("./buildx");
const context_1 = require("../context");
const docker_1 = require("../docker/docker");
const exec_1 = require("../exec");
const github_1 = require("../github");
const util_1 = require("../util");
class History {
    constructor(opts) {
        this.buildx = (opts === null || opts === void 0 ? void 0 : opts.buildx) || new buildx_1.Buildx();
    }
    getCommand(args) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.buildx.getCommand(['history', ...args]);
        });
    }
    getInspectCommand(args) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getCommand(['inspect', ...args]);
        });
    }
    getExportCommand(args) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getCommand(['export', ...args]);
        });
    }
    inspect(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['--format', 'json'];
            if (opts.builder) {
                args.push('--builder', opts.builder);
            }
            if (opts.ref) {
                args.push(opts.ref);
            }
            const cmd = yield this.getInspectCommand(args);
            return yield exec_1.Exec.getExecOutput(cmd.command, cmd.args, {
                ignoreReturnCode: true,
                silent: true
            }).then(res => {
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    throw new Error(res.stderr.trim());
                }
                return JSON.parse(res.stdout);
            });
        });
    }
    export(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            let builderName = '';
            let nodeName = '';
            const refs = [];
            for (const ref of opts.refs) {
                const refParts = ref.split('/');
                if (refParts.length != 3) {
                    throw new Error(`Invalid build ref: ${ref}`);
                }
                refs.push(refParts[2]);
                // Set builder name and node name from the first ref if not already set.
                // We assume all refs are from the same builder and node.
                if (!builderName) {
                    builderName = refParts[0];
                }
                if (!nodeName) {
                    nodeName = refParts[1];
                }
            }
            if (refs.length === 0) {
                throw new Error('No build refs provided');
            }
            const outDir = path_1.default.join(context_1.Context.tmpDir(), 'export');
            core.info(`exporting build record to ${outDir}`);
            fs_1.default.mkdirSync(outDir, { recursive: true });
            if (opts.useContainer || (yield this.buildx.versionSatisfies('<0.23.0'))) {
                return yield this.exportLegacy(builderName, nodeName, refs, outDir, opts.image);
            }
            if (yield this.buildx.versionSatisfies('<0.24.0')) {
                // wait 3 seconds to ensure build records are finalized: https://github.com/moby/buildkit/pull/5109
                // not necessary since buildx 0.24.0: https://github.com/docker/buildx/pull/3152
                yield util_1.Util.sleep(3);
            }
            const summaries = {};
            if (!opts.noSummaries) {
                for (const ref of refs) {
                    yield this.inspect({
                        ref: ref,
                        builder: builderName
                    }).then(res => {
                        var _a;
                        let errorLogs = '';
                        if (res.Error && res.Status !== 'canceled') {
                            if (res.Error.Message) {
                                errorLogs = res.Error.Message;
                            }
                            else if (res.Error.Name && res.Error.Logs) {
                                errorLogs = `=> ${res.Error.Name}\n${res.Error.Logs}`;
                            }
                        }
                        summaries[ref] = {
                            name: res.Name,
                            status: res.Status,
                            duration: util_1.Util.formatDuration(res.Duration),
                            numCachedSteps: res.NumCachedSteps,
                            numTotalSteps: res.NumTotalSteps,
                            numCompletedSteps: res.NumCompletedSteps,
                            defaultPlatform: (_a = res.Platform) === null || _a === void 0 ? void 0 : _a[0],
                            error: errorLogs
                        };
                    });
                }
            }
            const dockerbuildPath = path_1.default.join(outDir, `${History.exportFilename(refs)}.dockerbuild`);
            const exportArgs = ['--builder', builderName, '--output', dockerbuildPath, ...refs];
            if (yield this.buildx.versionSatisfies('>=0.24.0')) {
                exportArgs.push('--finalize');
            }
            const cmd = yield this.getExportCommand(exportArgs);
            yield exec_1.Exec.getExecOutput(cmd.command, cmd.args);
            const dockerbuildStats = fs_1.default.statSync(dockerbuildPath);
            return {
                dockerbuildFilename: dockerbuildPath,
                dockerbuildSize: dockerbuildStats.size,
                builderName: builderName,
                nodeName: nodeName,
                refs: refs,
                summaries: summaries
            };
        });
    }
    exportLegacy(builderName, nodeName, refs, outDir, image) {
        return __awaiter(this, void 0, void 0, function* () {
            if (os_1.default.platform() === 'win32') {
                throw new Error('Exporting a build record is currently not supported on Windows');
            }
            if (!(yield docker_1.Docker.isAvailable())) {
                throw new Error('Docker is required to export a build record');
            }
            if (!(yield docker_1.Docker.isDaemonRunning())) {
                throw new Error('Docker daemon needs to be running to export a build record');
            }
            if (!(yield this.buildx.versionSatisfies('>=0.13.0'))) {
                throw new Error('Buildx >= 0.13.0 is required to export a build record');
            }
            // wait 3 seconds to ensure build records are finalized: https://github.com/moby/buildkit/pull/5109
            yield util_1.Util.sleep(3);
            const buildxInFifoPath = context_1.Context.tmpName({
                template: 'buildx-in-XXXXXX.fifo',
                tmpdir: context_1.Context.tmpDir()
            });
            yield exec_1.Exec.exec('mkfifo', [buildxInFifoPath]);
            const buildxOutFifoPath = context_1.Context.tmpName({
                template: 'buildx-out-XXXXXX.fifo',
                tmpdir: context_1.Context.tmpDir()
            });
            yield exec_1.Exec.exec('mkfifo', [buildxOutFifoPath]);
            const buildxDialStdioCmd = yield this.buildx.getCommand(['--builder', builderName, 'dial-stdio']);
            core.info(`[command]${buildxDialStdioCmd.command} ${buildxDialStdioCmd.args.join(' ')}`);
            const buildxDialStdioProc = (0, child_process_1.spawn)(buildxDialStdioCmd.command, buildxDialStdioCmd.args, {
                stdio: ['pipe', 'pipe', 'inherit'],
                detached: true
            });
            let buildxDialStdioKilled = false;
            fs_1.default.createReadStream(buildxInFifoPath).pipe(buildxDialStdioProc.stdin);
            buildxDialStdioProc.stdout.pipe(fs_1.default.createWriteStream(buildxOutFifoPath));
            buildxDialStdioProc.on('exit', (code, signal) => {
                buildxDialStdioKilled = true;
                if (signal) {
                    core.info(`Process "buildx dial-stdio" was killed with signal ${signal}`);
                }
                else {
                    core.info(`Process "buildx dial-stdio" exited with code ${code}`);
                }
            });
            const tmpDockerbuildFilename = path_1.default.join(outDir, 'rec.dockerbuild');
            const summaryFilename = path_1.default.join(outDir, 'summary.json');
            let dockerRunProc;
            let dockerRunProcKilled = false;
            yield new Promise((resolve, reject) => {
                const ebargs = ['--ref-state-dir=/buildx-refs', `--node=${builderName}/${nodeName}`];
                for (const ref of refs) {
                    ebargs.push(`--ref=${ref}`);
                }
                if (typeof process.getuid === 'function') {
                    ebargs.push(`--uid=${process.getuid()}`);
                }
                if (typeof process.getgid === 'function') {
                    ebargs.push(`--gid=${process.getgid()}`);
                }
                // prettier-ignore
                const dockerRunArgs = [
                    'run', '--rm', '-i',
                    '-v', `${buildx_1.Buildx.refsDir}:/buildx-refs`,
                    '-v', `${outDir}:/out`,
                    image || process.env['DOCKER_BUILD_EXPORT_BUILD_IMAGE'] || 'docker.io/dockereng/export-build:latest',
                    ...ebargs
                ];
                core.info(`[command]docker ${dockerRunArgs.join(' ')}`);
                dockerRunProc = (0, child_process_1.spawn)('docker', dockerRunArgs, {
                    stdio: ['pipe', 'pipe', 'inherit'],
                    env: Object.assign(Object.assign({}, process.env), { DOCKER_CONTENT_TRUST: 'false' })
                });
                fs_1.default.createReadStream(buildxOutFifoPath).pipe(dockerRunProc.stdin);
                dockerRunProc.stdout.pipe(fs_1.default.createWriteStream(buildxInFifoPath));
                dockerRunProc.on('close', code => {
                    if (code === 0) {
                        if (!fs_1.default.existsSync(tmpDockerbuildFilename)) {
                            reject(new Error(`Failed to export build record: ${tmpDockerbuildFilename} not found`));
                        }
                        else {
                            resolve();
                        }
                    }
                    else {
                        reject(new Error(`Process "docker run" closed with code ${code}`));
                    }
                });
                dockerRunProc.on('error', err => {
                    core.error(`Error executing "docker run": ${err}`);
                    reject(err);
                });
                dockerRunProc.on('exit', (code, signal) => {
                    dockerRunProcKilled = true;
                    if (signal) {
                        core.info(`Process "docker run" was killed with signal ${signal}`);
                    }
                    else {
                        core.info(`Process "docker run" exited with code ${code}`);
                    }
                });
            })
                .catch(err => {
                throw err;
            })
                .finally(() => {
                if (buildxDialStdioProc && !buildxDialStdioKilled) {
                    core.debug('Force terminating "buildx dial-stdio" process');
                    buildxDialStdioProc.kill('SIGKILL');
                }
                if (dockerRunProc && !dockerRunProcKilled) {
                    core.debug('Force terminating "docker run" process');
                    dockerRunProc.kill('SIGKILL');
                }
            });
            const dockerbuildPath = path_1.default.join(outDir, `${History.exportFilename(refs)}.dockerbuild`);
            fs_1.default.renameSync(tmpDockerbuildFilename, dockerbuildPath);
            const dockerbuildStats = fs_1.default.statSync(dockerbuildPath);
            core.info(`Parsing ${summaryFilename}`);
            fs_1.default.statSync(summaryFilename);
            const summaries = JSON.parse(fs_1.default.readFileSync(summaryFilename, { encoding: 'utf-8' }));
            return {
                dockerbuildFilename: dockerbuildPath,
                dockerbuildSize: dockerbuildStats.size,
                builderName: builderName,
                nodeName: nodeName,
                refs: refs,
                summaries: summaries
            };
        });
    }
    static exportFilename(refs) {
        let name = `${github_1.GitHub.context.repo.owner}~${github_1.GitHub.context.repo.repo}~${refs[0].substring(0, 6).toUpperCase()}`;
        if (refs.length > 1) {
            name += `+${refs.length - 1}`;
        }
        return name;
    }
}
exports.History = History;
//# sourceMappingURL=history.js.map