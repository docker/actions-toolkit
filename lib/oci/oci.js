"use strict";
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
exports.OCI = void 0;
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
const fs_1 = __importDefault(require("fs"));
const gunzip_maybe_1 = __importDefault(require("gunzip-maybe"));
const path = __importStar(require("path"));
const tar = __importStar(require("tar-stream"));
const layout_1 = require("../types/oci/layout");
const mediatype_1 = require("../types/oci/mediatype");
class OCI {
    static loadArchive(opts) {
        return new Promise((resolve, reject) => {
            const tarex = tar.extract();
            let rootIndex;
            let rootLayout;
            const indexes = {};
            const manifests = {};
            const images = {};
            const blobs = {};
            tarex.on('entry', (header, stream, next) => __awaiter(this, void 0, void 0, function* () {
                if (header.type === 'file') {
                    const filename = path.normalize(header.name);
                    if (filename === layout_1.IMAGE_INDEX_FILE_V1) {
                        rootIndex = yield OCI.streamToJson(stream);
                    }
                    else if (filename === layout_1.IMAGE_LAYOUT_FILE_V1) {
                        rootLayout = yield OCI.streamToJson(stream);
                    }
                    else if (filename.startsWith(path.join(layout_1.IMAGE_BLOBS_DIR_V1, path.sep))) {
                        const blob = yield OCI.extractBlob(stream);
                        const digest = `${filename.split(path.sep)[1]}:${filename.split(path.sep)[filename.split(path.sep).length - 1]}`;
                        if (OCI.isIndex(blob)) {
                            indexes[digest] = JSON.parse(blob);
                        }
                        else if (OCI.isManifest(blob)) {
                            manifests[digest] = JSON.parse(blob);
                        }
                        else if (OCI.isImage(blob)) {
                            images[digest] = JSON.parse(blob);
                        }
                        else {
                            blobs[digest] = blob;
                        }
                    }
                    else {
                        reject(new Error(`Invalid OCI archive: unexpected file ${filename}`));
                    }
                }
                stream.resume();
                next();
            }));
            tarex.on('finish', () => {
                if (!rootIndex || !rootLayout) {
                    reject(new Error('Invalid OCI archive: missing index or layout'));
                }
                resolve({
                    root: {
                        index: rootIndex,
                        layout: rootLayout
                    },
                    indexes: indexes,
                    manifests: manifests,
                    images: images,
                    blobs: blobs
                });
            });
            tarex.on('error', error => {
                reject(error);
            });
            fs_1.default.createReadStream(opts.file).pipe((0, gunzip_maybe_1.default)()).pipe(tarex);
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static isIndex(blob) {
        try {
            const index = JSON.parse(blob);
            return index.mediaType === mediatype_1.MEDIATYPE_IMAGE_INDEX_V1;
        }
        catch (_a) {
            return false;
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static isManifest(blob) {
        try {
            const manifest = JSON.parse(blob);
            return manifest.mediaType === mediatype_1.MEDIATYPE_IMAGE_MANIFEST_V1 && manifest.layers.length > 0;
        }
        catch (_a) {
            return false;
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static isImage(blob) {
        try {
            const image = JSON.parse(blob);
            return image.rootfs.type !== '';
        }
        catch (_a) {
            return false;
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static extractBlob(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            const dstream = stream.pipe((0, gunzip_maybe_1.default)());
            dstream.on('data', chunk => {
                chunks.push(chunk);
            });
            dstream.on('end', () => {
                resolve(Buffer.concat(chunks).toString('utf8'));
            });
            dstream.on('error', (error) => __awaiter(this, void 0, void 0, function* () {
                reject(error);
            }));
        });
    }
    static streamToJson(stream) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const chunks = [];
                let bytes = 0;
                stream.on('data', chunk => {
                    bytes += chunk.length;
                    if (bytes <= 2 * 1024 * 1024) {
                        chunks.push(chunk.toString('utf8'));
                    }
                    else {
                        reject(new Error('The data stream exceeds the size limit for JSON parsing.'));
                    }
                });
                stream.on('end', () => {
                    try {
                        resolve(JSON.parse(chunks.join('')));
                    }
                    catch (error) {
                        reject(error);
                    }
                });
                stream.on('error', (error) => __awaiter(this, void 0, void 0, function* () {
                    reject(error);
                }));
            });
        });
    }
}
exports.OCI = OCI;
//# sourceMappingURL=oci.js.map