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
exports.GitHub = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const he_1 = __importDefault(require("he"));
const js_yaml_1 = require("js-yaml");
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const generated_1 = require("@actions/artifact/lib/generated");
const artifact_twirp_client_1 = require("@actions/artifact/lib/internal/shared/artifact-twirp-client");
const config_1 = require("@actions/artifact/lib/internal/shared/config");
const util_1 = require("@actions/artifact/lib/internal/shared/util");
const retention_1 = require("@actions/artifact/lib/internal/upload/retention");
const artifact_1 = require("@actions/artifact");
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const httpm = __importStar(require("@actions/http-client"));
const storage_blob_1 = require("@azure/storage-blob");
const jwt_decode_1 = require("jwt-decode");
const util_2 = require("./util");
class GitHub {
    constructor(opts) {
        this.githubToken = (opts === null || opts === void 0 ? void 0 : opts.token) || process.env.GITHUB_TOKEN;
        this.octokit = github.getOctokit(`${this.githubToken}`);
    }
    repoData() {
        return this.octokit.rest.repos.get(Object.assign({}, github.context.repo)).then(response => response.data);
    }
    releases(name, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `https://raw.githubusercontent.com/${opts.owner}/${opts.repo}/${opts.ref}/${opts.path}`;
            const http = new httpm.HttpClient('docker-actions-toolkit');
            // prettier-ignore
            const httpResp = yield http.get(url, this.githubToken ? {
                Authorization: `token ${this.githubToken}`
            } : undefined);
            const dt = yield httpResp.readBody();
            const statusCode = httpResp.message.statusCode || 500;
            if (statusCode >= 400) {
                throw new Error(`Failed to get ${name} releases from ${url} with status code ${statusCode}: ${dt}`);
            }
            return JSON.parse(dt);
        });
    }
    static get context() {
        return github.context;
    }
    static get serverURL() {
        return process.env.GITHUB_SERVER_URL || 'https://github.com';
    }
    static get apiURL() {
        return process.env.GITHUB_API_URL || 'https://api.github.com';
    }
    static get isGHES() {
        // FIXME: we are using the function from GitHub artifact module but should
        //  be within core module when available.
        return (0, config_1.isGhes)();
    }
    static get repository() {
        return `${github.context.repo.owner}/${github.context.repo.repo}`;
    }
    static get workspace() {
        return process.env.GITHUB_WORKSPACE || process.cwd();
    }
    static get runId() {
        return process.env.GITHUB_RUN_ID ? +process.env.GITHUB_RUN_ID : github.context.runId;
    }
    static get runAttempt() {
        // TODO: runAttempt is not yet part of github.context but will be in a
        //  future release of @actions/github package: https://github.com/actions/toolkit/commit/faa425440f86f9c16587a19dfb59491253a2c92a
        return process.env.GITHUB_RUN_ATTEMPT ? +process.env.GITHUB_RUN_ATTEMPT : 1;
    }
    static workflowRunURL(setAttempts) {
        return `${GitHub.serverURL}/${GitHub.repository}/actions/runs/${GitHub.runId}${setAttempts ? `/attempts/${GitHub.runAttempt}` : ''}`;
    }
    static get actionsRuntimeToken() {
        const token = process.env['ACTIONS_RUNTIME_TOKEN'] || '';
        return token ? (0, jwt_decode_1.jwtDecode)(token) : undefined;
    }
    static printActionsRuntimeTokenACs() {
        return __awaiter(this, void 0, void 0, function* () {
            let jwt;
            try {
                jwt = GitHub.actionsRuntimeToken;
            }
            catch (e) {
                throw new Error(`Cannot parse GitHub Actions Runtime Token: ${e.message}`);
            }
            if (!jwt) {
                throw new Error(`ACTIONS_RUNTIME_TOKEN not set`);
            }
            try {
                JSON.parse(`${jwt.ac}`).forEach(ac => {
                    let permission;
                    switch (ac.Permission) {
                        case 1:
                            permission = 'read';
                            break;
                        case 2:
                            permission = 'write';
                            break;
                        case 3:
                            permission = 'read/write';
                            break;
                        default:
                            permission = `unimplemented (${ac.Permission})`;
                    }
                    core.info(`${ac.Scope}: ${permission}`);
                });
            }
            catch (e) {
                throw new Error(`Cannot parse GitHub Actions Runtime Token ACs: ${e.message}`);
            }
        });
    }
    static uploadArtifact(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (GitHub.isGHES) {
                throw new Error('@actions/artifact v2.0.0+ is currently not supported on GHES.');
            }
            const artifactName = path_1.default.basename(opts.filename);
            const backendIds = (0, util_1.getBackendIdsFromToken)();
            const artifactClient = (0, artifact_twirp_client_1.internalArtifactTwirpClient)();
            core.info(`Uploading ${artifactName} to blob storage`);
            const createArtifactReq = {
                workflowRunBackendId: backendIds.workflowRunBackendId,
                workflowJobRunBackendId: backendIds.workflowJobRunBackendId,
                name: artifactName,
                version: 4
            };
            const expiresAt = (0, retention_1.getExpiration)(opts === null || opts === void 0 ? void 0 : opts.retentionDays);
            if (expiresAt) {
                createArtifactReq.expiresAt = expiresAt;
            }
            const createArtifactResp = yield artifactClient.CreateArtifact(createArtifactReq);
            if (!createArtifactResp.ok) {
                throw new artifact_1.InvalidResponseError('cannot create artifact client');
            }
            let uploadByteCount = 0;
            const blobClient = new storage_blob_1.BlobClient(createArtifactResp.signedUploadUrl);
            const blockBlobClient = blobClient.getBlockBlobClient();
            const headers = {
                blobContentDisposition: `attachment; filename="${artifactName}"`
            };
            if (opts.mimeType) {
                headers.blobContentType = opts.mimeType;
            }
            core.debug(`Upload headers: ${JSON.stringify(headers)}`);
            try {
                core.info('Beginning upload of artifact content to blob storage');
                yield blockBlobClient.uploadFile(opts.filename, {
                    blobHTTPHeaders: headers,
                    onProgress: (progress) => {
                        core.info(`Uploaded bytes ${progress.loadedBytes}`);
                        uploadByteCount = progress.loadedBytes;
                    }
                });
            }
            catch (error) {
                if (artifact_1.NetworkError.isNetworkErrorCode(error === null || error === void 0 ? void 0 : error.code)) {
                    throw new artifact_1.NetworkError(error === null || error === void 0 ? void 0 : error.code);
                }
                throw error;
            }
            core.info('Finished uploading artifact content to blob storage!');
            const sha256Hash = crypto_1.default.createHash('sha256').update(fs_1.default.readFileSync(opts.filename)).digest('hex');
            core.info(`SHA256 hash of uploaded artifact is ${sha256Hash}`);
            const finalizeArtifactReq = {
                workflowRunBackendId: backendIds.workflowRunBackendId,
                workflowJobRunBackendId: backendIds.workflowJobRunBackendId,
                name: artifactName,
                size: uploadByteCount ? uploadByteCount.toString() : '0'
            };
            if (sha256Hash) {
                finalizeArtifactReq.hash = generated_1.StringValue.create({
                    value: `sha256:${sha256Hash}`
                });
            }
            core.info(`Finalizing artifact upload`);
            const finalizeArtifactResp = yield artifactClient.FinalizeArtifact(finalizeArtifactReq);
            if (!finalizeArtifactResp.ok) {
                throw new artifact_1.InvalidResponseError('Cannot finalize artifact upload');
            }
            const artifactId = BigInt(finalizeArtifactResp.artifactId);
            core.info(`Artifact successfully finalized (${artifactId})`);
            const artifactURL = `${GitHub.workflowRunURL()}/artifacts/${artifactId}`;
            core.info(`Artifact download URL: ${artifactURL}`);
            return {
                id: Number(artifactId),
                filename: artifactName,
                size: uploadByteCount,
                url: artifactURL
            };
        });
    }
    static writeBuildSummary(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            // can't use original core.summary.addLink due to the need to make
            // EOL optional
            const addLink = function (text, url, addEOL = false) {
                return `<a href="${url}">${text}</a>` + (addEOL ? os_1.default.EOL : '');
            };
            const refsSize = opts.exportRes.refs.length;
            const firstRef = refsSize > 0 ? (_a = opts.exportRes.refs) === null || _a === void 0 ? void 0 : _a[0] : undefined;
            const firstSummary = firstRef ? (_b = opts.exportRes.summaries) === null || _b === void 0 ? void 0 : _b[firstRef] : undefined;
            const dbcAccount = opts.driver === 'cloud' && opts.endpoint ? (_c = opts.endpoint) === null || _c === void 0 ? void 0 : _c.replace(/^cloud:\/\//, '').split('/')[0] : undefined;
            const sum = core.summary.addHeading('Docker Build summary', 2);
            if (dbcAccount && refsSize === 1 && firstRef && firstSummary) {
                const buildURL = GitHub.formatDBCBuildURL(dbcAccount, firstRef, firstSummary.defaultPlatform);
                // prettier-ignore
                sum.addRaw(`<p>`)
                    .addRaw(`For a detailed look at the build, you can check the results at:`)
                    .addRaw('</p>')
                    .addRaw(`<p>`)
                    .addRaw(`:whale: ${addLink(`<strong>${buildURL}</strong>`, buildURL)}`)
                    .addRaw(`</p>`);
            }
            if (opts.uploadRes) {
                // we just need the last two parts of the URL as they are always relative
                // to the workflow run URL otherwise URL could be broken if GitHub
                // repository name is part of a secret value used in the workflow. e.g.:
                //  artifact: https://github.com/docker/actions-toolkit/actions/runs/9552208295/artifacts/1609622746
                //  workflow: https://github.com/docker/actions-toolkit/actions/runs/9552208295
                // https://github.com/docker/actions-toolkit/issues/367
                const artifactRelativeURL = `./${GitHub.runId}/${opts.uploadRes.url.split('/').slice(-2).join('/')}`;
                if (dbcAccount && refsSize === 1) {
                    // prettier-ignore
                    sum.addRaw(`<p>`)
                        .addRaw(`You can also download the following build record archive and import it into Docker Desktop's Builds view. `)
                        .addBreak()
                        .addRaw(`Build records include details such as timing, dependencies, results, logs, traces, and other information about a build. `)
                        .addRaw(addLink('Learn more', 'https://www.docker.com/blog/new-beta-feature-deep-dive-into-github-actions-docker-builds-with-docker-desktop/?utm_source=github&utm_medium=actions'))
                        .addRaw('</p>');
                }
                else {
                    // prettier-ignore
                    sum.addRaw(`<p>`)
                        .addRaw(`For a detailed look at the build, download the following build record archive and import it into Docker Desktop's Builds view. `)
                        .addBreak()
                        .addRaw(`Build records include details such as timing, dependencies, results, logs, traces, and other information about a build. `)
                        .addRaw(addLink('Learn more', 'https://www.docker.com/blog/new-beta-feature-deep-dive-into-github-actions-docker-builds-with-docker-desktop/?utm_source=github&utm_medium=actions'))
                        .addRaw('</p>');
                }
                // prettier-ignore
                sum.addRaw(`<p>`)
                    .addRaw(`:arrow_down: ${addLink(`<strong>${util_2.Util.stringToUnicodeEntities(opts.uploadRes.filename)}</strong>`, artifactRelativeURL)} (${util_2.Util.formatFileSize(opts.uploadRes.size)} - includes <strong>${refsSize} build record${refsSize > 1 ? 's' : ''}</strong>)`)
                    .addRaw(`</p>`);
            }
            else if (opts.exportRes.summaries) {
                // prettier-ignore
                sum.addRaw(`<p>`)
                    .addRaw(`The following table provides a brief summary of your build.`)
                    .addBreak()
                    .addRaw(`For a detailed look at the build, including timing, dependencies, results, logs, traces, and other information, consider enabling the export of the build record so you can import it into Docker Desktop's Builds view. `)
                    .addRaw(addLink('Learn more', 'https://www.docker.com/blog/new-beta-feature-deep-dive-into-github-actions-docker-builds-with-docker-desktop/?utm_source=github&utm_medium=actions'))
                    .addRaw(`</p>`);
            }
            // Feedback survey
            sum.addRaw(`<p>`).addRaw(`Find this useful? `).addRaw(addLink('Let us know', 'https://docs.docker.com/feedback/gha-build-summary')).addRaw('</p>');
            if (opts.exportRes.summaries) {
                // Preview
                sum.addRaw('<p>');
                const summaryTableData = [
                    // prettier-ignore
                    [
                        { header: true, data: 'ID' },
                        { header: true, data: 'Name' },
                        { header: true, data: 'Status' },
                        { header: true, data: 'Cached' },
                        { header: true, data: 'Duration' },
                        ...(dbcAccount && refsSize > 1 ? [{ header: true, data: 'Build result URL' }] : [])
                    ]
                ];
                let buildError;
                for (const ref in opts.exportRes.summaries) {
                    if (Object.prototype.hasOwnProperty.call(opts.exportRes.summaries, ref)) {
                        const summary = opts.exportRes.summaries[ref];
                        // prettier-ignore
                        summaryTableData.push([
                            { data: `<code>${ref.substring(0, 6).toUpperCase()}</code>` },
                            { data: `<strong>${util_2.Util.stringToUnicodeEntities(summary.name)}</strong>` },
                            { data: `${summary.status === 'completed' ? ':white_check_mark:' : summary.status === 'canceled' ? ':no_entry_sign:' : ':x:'} ${summary.status}` },
                            { data: `${summary.numCachedSteps > 0 ? Math.round((summary.numCachedSteps / summary.numTotalSteps) * 100) : 0}%` },
                            { data: summary.duration },
                            ...(dbcAccount && refsSize > 1 ? [{ data: addLink(':whale: Open', GitHub.formatDBCBuildURL(dbcAccount, ref, summary.defaultPlatform)) }] : [])
                        ]);
                        if (summary.error) {
                            buildError = summary.error;
                        }
                    }
                }
                sum.addTable([...summaryTableData]);
                sum.addRaw(`</p>`);
                // Build error
                if (buildError) {
                    sum.addRaw(`<blockquote>`);
                    if (util_2.Util.countLines(buildError) > 10) {
                        // prettier-ignore
                        sum
                            .addRaw(`<details><summary><strong>Error</strong></summary>`)
                            .addCodeBlock(he_1.default.encode(buildError), 'text')
                            .addRaw(`</details>`);
                    }
                    else {
                        // prettier-ignore
                        sum
                            .addRaw(`<strong>Error</strong>`)
                            .addBreak()
                            .addRaw(`<p>`)
                            .addCodeBlock(he_1.default.encode(buildError), 'text')
                            .addRaw(`</p>`);
                    }
                    sum.addRaw(`</blockquote>`);
                }
            }
            // Build inputs
            if (opts.inputs) {
                // prettier-ignore
                sum.addRaw(`<details><summary><strong>Build inputs</strong></summary>`)
                    .addCodeBlock((0, js_yaml_1.dump)(opts.inputs, {
                    indent: 2,
                    lineWidth: -1
                }), 'yaml')
                    .addRaw(`</details>`);
            }
            // Bake definition
            if (opts.bakeDefinition) {
                // prettier-ignore
                sum.addRaw(`<details><summary><strong>Bake definition</strong></summary>`)
                    .addCodeBlock(JSON.stringify(opts.bakeDefinition, null, 2), 'json')
                    .addRaw(`</details>`);
            }
            core.info(`Writing summary`);
            yield sum.addSeparator().write();
        });
    }
    static formatDBCBuildURL(account, ref, platform) {
        return `https://app.docker.com/build/accounts/${account}/builds/${(platform !== null && platform !== void 0 ? platform : 'linux/amd64').replace('/', '-')}/${ref}`;
    }
}
exports.GitHub = GitHub;
//# sourceMappingURL=github.js.map