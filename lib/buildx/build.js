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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Build = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const core = __importStar(require("@actions/core"));
const sync_1 = require("csv-parse/sync");
const buildx_1 = require("./buildx");
const context_1 = require("../context");
const github_1 = require("../github");
const util_1 = require("../util");
class Build {
    constructor(opts) {
        this.buildx = (opts === null || opts === void 0 ? void 0 : opts.buildx) || new buildx_1.Buildx();
        this.iidFilename = `build-iidfile-${util_1.Util.generateRandomString()}.txt`;
        this.metadataFilename = `build-metadata-${util_1.Util.generateRandomString()}.json`;
    }
    getImageIDFilePath() {
        return path_1.default.join(context_1.Context.tmpDir(), this.iidFilename);
    }
    resolveImageID() {
        const iidFile = this.getImageIDFilePath();
        if (!fs_1.default.existsSync(iidFile)) {
            return undefined;
        }
        return fs_1.default.readFileSync(iidFile, { encoding: 'utf-8' }).trim();
    }
    getMetadataFilePath() {
        return path_1.default.join(context_1.Context.tmpDir(), this.metadataFilename);
    }
    resolveMetadata() {
        const metadataFile = this.getMetadataFilePath();
        if (!fs_1.default.existsSync(metadataFile)) {
            return undefined;
        }
        const content = fs_1.default.readFileSync(metadataFile, { encoding: 'utf-8' }).trim();
        if (content === 'null') {
            return undefined;
        }
        return JSON.parse(content);
    }
    resolveRef(metadata) {
        if (!metadata) {
            metadata = this.resolveMetadata();
            if (!metadata) {
                return undefined;
            }
        }
        if ('buildx.build.ref' in metadata) {
            return metadata['buildx.build.ref'];
        }
        return undefined;
    }
    resolveProvenance(metadata) {
        if (!metadata) {
            metadata = this.resolveMetadata();
            if (!metadata) {
                return undefined;
            }
        }
        if ('buildx.build.provenance' in metadata) {
            return metadata['buildx.build.provenance'];
        }
        return undefined;
    }
    resolveWarnings(metadata) {
        if (!metadata) {
            metadata = this.resolveMetadata();
            if (!metadata) {
                return undefined;
            }
        }
        if ('buildx.build.warnings' in metadata) {
            return metadata['buildx.build.warnings'];
        }
        return undefined;
    }
    resolveDigest(metadata) {
        if (!metadata) {
            metadata = this.resolveMetadata();
            if (!metadata) {
                return undefined;
            }
        }
        if ('containerimage.digest' in metadata) {
            return metadata['containerimage.digest'];
        }
        return undefined;
    }
    static resolveSecretString(kvp) {
        const [key, file] = Build.resolveSecret(kvp, {
            redact: true
        });
        return `id=${key},src=${file}`;
    }
    static resolveSecretFile(kvp) {
        const [key, file] = Build.resolveSecret(kvp, {
            asFile: true
        });
        return `id=${key},src=${file}`;
    }
    static resolveSecretEnv(kvp) {
        const [key, value] = Build.parseSecretKvp(kvp);
        return `id=${key},env=${value}`;
    }
    static resolveSecret(kvp, opts) {
        const [key, value] = Build.parseSecretKvp(kvp, opts === null || opts === void 0 ? void 0 : opts.redact);
        const secretFile = context_1.Context.tmpName({ tmpdir: context_1.Context.tmpDir() });
        if (opts === null || opts === void 0 ? void 0 : opts.asFile) {
            if (!fs_1.default.existsSync(value)) {
                throw new Error(`secret file ${value} not found`);
            }
            fs_1.default.copyFileSync(value, secretFile);
        }
        else {
            fs_1.default.writeFileSync(secretFile, value);
        }
        return [key, secretFile];
    }
    static getProvenanceInput(name) {
        const input = core.getInput(name);
        if (!input) {
            // if input is not set returns empty string
            return input;
        }
        try {
            return core.getBooleanInput(name) ? `builder-id=${github_1.GitHub.workflowRunURL(true)}` : 'false';
        }
        catch (err) {
            // not a valid boolean, so we assume it's a string
            return Build.resolveProvenanceAttrs(input);
        }
    }
    static resolveProvenanceAttrs(input) {
        if (!input) {
            return `builder-id=${github_1.GitHub.workflowRunURL(true)}`;
        }
        // parse attributes from input
        const fields = (0, sync_1.parse)(input, {
            relaxColumnCount: true,
            skipEmptyLines: true
        })[0];
        // check if builder-id attribute exists in the input
        for (const field of fields) {
            const parts = field
                .toString()
                .split(/(?<=^[^=]+?)=/)
                .map(item => item.trim());
            if (parts[0] == 'builder-id') {
                return input;
            }
        }
        // if not add builder-id attribute
        return `${input},builder-id=${github_1.GitHub.workflowRunURL(true)}`;
    }
    static resolveCacheToAttrs(input, githubToken) {
        if (!input) {
            return input;
        }
        let cacheType = 'registry';
        let ghaCacheRepository = '';
        let ghaCacheGHToken = '';
        const fields = (0, sync_1.parse)(input, {
            relaxColumnCount: true,
            skipEmptyLines: true
        })[0];
        for (const field of fields) {
            const parts = field
                .toString()
                .split(/(?<=^[^=]+?)=/)
                .map(item => item.trim());
            if (parts[0] === 'type') {
                cacheType = parts[1];
            }
            else if (parts[0] === 'repository') {
                ghaCacheRepository = parts[1];
            }
            else if (parts[0] === 'ghtoken') {
                ghaCacheGHToken = parts[1];
            }
        }
        if (cacheType === 'gha') {
            if (!ghaCacheRepository) {
                input = `${input},repository=${github_1.GitHub.repository}`;
            }
            if (!ghaCacheGHToken && githubToken) {
                input = `${input},ghtoken=${githubToken}`;
            }
        }
        return input;
    }
    static hasLocalExporter(exporters) {
        return Build.hasExporterType('local', exporters);
    }
    static hasTarExporter(exporters) {
        return Build.hasExporterType('tar', exporters);
    }
    static hasDockerExporter(exporters, load) {
        return load || Build.hasExporterType('docker', exporters);
    }
    static hasExporterType(name, exporters) {
        const records = (0, sync_1.parse)(exporters.join(`\n`), {
            delimiter: ',',
            trim: true,
            columns: false,
            relaxColumnCount: true
        });
        for (const record of records) {
            if (record.length == 1 && !record[0].startsWith('type=')) {
                // Local if no type is defined
                // https://github.com/docker/buildx/blob/d2bf42f8b4784d83fde17acb3ed84703ddc2156b/build/output.go#L29-L43
                return name == 'local';
            }
            for (const [key, value] of record.map(chunk => chunk.split('=').map(item => item.trim()))) {
                if (key == 'type' && value == name) {
                    return true;
                }
            }
        }
        return false;
    }
    static hasAttestationType(name, attrs) {
        const records = (0, sync_1.parse)(attrs, {
            delimiter: ',',
            trim: true,
            columns: false,
            relaxColumnCount: true
        });
        for (const record of records) {
            for (const [key, value] of record.map((chunk) => chunk.split('=').map(item => item.trim()))) {
                if (key == 'type' && value == name) {
                    return true;
                }
            }
        }
        return false;
    }
    static resolveAttestationAttrs(attrs) {
        const records = (0, sync_1.parse)(attrs, {
            delimiter: ',',
            trim: true,
            columns: false,
            relaxColumnCount: true
        });
        const res = [];
        for (const record of records) {
            for (const attr of record) {
                try {
                    // https://github.com/docker/buildx/blob/8abef5908705e49f7ba88ef8c957e1127b597a2a/util/buildflags/attests.go#L13-L21
                    const v = util_1.Util.parseBool(attr);
                    res.push(`disabled=${!v}`);
                }
                catch (err) {
                    res.push(attr);
                }
            }
        }
        return res.join(',');
    }
    static hasGitAuthTokenSecret(secrets) {
        for (const secret of secrets) {
            if (secret.startsWith('GIT_AUTH_TOKEN=')) {
                return true;
            }
        }
        return false;
    }
    static parseSecretKvp(kvp, redact) {
        const delimiterIndex = kvp.indexOf('=');
        const key = kvp.substring(0, delimiterIndex);
        const value = kvp.substring(delimiterIndex + 1);
        if (key.length == 0 || value.length == 0) {
            throw new Error(`${kvp} is not a valid secret`);
        }
        if (redact) {
            core.setSecret(value);
        }
        return [key, value];
    }
}
exports.Build = Build;
//# sourceMappingURL=build.js.map