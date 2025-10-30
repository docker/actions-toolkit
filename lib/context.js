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
exports.Context = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const tmp = __importStar(require("tmp"));
const github = __importStar(require("@actions/github"));
const github_1 = require("./github");
class Context {
    static ensureDirExists(dir) {
        fs_1.default.mkdirSync(dir, { recursive: true });
        return dir;
    }
    static tmpDir() {
        return Context._tmpDir;
    }
    static tmpName(options) {
        return tmp.tmpNameSync(options);
    }
    static gitRef() {
        return Context.parseGitRef(github.context.ref, github.context.sha);
    }
    static parseGitRef(ref, sha) {
        const setPullRequestHeadRef = !!(process.env.DOCKER_DEFAULT_GIT_CONTEXT_PR_HEAD_REF && process.env.DOCKER_DEFAULT_GIT_CONTEXT_PR_HEAD_REF === 'true');
        if (sha && ref && !ref.startsWith('refs/')) {
            ref = `refs/heads/${ref}`;
        }
        if (sha && !ref.startsWith(`refs/pull/`)) {
            ref = sha;
        }
        else if (ref.startsWith(`refs/pull/`) && setPullRequestHeadRef) {
            ref = ref.replace(/\/merge$/g, '/head');
        }
        return ref;
    }
    static gitContext() {
        return `${github_1.GitHub.serverURL}/${github.context.repo.owner}/${github.context.repo.repo}.git#${Context.gitRef()}`;
    }
}
exports.Context = Context;
Context._tmpDir = fs_1.default.mkdtempSync(path_1.default.join(Context.ensureDirExists(process.env.RUNNER_TEMP || os_1.default.tmpdir()), 'docker-actions-toolkit-'));
//# sourceMappingURL=context.js.map