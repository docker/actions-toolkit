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

import {X509Certificate} from 'crypto';
import fs from 'fs';
import path from 'path';

import {Endpoints} from '@actions/attest/lib/endpoints';
import * as core from '@actions/core';
import {signPayload} from '@actions/attest/lib/sign';
import {bundleFromJSON, bundleToJSON} from '@sigstore/bundle';
import {Attestation} from '@actions/attest';
import {Bundle} from '@sigstore/sign';

import {Cosign} from '../cosign/cosign';
import {Exec} from '../exec';
import {GitHub} from '../github';
import {ImageTools} from '../buildx/imagetools';

import {MEDIATYPE_PAYLOAD as INTOTO_MEDIATYPE_PAYLOAD, Subject} from '../types/intoto/intoto';
import {FULCIO_URL, REKOR_URL, SEARCH_URL, TSASERVER_URL} from '../types/sigstore/sigstore';

export interface SignAttestationManifestsOpts {
  imageName: string;
  imageDigest: string;
  noTransparencyLog?: boolean;
}

export interface SignAttestationManifestsResult extends Attestation {
  imageName: string;
}

export interface VerifySignedManifestsOpts {
  certificateIdentityRegexp: string;
  retries?: number;
}

export interface VerifySignedManifestsResult {
  cosignArgs: Array<string>;
  signatureManifestDigest: string;
}

export interface SignProvenanceBlobsOpts {
  localExportDir: string;
  name?: string;
  noTransparencyLog?: boolean;
}

export interface SignProvenanceBlobsResult extends Attestation {
  bundlePath: string;
  subjects: Array<Subject>;
}

export interface VerifySignedArtifactsOpts {
  certificateIdentityRegexp: string;
}

export interface VerifySignedArtifactsResult {
  bundlePath: string;
  cosignArgs: Array<string>;
}

export interface SigstoreOpts {
  cosign?: Cosign;
  imageTools?: ImageTools;
}

export class Sigstore {
  private readonly cosign: Cosign;
  private readonly imageTools: ImageTools;

  constructor(opts?: SigstoreOpts) {
    this.cosign = opts?.cosign || new Cosign();
    this.imageTools = opts?.imageTools || new ImageTools();
  }

  public async signAttestationManifests(opts: SignAttestationManifestsOpts): Promise<Record<string, SignAttestationManifestsResult>> {
    if (!(await this.cosign.isAvailable())) {
      throw new Error('Cosign is required to sign attestation manifests');
    }
    const result: Record<string, SignAttestationManifestsResult> = {};
    try {
      if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
        throw new Error('missing "id-token" permission. Please add "permissions: id-token: write" to your workflow.');
      }

      const endpoints = this.signingEndpoints(opts.noTransparencyLog);
      core.info(`Using Sigstore signing endpoint: ${endpoints.fulcioURL}`);
      const noTransparencyLog = Sigstore.noTransparencyLog(opts.noTransparencyLog);

      const attestationDigests = await this.imageTools.attestationDigests(`${opts.imageName}@${opts.imageDigest}`);
      for (const attestationDigest of attestationDigests) {
        const attestationRef = `${opts.imageName}@${attestationDigest}`;
        await core.group(`Signing attestation manifest ${attestationRef}`, async () => {
          // prettier-ignore
          const cosignArgs = [
            '--verbose',
            'sign',
            '--yes',
            '--oidc-provider', 'github-actions',
            '--registry-referrers-mode', 'oci-1-1',
            '--new-bundle-format',
            '--use-signing-config'
          ];
          if (noTransparencyLog) {
            cosignArgs.push('--tlog-upload=false');
          }
          core.info(`[command]cosign ${[...cosignArgs, attestationRef].join(' ')}`);
          const execRes = await Exec.getExecOutput('cosign', [...cosignArgs, attestationRef], {
            ignoreReturnCode: true,
            silent: true,
            env: Object.assign({}, process.env, {
              COSIGN_EXPERIMENTAL: '1'
            }) as {
              [key: string]: string;
            }
          });
          const signResult = Cosign.parseCommandOutput(execRes.stderr.trim());
          if (execRes.exitCode != 0) {
            if (signResult.errors && signResult.errors.length > 0) {
              const errorMessages = signResult.errors.map(e => `- [${e.code}] ${e.message} : ${e.detail}`).join('\n');
              throw new Error(`Cosign sign command failed with errors:\n${errorMessages}`);
            } else {
              throw new Error(`Cosign sign command failed with exit code ${execRes.exitCode}`);
            }
          }
          const attest = Sigstore.toAttestation(bundleFromJSON(signResult.bundle));
          if (attest.tlogID) {
            core.info(`Uploaded to Rekor transparency log: ${SEARCH_URL}?logIndex=${attest.tlogID}`);
          }
          core.info(`Signature manifest pushed: https://oci.dag.dev/?referrers=${attestationRef}`);
          result[attestationRef] = {
            ...attest,
            imageName: opts.imageName
          };
        });
      }
    } catch (err) {
      throw new Error(`Signing BuildKit attestation manifests failed: ${(err as Error).message}`);
    }
    return result;
  }

  public async verifySignedManifests(opts: VerifySignedManifestsOpts, signed: Record<string, SignAttestationManifestsResult>): Promise<Record<string, VerifySignedManifestsResult>> {
    const result: Record<string, VerifySignedManifestsResult> = {};
    const retries = opts.retries ?? 15;

    if (!(await this.cosign.isAvailable())) {
      throw new Error('Cosign is required to verify signed manifests');
    }

    let lastError: Error | undefined;
    for (const [attestationRef, signedRes] of Object.entries(signed)) {
      await core.group(`Verifying signature of ${attestationRef}`, async () => {
        // prettier-ignore
        const cosignArgs = [
          '--verbose',
          'verify',
          '--experimental-oci11',
          '--new-bundle-format',
          '--certificate-oidc-issuer', 'https://token.actions.githubusercontent.com',
          '--certificate-identity-regexp', opts.certificateIdentityRegexp
        ];
        if (!signedRes.tlogID) {
          // skip tlog verification but still verify the signed timestamp
          cosignArgs.push('--use-signed-timestamps', '--insecure-ignore-tlog');
        }
        core.info(`[command]cosign ${[...cosignArgs, attestationRef].join(' ')}`);
        for (let attempt = 0; attempt < retries; attempt++) {
          const execRes = await Exec.getExecOutput('cosign', [...cosignArgs, attestationRef], {
            ignoreReturnCode: true,
            silent: true,
            env: Object.assign({}, process.env, {
              COSIGN_EXPERIMENTAL: '1'
            }) as {[key: string]: string}
          });
          const verifyResult = Cosign.parseCommandOutput(execRes.stderr.trim());
          if (execRes.exitCode === 0) {
            result[attestationRef] = {
              cosignArgs: cosignArgs,
              signatureManifestDigest: verifyResult.signatureManifestDigest!
            };
            lastError = undefined;
            core.info(`Signature manifest verified: https://oci.dag.dev/?image=${signedRes.imageName}@${verifyResult.signatureManifestDigest}`);
            break;
          } else {
            if (verifyResult.errors && verifyResult.errors.length > 0) {
              const errorMessages = verifyResult.errors.map(e => `- [${e.code}] ${e.message} : ${e.detail}`).join('\n');
              lastError = new Error(`Cosign verify command failed with errors:\n${errorMessages}`);
              if (verifyResult.errors.some(e => e.code === 'MANIFEST_UNKNOWN')) {
                core.info(`Cosign verify command failed with MANIFEST_UNKNOWN, retrying attempt ${attempt + 1}/${retries}...\n${errorMessages}`);
                await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 100));
              } else {
                throw lastError;
              }
            } else {
              throw new Error(`Cosign verify command failed: ${execRes.stderr}`);
            }
          }
        }
      });
    }
    if (lastError) {
      throw lastError;
    }

    return result;
  }

  public async signProvenanceBlobs(opts: SignProvenanceBlobsOpts): Promise<Record<string, SignProvenanceBlobsResult>> {
    const result: Record<string, SignProvenanceBlobsResult> = {};
    try {
      if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
        throw new Error('missing "id-token" permission. Please add "permissions: id-token: write" to your workflow.');
      }

      const endpoints = this.signingEndpoints(opts.noTransparencyLog);
      core.info(`Using Sigstore signing endpoint: ${endpoints.fulcioURL}`);

      const provenanceBlobs = Sigstore.getProvenanceBlobs(opts);
      for (const p of Object.keys(provenanceBlobs)) {
        await core.group(`Signing ${p}`, async () => {
          const blob = provenanceBlobs[p];
          const bundlePath = path.join(path.dirname(p), `${opts.name ?? 'provenance'}.sigstore.json`);
          const subjects = Sigstore.getProvenanceSubjects(blob);
          if (subjects.length === 0) {
            core.warning(`No subjects found in provenance ${p}, skip signing.`);
            return;
          }
          const bundle = await signPayload(
            {
              body: blob,
              type: INTOTO_MEDIATYPE_PAYLOAD
            },
            endpoints
          );
          const attest = Sigstore.toAttestation(bundle);
          core.info(`Provenance blob signed for:`);
          for (const subject of subjects) {
            const [digestAlg, digestValue] = Object.entries(subject.digest)[0] || [];
            core.info(`  - ${subject.name} (${digestAlg}:${digestValue})`);
          }
          if (attest.tlogID) {
            core.info(`Attestation signature uploaded to Rekor transparency log: ${SEARCH_URL}?logIndex=${attest.tlogID}`);
          }
          core.info(`Writing Sigstore bundle to: ${bundlePath}`);
          fs.writeFileSync(bundlePath, JSON.stringify(attest.bundle, null, 2), {
            encoding: 'utf-8'
          });
          result[p] = {
            ...attest,
            bundlePath: bundlePath,
            subjects: subjects
          };
        });
      }
    } catch (err) {
      throw new Error(`Signing BuildKit provenance blobs failed: ${(err as Error).message}`);
    }
    return result;
  }

  public async verifySignedArtifacts(opts: VerifySignedArtifactsOpts, signed: Record<string, SignProvenanceBlobsResult>): Promise<Record<string, VerifySignedArtifactsResult>> {
    const result: Record<string, VerifySignedArtifactsResult> = {};
    if (!(await this.cosign.isAvailable())) {
      throw new Error('Cosign is required to verify signed artifacts');
    }
    for (const [provenancePath, signedRes] of Object.entries(signed)) {
      const baseDir = path.dirname(provenancePath);
      await core.group(`Verifying signature bundle ${signedRes.bundlePath}`, async () => {
        for (const subject of signedRes.subjects) {
          const artifactPath = path.join(baseDir, subject.name);
          core.info(`Verifying signed artifact ${artifactPath}`);
          // prettier-ignore
          const cosignArgs = [
            'verify-blob-attestation',
            '--new-bundle-format',
            '--certificate-oidc-issuer', 'https://token.actions.githubusercontent.com',
            '--certificate-identity-regexp', opts.certificateIdentityRegexp
          ]
          if (!signedRes.tlogID) {
            // if there is no tlog entry, we skip tlog verification but still verify the signed timestamp
            cosignArgs.push('--use-signed-timestamps', '--insecure-ignore-tlog');
          }
          const execRes = await Exec.getExecOutput('cosign', [...cosignArgs, '--bundle', signedRes.bundlePath, artifactPath], {
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
      });
    }
    return result;
  }

  private signingEndpoints(noTransparencyLog?: boolean): Endpoints {
    noTransparencyLog = Sigstore.noTransparencyLog(noTransparencyLog);
    core.info(`Upload to transparency log: ${noTransparencyLog ? 'disabled' : 'enabled'}`);
    return {
      fulcioURL: FULCIO_URL,
      rekorURL: noTransparencyLog ? undefined : REKOR_URL,
      tsaServerURL: TSASERVER_URL
    };
  }

  private static noTransparencyLog(noTransparencyLog?: boolean): boolean {
    return noTransparencyLog ?? GitHub.context.payload.repository?.private;
  }

  private static getProvenanceBlobs(opts: SignProvenanceBlobsOpts): Record<string, Buffer> {
    // For single platform build
    const singleProvenance = path.join(opts.localExportDir, 'provenance.json');
    if (fs.existsSync(singleProvenance)) {
      return {[singleProvenance]: fs.readFileSync(singleProvenance)};
    }

    // For multi-platform build
    const dirents = fs.readdirSync(opts.localExportDir, {withFileTypes: true});
    const platformFolders = dirents.filter(dirent => dirent.isDirectory());
    if (platformFolders.length > 0 && platformFolders.length === dirents.length && platformFolders.every(platformFolder => fs.existsSync(path.join(opts.localExportDir, platformFolder.name, 'provenance.json')))) {
      const result: Record<string, Buffer> = {};
      for (const platformFolder of platformFolders) {
        const p = path.join(opts.localExportDir, platformFolder.name, 'provenance.json');
        result[p] = fs.readFileSync(p);
      }
      return result;
    }

    throw new Error(`No valid provenance.json found in ${opts.localExportDir}`);
  }

  private static getProvenanceSubjects(body: Buffer): Array<Subject> {
    const statement = JSON.parse(body.toString()) as {
      subject: Array<{name: string; digest: Record<string, string>}>;
    };
    return statement.subject.map(s => ({
      name: s.name,
      digest: s.digest
    }));
  }

  // https://github.com/actions/toolkit/blob/d3ab50471b4ff1d1274dffb90ef9c5d9949b4886/packages/attest/src/attest.ts#L90
  private static toAttestation(bundle: Bundle): Attestation {
    let certBytes: Buffer;
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

    const signingCert = new X509Certificate(certBytes);

    // Collect transparency log ID if available
    const tlogEntries = bundle.verificationMaterial.tlogEntries;
    const tlogID = tlogEntries.length > 0 ? tlogEntries[0].logIndex : undefined;

    return {
      bundle: bundleToJSON(bundle),
      certificate: signingCert.toString(),
      tlogID: tlogID
    };
  }
}
