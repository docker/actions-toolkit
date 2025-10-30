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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildKit = void 0;
const core = __importStar(require("@actions/core"));
const semver = __importStar(require("semver"));
const buildx_1 = require("../buildx/buildx");
const builder_1 = require("../buildx/builder");
const docker_1 = require("../docker/docker");
const config_1 = require("./config");
class BuildKit {
    constructor(opts) {
        this.config = new config_1.Config();
        this.buildx = (opts === null || opts === void 0 ? void 0 : opts.buildx) || new buildx_1.Buildx();
    }
    getVersion(node) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!node.buildkit && node.name) {
                try {
                    return yield this.getVersionWithinImage(node.name);
                }
                catch (e) {
                    core.warning(e);
                }
            }
            return node.buildkit;
        });
    }
    getVersionWithinImage(nodeName) {
        return __awaiter(this, void 0, void 0, function* () {
            core.debug(`BuildKit.getVersionWithinImage nodeName: ${nodeName}`);
            return docker_1.Docker.getExecOutput(['inspect', '--format', '{{.Config.Image}}', `${buildx_1.Buildx.containerNamePrefix}${nodeName}`], {
                ignoreReturnCode: true,
                silent: true
            }).then(bkitimage => {
                if (bkitimage.exitCode == 0 && bkitimage.stdout.length > 0) {
                    core.debug(`BuildKit.getVersionWithinImage image: ${bkitimage.stdout.trim()}`);
                    return docker_1.Docker.getExecOutput(['run', '--rm', bkitimage.stdout.trim(), '--version'], {
                        ignoreReturnCode: true,
                        silent: true
                    }).then(bkitversion => {
                        if (bkitversion.exitCode == 0 && bkitversion.stdout.length > 0) {
                            return `${bkitimage.stdout.trim()} => ${bkitversion.stdout.trim()}`;
                        }
                        else if (bkitversion.stderr.length > 0) {
                            throw new Error(bkitimage.stderr.trim());
                        }
                        return bkitversion.stdout.trim();
                    });
                }
                else if (bkitimage.stderr.length > 0) {
                    throw new Error(bkitimage.stderr.trim());
                }
                return bkitimage.stdout.trim();
            });
        });
    }
    versionSatisfies(builderName, range, builderInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!builderInfo) {
                builderInfo = yield new builder_1.Builder({ buildx: this.buildx }).inspect(builderName);
            }
            for (const node of builderInfo.nodes) {
                let bkversion = node.buildkit;
                core.debug(`BuildKit.versionSatisfies ${bkversion}: ${range}`);
                if (!bkversion) {
                    try {
                        bkversion = yield this.getVersionWithinImage(node.name || '');
                    }
                    catch (e) {
                        core.debug(`BuildKit.versionSatisfies ${node.name}: can't get version`);
                        return false;
                    }
                }
                core.debug(`BuildKit.versionSatisfies ${node.name}: version ${bkversion}`);
                // BuildKit version reported by moby is in the format of `v0.11.0-moby`
                if (builderInfo.driver == 'docker' && !bkversion.endsWith('-moby')) {
                    return false;
                }
                if (!semver.satisfies(bkversion.replace(/-moby$/, ''), range)) {
                    return false;
                }
            }
            return true;
        });
    }
}
exports.BuildKit = BuildKit;
//# sourceMappingURL=buildkit.js.map