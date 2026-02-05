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

import * as core from '@actions/core';
import {bundleFromJSON, bundleToJSON, SerializedBundle} from '@sigstore/bundle';
import {Artifact, Bundle, CIContextProvider, DSSEBundleBuilder, FulcioSigner, RekorWitness, TSAWitness, Witness} from '@sigstore/sign';
import * as tuf from '@sigstore/tuf';
import {toSignedEntity, toTrustMaterial, Verifier} from '@sigstore/verify';

import {Context} from '../context.js';
import {Cosign} from '../cosign/cosign.js';
import {Exec} from '../exec.js';
import {GitHub} from '../github/github.js';
import {ImageTools} from '../buildx/imagetools.js';

import {MEDIATYPE_PAYLOAD as INTOTO_MEDIATYPE_PAYLOAD, Subject} from '../types/intoto/intoto.js';
import {
  Endpoints,
  FULCIO_URL,
  ParsedBundle,
  REKOR_URL,
  SEARCH_URL,
  SignAttestationManifestsOpts,
  SignAttestationManifestsResult,
  SignProvenanceBlobsOpts,
  SignProvenanceBlobsResult,
  TSASERVER_URL,
  VerifyArtifactOpts,
  VerifyArtifactResult,
  VerifySignedArtifactsOpts,
  VerifySignedArtifactsResult,
  VerifySignedManifestsOpts,
  VerifySignedManifestsResult
} from '../types/sigstore/sigstore.js';

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

      const cosignExtraArgs: string[] = [];
      if (await this.cosign.versionSatisfies('>=3.0.4')) {
        await core.group(`Creating Sigstore protobuf signing config`, async () => {
          const signingConfig = Context.tmpName({
            template: 'signing-config-XXXXXX.json',
            tmpdir: Context.tmpDir()
          });
          // prettier-ignore
          const createConfigArgs = [
            'signing-config',
            'create',
            '--with-default-services=true',
            `--out=${signingConfig}`
          ];
          if (noTransparencyLog) {
            createConfigArgs.push('--no-default-rekor=true');
          }
          await Exec.exec('cosign', createConfigArgs, {
            env: Object.assign({}, process.env, {
              COSIGN_EXPERIMENTAL: '1'
            }) as {
              [key: string]: string;
            }
          });
          core.info(JSON.stringify(JSON.parse(fs.readFileSync(signingConfig, {encoding: 'utf-8'})), null, 2));
          cosignExtraArgs.push(`--signing-config=${signingConfig}`);
        });
      } else {
        cosignExtraArgs.push('--use-signing-config');
        if (noTransparencyLog) {
          cosignExtraArgs.push('--tlog-upload=false');
        }
      }

      for (const imageName of opts.imageNames) {
        const attestationDigests = await this.imageTools.attestationDigests(`${imageName}@${opts.imageDigest}`);
        for (const attestationDigest of attestationDigests) {
          const attestationRef = `${imageName}@${attestationDigest}`;
          await core.group(`Signing attestation manifest ${attestationRef}`, async () => {
            // prettier-ignore
            const cosignArgs = [
              'sign',
              '--yes',
              '--oidc-provider', 'github-actions',
              '--registry-referrers-mode', 'oci-1-1',
              '--new-bundle-format',
              ...cosignExtraArgs
            ];
            core.info(`[command]cosign ${[...cosignArgs, attestationRef].join(' ')}`);
            const execRes = await Exec.getExecOutput('cosign', ['--verbose', ...cosignArgs, attestationRef], {
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
                // prettier-ignore
                throw new Error(`Cosign sign command failed with: ${execRes.stderr.trim().split(/\r?\n/).filter(line => line.length > 0).pop() ?? 'unknown error'}`);
              }
            }
            const parsedBundle = Sigstore.parseBundle(bundleFromJSON(signResult.bundle));
            if (parsedBundle.tlogID) {
              core.info(`Uploaded to Rekor transparency log: ${SEARCH_URL}?logIndex=${parsedBundle.tlogID}`);
            }
            core.info(`Signature manifest pushed: https://oci.dag.dev/?referrers=${attestationRef}`);
            result[attestationRef] = {
              ...parsedBundle,
              imageName: imageName
            };
          });
        }
      }
    } catch (err) {
      throw new Error(`Signing BuildKit attestation manifests failed: ${(err as Error).message}`);
    }
    return result;
  }

  public async verifySignedManifests(signedManifestsResult: Record<string, SignAttestationManifestsResult>, opts: VerifySignedManifestsOpts): Promise<Record<string, VerifySignedManifestsResult>> {
    const result: Record<string, VerifySignedManifestsResult> = {};
    for (const [attestationRef, signedRes] of Object.entries(signedManifestsResult)) {
      await core.group(`Verifying signature of ${attestationRef}`, async () => {
        const verifyResult = await this.verifyImageAttestation(attestationRef, {
          certificateIdentityRegexp: opts.certificateIdentityRegexp,
          noTransparencyLog: opts.noTransparencyLog || !signedRes.tlogID,
          retryOnManifestUnknown: opts.retryOnManifestUnknown
        });
        core.info(`Signature manifest verified: https://oci.dag.dev/?image=${signedRes.imageName}@${verifyResult.signatureManifestDigest}`);
        result[attestationRef] = verifyResult;
      });
    }
    return result;
  }

  public async verifyImageAttestations(image: string, opts: VerifySignedManifestsOpts): Promise<Record<string, VerifySignedManifestsResult>> {
    const result: Record<string, VerifySignedManifestsResult> = {};

    const attestationDigests = await this.imageTools.attestationDigests(image, opts.platform);
    if (attestationDigests.length === 0) {
      throw new Error(`No attestation manifests found for ${image}`);
    }

    const imageName = image.split(':', 1)[0];
    for (const attestationDigest of attestationDigests) {
      const attestationRef = `${imageName}@${attestationDigest}`;
      const verifyResult = await this.verifyImageAttestation(attestationRef, opts);
      core.info(`Signature manifest verified: https://oci.dag.dev/?image=${imageName}@${verifyResult.signatureManifestDigest}`);
      result[attestationRef] = verifyResult;
    }

    return result;
  }

  public async verifyImageAttestation(attestationRef: string, opts: VerifySignedManifestsOpts): Promise<VerifySignedManifestsResult> {
    if (!(await this.cosign.isAvailable())) {
      throw new Error('Cosign is required to verify signed manifests');
    }

    // prettier-ignore
    const cosignArgs = [
      'verify',
      '--experimental-oci11',
      '--new-bundle-format',
      '--certificate-oidc-issuer', 'https://token.actions.githubusercontent.com',
      '--certificate-identity-regexp', opts.certificateIdentityRegexp
    ];
    if (opts.noTransparencyLog) {
      // skip tlog verification but still verify the signed timestamp
      cosignArgs.push('--use-signed-timestamps', '--insecure-ignore-tlog');
    }

    if (!opts.retryOnManifestUnknown) {
      core.info(`[command]cosign ${[...cosignArgs, attestationRef].join(' ')}`);
      const execRes = await Exec.getExecOutput('cosign', ['--verbose', ...cosignArgs, attestationRef], {
        ignoreReturnCode: true,
        silent: true,
        env: Object.assign({}, process.env, {
          COSIGN_EXPERIMENTAL: '1'
        }) as {[key: string]: string}
      });
      if (execRes.exitCode !== 0) {
        // prettier-ignore
        throw new Error(`Cosign verify command failed with: ${execRes.stderr.trim().split(/\r?\n/).filter(line => line.length > 0).pop() ?? 'unknown error'}`);
      }
      const verifyResult = Cosign.parseCommandOutput(execRes.stderr.trim());
      return {
        cosignArgs: cosignArgs,
        signatureManifestDigest: verifyResult.signatureManifestDigest!
      };
    }

    const retries = 15;
    let lastError: Error | undefined;
    core.info(`[command]cosign ${[...cosignArgs, attestationRef].join(' ')}`);
    for (let attempt = 0; attempt < retries; attempt++) {
      const execRes = await Exec.getExecOutput('cosign', ['--verbose', ...cosignArgs, attestationRef], {
        ignoreReturnCode: true,
        silent: true,
        env: Object.assign({}, process.env, {
          COSIGN_EXPERIMENTAL: '1'
        }) as {[key: string]: string}
      });
      const verifyResult = Cosign.parseCommandOutput(execRes.stderr.trim());
      if (execRes.exitCode === 0) {
        return {
          cosignArgs: cosignArgs,
          signatureManifestDigest: verifyResult.signatureManifestDigest!
        };
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
          // prettier-ignore
          throw new Error(`Cosign verify command failed with: ${execRes.stderr.trim().split(/\r?\n/).filter(line => line.length > 0).pop() ?? 'unknown error'}`);
        }
      }
    }

    throw lastError;
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
          const bundle = await Sigstore.signPayload(
            {
              data: blob,
              type: INTOTO_MEDIATYPE_PAYLOAD
            },
            endpoints
          );
          const parsedBundle = Sigstore.parseBundle(bundle);
          core.info(`Provenance blob signed for:`);
          for (const subject of subjects) {
            const [digestAlg, digestValue] = Object.entries(subject.digest)[0] || [];
            core.info(`  - ${subject.name} (${digestAlg}:${digestValue})`);
          }
          if (parsedBundle.tlogID) {
            core.info(`Attestation signature uploaded to Rekor transparency log: ${SEARCH_URL}?logIndex=${parsedBundle.tlogID}`);
          }
          core.info(`Writing Sigstore bundle to: ${bundlePath}`);
          fs.writeFileSync(bundlePath, JSON.stringify(parsedBundle.payload, null, 2), {
            encoding: 'utf-8'
          });
          result[p] = {
            ...parsedBundle,
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

  public async verifySignedArtifacts(signedArtifactsResult: Record<string, SignProvenanceBlobsResult>, opts: VerifySignedArtifactsOpts): Promise<Record<string, VerifySignedArtifactsResult>> {
    const result: Record<string, VerifySignedArtifactsResult> = {};
    if (!(await this.cosign.isAvailable())) {
      throw new Error('Cosign is required to verify signed artifacts');
    }
    for (const [provenancePath, signedRes] of Object.entries(signedArtifactsResult)) {
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
          if (opts.noTransparencyLog || !signedRes.tlogID) {
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

  public async verifyArtifact(artifactPath: string, bundlePath: string, opts?: VerifyArtifactOpts): Promise<VerifyArtifactResult> {
    core.info(`Verifying keyless verification bundle signature`);
    const parsedBundle = JSON.parse(fs.readFileSync(bundlePath, 'utf-8')) as SerializedBundle;
    const bundle = bundleFromJSON(parsedBundle);

    core.info(`Fetching Sigstore TUF trusted root metadata`);
    const trustedRoot = await tuf.getTrustedRoot();
    const trustMaterial = toTrustMaterial(trustedRoot);

    try {
      core.info(`Verifying artifact signature`);
      const signedEntity = toSignedEntity(bundle, fs.readFileSync(artifactPath));
      const signingCert = Sigstore.parseCertificate(bundle);

      // collect transparency log ID if available
      const tlogEntries = bundle.verificationMaterial.tlogEntries;
      const tlogID = tlogEntries.length > 0 ? tlogEntries[0].logIndex : undefined;

      // TODO: remove when subjectAlternativeName check with regex is supported: https://github.com/sigstore/sigstore-js/pull/1556
      if (opts?.subjectAlternativeName && opts?.subjectAlternativeName instanceof RegExp) {
        const subjectAltName = signingCert.subjectAltName?.replace(/^uri:/i, '');
        if (!subjectAltName) {
          throw new Error('Signing certificate does not contain subjectAltName');
        } else if (!subjectAltName.match(opts.subjectAlternativeName)) {
          throw new Error(`Signing certificate subjectAlternativeName "${subjectAltName}" does not match expected pattern`);
        }
      }

      const verifier = new Verifier(trustMaterial);
      const signer = verifier.verify(signedEntity, {
        subjectAlternativeName: opts?.subjectAlternativeName && typeof opts.subjectAlternativeName === 'string' ? opts.subjectAlternativeName : undefined,
        extensions: opts?.issuer ? {issuer: opts.issuer} : undefined
      });
      core.debug(`Sigstore.verifyArtifact signer: ${JSON.stringify(signer)}`);

      return {
        payload: parsedBundle,
        certificate: signingCert.toString(),
        tlogID: tlogID
      };
    } catch (err) {
      throw new Error(`Failed to verify artifact signature: ${err}`);
    }
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

  private static async signPayload(artifact: Artifact, endpoints: Endpoints, timeout?: number, retries?: number): Promise<Bundle> {
    const witnesses: Witness[] = [];

    const signer = new FulcioSigner({
      identityProvider: new CIContextProvider('sigstore'),
      fulcioBaseURL: endpoints.fulcioURL,
      timeout: timeout,
      retry: retries
    });

    if (endpoints.rekorURL) {
      witnesses.push(
        new RekorWitness({
          rekorBaseURL: endpoints.rekorURL,
          fetchOnConflict: true,
          timeout: timeout,
          retry: retries
        })
      );
    }

    if (endpoints.tsaServerURL) {
      witnesses.push(
        new TSAWitness({
          tsaBaseURL: endpoints.tsaServerURL,
          timeout: timeout,
          retry: retries
        })
      );
    }

    return new DSSEBundleBuilder({signer, witnesses}).create(artifact);
  }

  private static parseBundle(bundle: Bundle): ParsedBundle {
    const signingCert = Sigstore.parseCertificate(bundle);

    // collect transparency log ID if available
    const tlogEntries = bundle.verificationMaterial.tlogEntries;
    const tlogID = tlogEntries.length > 0 ? tlogEntries[0].logIndex : undefined;

    return {
      payload: bundleToJSON(bundle),
      certificate: signingCert.toString(),
      tlogID: tlogID
    };
  }

  private static parseCertificate(bundle: Bundle): X509Certificate {
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
    return new X509Certificate(certBytes);
  }
}
