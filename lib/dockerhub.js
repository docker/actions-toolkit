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
exports.DockerHub = void 0;
const core = __importStar(require("@actions/core"));
const httpm = __importStar(require("@actions/http-client"));
const http_client_1 = require("@actions/http-client");
const apiBaseURL = 'https://hub.docker.com';
const loginURL = `${apiBaseURL}/v2/users/login?refresh_token=true`;
const repositoriesURL = `${apiBaseURL}/v2/repositories/`;
class DockerHub {
    constructor(opts, httpc) {
        this.opts = opts;
        this.httpc = httpc;
    }
    static build(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            return new DockerHub(opts, new httpm.HttpClient('docker-actions-toolkit', [], {
                headers: {
                    Authorization: `JWT ${yield DockerHub.login(opts.credentials)}`,
                    'Content-Type': 'application/json'
                }
            }));
        });
    }
    getRepositoryTags(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = new URL(`${repositoriesURL}${req.namespace}/${req.name}/tags`);
            if (req.page) {
                url.searchParams.append('page', req.page.toString());
            }
            if (req.page_size) {
                url.searchParams.append('page_size', req.page_size.toString());
            }
            const resp = yield this.httpc.get(url.toString());
            return JSON.parse(yield DockerHub.handleResponse(resp));
        });
    }
    getRepositoryAllTags(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const tags = yield this.getRepositoryTags(req);
            while (tags.next) {
                const nextURL = new URL(tags.next);
                const pageNumber = Number(nextURL.searchParams.get('page'));
                const pageSize = Number(nextURL.searchParams.get('page_size')) || undefined;
                const nextTags = yield this.getRepositoryTags({
                    namespace: req.namespace,
                    name: req.name,
                    page: pageNumber,
                    page_size: pageSize || req.page_size
                });
                tags.results.push(...nextTags.results);
                tags.next = nextTags.next;
            }
            return tags;
        });
    }
    getRepository(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const resp = yield this.httpc.get(`${repositoriesURL}${req.namespace}/${req.name}`);
            return JSON.parse(yield DockerHub.handleResponse(resp));
        });
    }
    updateRepoDescription(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const body = {
                full_description: req.full_description
            };
            if (req.description) {
                body['description'] = req.description;
            }
            const resp = yield this.httpc.patch(`${repositoriesURL}${req.namespace}/${req.name}`, JSON.stringify(body));
            return JSON.parse(yield DockerHub.handleResponse(resp));
        });
    }
    static login(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const http = new httpm.HttpClient('docker-actions-toolkit', [], {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const resp = yield http.post(loginURL, JSON.stringify(req));
            const tokenResp = JSON.parse(yield DockerHub.handleResponse(resp));
            core.setSecret(`${tokenResp.token}`);
            return `${tokenResp.token}`;
        });
    }
    static handleResponse(resp) {
        return __awaiter(this, void 0, void 0, function* () {
            const body = yield resp.readBody();
            resp.message.statusCode = resp.message.statusCode || http_client_1.HttpCodes.InternalServerError;
            if (resp.message.statusCode < 200 || resp.message.statusCode >= 300) {
                throw DockerHub.parseError(resp, body);
            }
            return body;
        });
    }
    static parseError(resp, body) {
        if (resp.message.statusCode == http_client_1.HttpCodes.Unauthorized) {
            throw new Error(`Docker Hub API: operation not permitted`);
        }
        const errResp = JSON.parse(body);
        for (const k of ['message', 'detail', 'error']) {
            if (errResp[k]) {
                throw new Error(`Docker Hub API: bad status code ${resp.message.statusCode}: ${errResp[k]}`);
            }
        }
        throw new Error(`Docker Hub API: bad status code ${resp.message.statusCode}`);
    }
}
exports.DockerHub = DockerHub;
//# sourceMappingURL=dockerhub.js.map