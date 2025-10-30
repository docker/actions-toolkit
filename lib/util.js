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
exports.Util = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const core = __importStar(require("@actions/core"));
const io = __importStar(require("@actions/io"));
const sync_1 = require("csv-parse/sync");
class Util {
    static getInputList(name, opts) {
        return this.getList(core.getInput(name), opts);
    }
    static getList(input, opts) {
        const res = [];
        if (input == '') {
            return res;
        }
        const records = (0, sync_1.parse)(input, {
            columns: false,
            relaxQuotes: true,
            comment: opts === null || opts === void 0 ? void 0 : opts.comment,
            relaxColumnCount: true,
            skipEmptyLines: true,
            quote: opts === null || opts === void 0 ? void 0 : opts.quote
        });
        for (const record of records) {
            if (record.length == 1) {
                if (opts === null || opts === void 0 ? void 0 : opts.ignoreComma) {
                    res.push(record[0]);
                }
                else {
                    res.push(...record[0].split(','));
                }
            }
            else if (!(opts === null || opts === void 0 ? void 0 : opts.ignoreComma)) {
                res.push(...record);
            }
            else {
                res.push(record.join(','));
            }
        }
        return res.filter(item => item).map(pat => pat.trim());
    }
    static getInputNumber(name) {
        const value = core.getInput(name);
        if (!value) {
            return undefined;
        }
        return parseInt(value);
    }
    static asyncForEach(array, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let index = 0; index < array.length; index++) {
                yield callback(array[index], index, array);
            }
        });
    }
    static isValidURL(urlStr) {
        let url;
        try {
            url = new URL(urlStr);
        }
        catch (e) {
            return false;
        }
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    static isValidRef(refStr) {
        if (Util.isValidURL(refStr)) {
            return true;
        }
        for (const prefix of ['git://', 'github.com/', 'git@']) {
            if (refStr.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }
    static powershellCommand(script, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const powershellPath = yield io.which('powershell', true);
            const escapedScript = script.replace(/'/g, "''").replace(/"|\n|\r/g, '');
            const escapedParams = [];
            if (params) {
                for (const key in params) {
                    escapedParams.push(`-${key} '${params[key].replace(/'/g, "''").replace(/"|\n|\r/g, '')}'`);
                }
            }
            return {
                command: `"${powershellPath}"`,
                args: ['-NoLogo', '-Sta', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Unrestricted', '-Command', `& '${escapedScript}' ${escapedParams.join(' ')}`]
            };
        });
    }
    static isDirectory(p) {
        try {
            return fs_1.default.lstatSync(p).isDirectory();
        }
        catch (_) {
            // noop
        }
        return false;
    }
    static trimPrefix(str, suffix) {
        if (!str || !suffix) {
            return str;
        }
        const index = str.indexOf(suffix);
        if (index !== 0) {
            return str;
        }
        return str.substring(suffix.length);
    }
    static trimSuffix(str, suffix) {
        if (!str || !suffix) {
            return str;
        }
        const index = str.lastIndexOf(suffix);
        if (index === -1 || index + suffix.length !== str.length) {
            return str;
        }
        return str.substring(0, index);
    }
    static sleep(seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }
    static hash(input) {
        return crypto_1.default.createHash('sha256').update(input).digest('hex');
    }
    // https://github.com/golang/go/blob/f6b93a4c358b28b350dd8fe1780c1f78e520c09c/src/strconv/atob.go#L7-L18
    static parseBool(str) {
        switch (str) {
            case '1':
            case 't':
            case 'T':
            case 'true':
            case 'TRUE':
            case 'True':
                return true;
            case '0':
            case 'f':
            case 'F':
            case 'false':
            case 'FALSE':
            case 'False':
                return false;
            default:
                throw new Error(`parseBool syntax error: ${str}`);
        }
    }
    static formatFileSize(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    static generateRandomString(length = 10) {
        const bytes = crypto_1.default.randomBytes(Math.ceil(length / 2));
        return bytes.toString('hex').slice(0, length);
    }
    static stringToUnicodeEntities(str) {
        return Array.from(str)
            .map(char => `&#x${char.charCodeAt(0).toString(16)};`)
            .join('');
    }
    static countLines(input) {
        return input.split(/\r\n|\r|\n/).length;
    }
    static isPathRelativeTo(parentPath, childPath) {
        const rpp = path_1.default.resolve(parentPath);
        const rcp = path_1.default.resolve(childPath);
        return rcp.startsWith(rpp.endsWith(path_1.default.sep) ? rpp : `${rpp}${path_1.default.sep}`);
    }
    static formatDuration(ns) {
        if (ns === 0)
            return '0s';
        const totalSeconds = Math.floor(ns / 1e9);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const parts = [];
        if (hours)
            parts.push(`${hours}h`);
        if (minutes)
            parts.push(`${minutes}m`);
        if (seconds || parts.length === 0)
            parts.push(`${seconds}s`);
        return parts.join('');
    }
}
exports.Util = Util;
//# sourceMappingURL=util.js.map