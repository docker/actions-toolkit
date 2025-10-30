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
exports.Bake = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sync_1 = require("csv-parse/sync");
const buildx_1 = require("./buildx");
const context_1 = require("../context");
const exec_1 = require("../exec");
const util_1 = require("../util");
class Bake {
    constructor(opts) {
        this.buildx = (opts === null || opts === void 0 ? void 0 : opts.buildx) || new buildx_1.Buildx();
        this.metadataFilename = `bake-metadata-${util_1.Util.generateRandomString()}.json`;
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
    resolveRefs(metadata) {
        if (!metadata) {
            metadata = this.resolveMetadata();
            if (!metadata) {
                return undefined;
            }
        }
        const refs = new Array();
        for (const key in metadata) {
            if ('buildx.build.ref' in metadata[key]) {
                refs.push(metadata[key]['buildx.build.ref']);
            }
        }
        return refs.length > 0 ? refs : undefined;
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
    getDefinition(cmdOpts, execOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            execOptions = execOptions || { ignoreReturnCode: true };
            execOptions.ignoreReturnCode = true;
            if (cmdOpts.githubToken) {
                execOptions.env = Object.assign({}, process.env, {
                    BUILDX_BAKE_GIT_AUTH_TOKEN: cmdOpts.githubToken
                });
            }
            const args = ['bake'];
            let remoteDef;
            const files = [];
            const sources = [...(cmdOpts.files || []), cmdOpts.source];
            if (sources) {
                for (const source of sources.map(v => (v ? v.trim() : ''))) {
                    if (source.length == 0) {
                        continue;
                    }
                    if (!util_1.Util.isValidRef(source)) {
                        files.push(source);
                        continue;
                    }
                    if (remoteDef) {
                        throw new Error(`Only one remote bake definition can be defined`);
                    }
                    remoteDef = source;
                }
            }
            if (remoteDef) {
                args.push(remoteDef);
            }
            for (const file of files) {
                args.push('--file', file);
            }
            if (cmdOpts.overrides) {
                for (const override of cmdOpts.overrides) {
                    args.push('--set', override);
                }
            }
            if (cmdOpts.allow) {
                for (const allow of cmdOpts.allow) {
                    args.push('--allow', allow);
                }
            }
            if (cmdOpts.call) {
                args.push('--call', cmdOpts.call);
            }
            if (cmdOpts.load) {
                args.push('--load');
            }
            if (cmdOpts.noCache) {
                args.push('--no-cache');
            }
            if (cmdOpts.provenance) {
                args.push('--provenance', cmdOpts.provenance);
            }
            if (cmdOpts.push) {
                args.push('--push');
            }
            if (cmdOpts.sbom) {
                args.push('--sbom', cmdOpts.sbom);
            }
            const printCmd = yield this.buildx.getCommand([...args, '--print', ...(cmdOpts.targets || [])]);
            return yield exec_1.Exec.getExecOutput(printCmd.command, printCmd.args, execOptions).then(res => {
                var _a, _b, _c;
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    throw new Error(`cannot parse bake definitions: ${(_c = (_b = (_a = res.stderr.match(/(.*)\s*$/)) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : 'unknown error'}`);
                }
                return Bake.parseDefinition(res.stdout.trim());
            });
        });
    }
    static parseDefinition(dt) {
        const definition = JSON.parse(dt);
        // convert to composable attributes: https://github.com/docker/buildx/pull/2758
        for (const name in definition.target) {
            const target = definition.target[name];
            if (target['attest'] && Array.isArray(target['attest'])) {
                target['attest'] = target['attest'].map((item) => {
                    return Bake.parseAttestEntry(item);
                });
            }
            if (target['cache-from'] && Array.isArray(target['cache-from'])) {
                target['cache-from'] = target['cache-from'].map((item) => {
                    return Bake.parseCacheEntry(item);
                });
            }
            if (target['cache-to'] && Array.isArray(target['cache-to'])) {
                target['cache-to'] = target['cache-to'].map((item) => {
                    return Bake.parseCacheEntry(item);
                });
            }
            if (target['output'] && Array.isArray(target['output'])) {
                target['output'] = target['output'].map((item) => {
                    return Bake.parseExportEntry(item);
                });
            }
            if (target['secret'] && Array.isArray(target['secret'])) {
                target['secret'] = target['secret'].map((item) => {
                    return Bake.parseSecretEntry(item);
                });
            }
            if (target['ssh'] && Array.isArray(target['ssh'])) {
                target['ssh'] = target['ssh'].map((item) => {
                    return Bake.parseSSHEntry(item);
                });
            }
        }
        return definition;
    }
    static parseAttestEntry(item) {
        if (typeof item !== 'string') {
            return item;
        }
        const attestEntry = { type: '' };
        const fields = (0, sync_1.parse)(item, {
            relaxColumnCount: true,
            skipEmptyLines: true
        })[0];
        for (const field of fields) {
            const [key, value] = field
                .toString()
                .split(/(?<=^[^=]+?)=/)
                .map((item) => item.trim());
            switch (key) {
                case 'type':
                    attestEntry.type = value;
                    break;
                case 'disabled':
                    attestEntry.disabled = util_1.Util.parseBool(value);
                    break;
                default:
                    attestEntry[key] = value;
            }
        }
        return attestEntry;
    }
    static parseCacheEntry(item) {
        if (typeof item !== 'string') {
            return item;
        }
        const cacheEntry = { type: '' };
        const fields = (0, sync_1.parse)(item, {
            relaxColumnCount: true,
            skipEmptyLines: true
        })[0];
        if (fields.length === 1 && !fields[0].includes('=')) {
            cacheEntry.type = 'registry';
            cacheEntry.ref = fields[0];
            return cacheEntry;
        }
        for (const field of fields) {
            const [key, value] = field
                .toString()
                .split(/(?<=^[^=]+?)=/)
                .map((item) => item.trim());
            switch (key) {
                case 'type':
                    cacheEntry.type = value;
                    break;
                default:
                    cacheEntry[key] = value;
            }
        }
        return cacheEntry;
    }
    static parseExportEntry(item) {
        if (typeof item !== 'string') {
            return item;
        }
        const exportEntry = { type: '' };
        const fields = (0, sync_1.parse)(item, {
            relaxColumnCount: true,
            skipEmptyLines: true
        })[0];
        if (fields.length === 1 && fields[0] === item && !item.startsWith('type=')) {
            if (item !== '-') {
                exportEntry.type = 'local';
                exportEntry.dest = item;
                return exportEntry;
            }
            exportEntry.type = 'tar';
            exportEntry.dest = item;
            return exportEntry;
        }
        for (const field of fields) {
            const [key, value] = field
                .toString()
                .split(/(?<=^[^=]+?)=/)
                .map((item) => item.trim());
            switch (key) {
                case 'type':
                    exportEntry.type = value;
                    break;
                default:
                    exportEntry[key] = value;
            }
        }
        return exportEntry;
    }
    static parseSecretEntry(item) {
        if (typeof item !== 'string') {
            return item;
        }
        const secretEntry = {};
        const fields = (0, sync_1.parse)(item, {
            relaxColumnCount: true,
            skipEmptyLines: true
        })[0];
        let typ = '';
        for (const field of fields) {
            const [key, value] = field
                .toString()
                .split(/(?<=^[^=]+?)=/)
                .map((item) => item.trim());
            switch (key) {
                case 'type':
                    typ = value;
                    break;
                case 'id':
                    secretEntry.id = value;
                    break;
                case 'source':
                case 'src':
                    secretEntry.src = value;
                    break;
                case 'env':
                    secretEntry.env = value;
                    break;
            }
        }
        if (typ === 'env' && !secretEntry.env) {
            secretEntry.env = secretEntry.src;
            secretEntry.src = undefined;
        }
        return secretEntry;
    }
    static parseSSHEntry(item) {
        if (typeof item !== 'string') {
            return item;
        }
        const sshEntry = {};
        const [key, value] = item.split('=', 2);
        sshEntry.id = key;
        if (value) {
            sshEntry.paths = value.split(',');
        }
        return sshEntry;
    }
    static hasLocalExporter(def) {
        return Bake.hasExporterType('local', Bake.exporters(def));
    }
    static hasTarExporter(def) {
        return Bake.hasExporterType('tar', Bake.exporters(def));
    }
    static hasDockerExporter(def, load) {
        return load || Bake.hasExporterType('docker', Bake.exporters(def));
    }
    static hasExporterType(name, exporters) {
        for (const exporter of exporters) {
            if (exporter.type == name) {
                return true;
            }
        }
        return false;
    }
    static exporters(def) {
        const exporters = new Array();
        for (const key in def.target) {
            const target = def.target[key];
            if (target.output) {
                for (const output of target.output) {
                    exporters.push(Bake.parseExportEntry(output));
                }
            }
        }
        return exporters;
    }
    static hasGitAuthTokenSecret(def) {
        for (const key in def.target) {
            const target = def.target[key];
            if (target.secret) {
                for (const secret of target.secret) {
                    if (Bake.parseSecretEntry(secret).id === 'GIT_AUTH_TOKEN') {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
exports.Bake = Bake;
//# sourceMappingURL=bake.js.map