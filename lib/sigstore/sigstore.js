"use strict";
/**
 * Copyright 2025 actions-toolkit authors
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
exports.Sigstore = void 0;
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const core = __importStar(require("@actions/core"));
const sign_1 = require("@actions/attest/lib/sign");
const bundle_1 = require("@sigstore/bundle");
const cosign_1 = require("../cosign/cosign");
const exec_1 = require("../exec");
const github_1 = require("../github");
const intoto_1 = require("../types/intoto/intoto");
const sigstore_1 = require("../types/sigstore/sigstore");
class Sigstore {
    constructor(opts) {
        this.cosign = (opts === null || opts === void 0 ? void 0 : opts.cosign) || new cosign_1.Cosign();
    }
    signProvenanceBlobs(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = {};
            try {
                if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
                    throw new Error('missing "id-token" permission. Please add "permissions: id-token: write" to your workflow.');
                }
                const endpoints = this.signingEndpoints(opts);
                core.info(`Using Sigstore signing endpoint: ${endpoints.fulcioURL}`);
                const provenanceBlobs = Sigstore.getProvenanceBlobs(opts);
                for (const p of Object.keys(provenanceBlobs)) {
                    yield core.group(`Signing ${p}`, () => __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        const blob = provenanceBlobs[p];
                        const bundlePath = path_1.default.join(path_1.default.dirname(p), `${(_a = opts.name) !== null && _a !== void 0 ? _a : 'provenance'}.sigstore.json`);
                        const subjects = Sigstore.getProvenanceSubjects(blob);
                        if (subjects.length === 0) {
                            core.warning(`No subjects found in provenance ${p}, skip signing.`);
                            return;
                        }
                        const bundle = yield (0, sign_1.signPayload)({
                            body: blob,
                            type: intoto_1.MEDIATYPE_PAYLOAD
                        }, endpoints);
                        const attest = Sigstore.toAttestation(bundle);
                        core.info(`Provenance blob signed for:`);
                        for (const subject of subjects) {
                            const [digestAlg, digestValue] = Object.entries(subject.digest)[0] || [];
                            core.info(`  - ${subject.name} (${digestAlg}:${digestValue})`);
                        }
                        if (attest.tlogID) {
                            core.info(`Attestation signature uploaded to Rekor transparency log: ${sigstore_1.SEARCH_URL}?logIndex=${attest.tlogID}`);
                        }
                        core.info(`Writing Sigstore bundle to: ${bundlePath}`);
                        fs_1.default.writeFileSync(bundlePath, JSON.stringify(attest.bundle, null, 2), {
                            encoding: 'utf-8'
                        });
                        result[p] = Object.assign(Object.assign({}, attest), { bundlePath: bundlePath, subjects: subjects });
                    }));
                }
            }
            catch (err) {
                throw new Error(`Signing BuildKit provenance blobs failed: ${err.message}`);
            }
            return result;
        });
    }
    verifySignedProvenanceBlobs(opts, signed) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = {};
            if (!(yield this.cosign.isAvailable())) {
                throw new Error('Cosign is required to verified signed provenance blobs');
            }
            for (const [provenancePath, signedRes] of Object.entries(signed)) {
                const baseDir = path_1.default.dirname(provenancePath);
                yield core.group(`Verifying ${signedRes.bundlePath}`, () => __awaiter(this, void 0, void 0, function* () {
                    for (const subject of signedRes.subjects) {
                        const artifactPath = path_1.default.join(baseDir, subject.name);
                        core.info(`Verifying signed artifact ${artifactPath}`);
                        // prettier-ignore
                        const cosignArgs = [
                            'verify-blob-attestation',
                            '--new-bundle-format',
                            '--certificate-oidc-issuer', 'https://token.actions.githubusercontent.com',
                            '--certificate-identity-regexp', opts.certificateIdentityRegexp
                        ];
                        if (!signedRes.bundle.verificationMaterial || !Array.isArray(signedRes.bundle.verificationMaterial.tlogEntries) || signedRes.bundle.verificationMaterial.tlogEntries.length === 0) {
                            // if there is no tlog entry, we skip tlog verification but still verify the signed timestamp
                            cosignArgs.push('--use-signed-timestamps', '--insecure-ignore-tlog');
                        }
                        const execRes = yield exec_1.Exec.getExecOutput('cosign', [...cosignArgs, '--bundle', signedRes.bundlePath, artifactPath], {
                            ignoreReturnCode: true
                        });
                        if (execRes.stderr.length > 0 && execRes.exitCode != 0) {
                            throw new Error(execRes.stderr);
                        }
                        result[artifactPath] = {
                            bundlePath: signedRes.bundlePath,
                            cosignArgs: cosignArgs
                        };
                    }
                }));
            }
            return result;
        });
    }
    signingEndpoints(opts) {
        var _a, _b;
        const noTransparencyLog = (_a = opts.noTransparencyLog) !== null && _a !== void 0 ? _a : (_b = github_1.GitHub.context.payload.repository) === null || _b === void 0 ? void 0 : _b.private;
        core.info(`Upload to transparency log: ${noTransparencyLog ? 'disabled' : 'enabled'}`);
        return {
            fulcioURL: sigstore_1.FULCIO_URL,
            rekorURL: noTransparencyLog ? undefined : sigstore_1.REKOR_URL,
            tsaServerURL: sigstore_1.TSASERVER_URL
        };
    }
    static getProvenanceBlobs(opts) {
        // For single platform build
        const singleProvenance = path_1.default.join(opts.localExportDir, 'provenance.json');
        if (fs_1.default.existsSync(singleProvenance)) {
            return { [singleProvenance]: fs_1.default.readFileSync(singleProvenance) };
        }
        // For multi-platform build
        const dirents = fs_1.default.readdirSync(opts.localExportDir, { withFileTypes: true });
        const platformFolders = dirents.filter(dirent => dirent.isDirectory());
        if (platformFolders.length > 0 && platformFolders.length === dirents.length && platformFolders.every(platformFolder => fs_1.default.existsSync(path_1.default.join(opts.localExportDir, platformFolder.name, 'provenance.json')))) {
            const result = {};
            for (const platformFolder of platformFolders) {
                const p = path_1.default.join(opts.localExportDir, platformFolder.name, 'provenance.json');
                result[p] = fs_1.default.readFileSync(p);
            }
            return result;
        }
        throw new Error(`No valid provenance.json found in ${opts.localExportDir}`);
    }
    static getProvenanceSubjects(body) {
        const statement = JSON.parse(body.toString());
        return statement.subject.map(s => ({
            name: s.name,
            digest: s.digest
        }));
    }
    // https://github.com/actions/toolkit/blob/d3ab50471b4ff1d1274dffb90ef9c5d9949b4886/packages/attest/src/attest.ts#L90
    static toAttestation(bundle) {
        let certBytes;
        switch (bundle.verificationMaterial.content.$case) {
            case 'x509CertificateChain':
                certBytes = bundle.verificationMaterial.content.x509CertificateChain.certificates[0].rawBytes;
                break;
            case 'certificate':
                certBytes = bundle.verificationMaterial.content.certificate.rawBytes;
                break;
            default:
                throw new Error('Bundle must contain an x509 certificate');
        }
        const signingCert = new crypto_1.X509Certificate(certBytes);
        // Collect transparency log ID if available
        const tlogEntries = bundle.verificationMaterial.tlogEntries;
        const tlogID = tlogEntries.length > 0 ? tlogEntries[0].logIndex : undefined;
        return {
            bundle: (0, bundle_1.bundleToJSON)(bundle),
            certificate: signingCert.toString(),
            tlogID: tlogID
        };
    }
}
exports.Sigstore = Sigstore;
//# sourceMappingURL=sigstore.js.map