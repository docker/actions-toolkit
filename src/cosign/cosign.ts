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

import * as core from '@actions/core';
import {BUNDLE_V03_MEDIA_TYPE, SerializedBundle} from '@sigstore/bundle';

import {Exec} from '../exec';
import * as semver from 'semver';
import {MEDIATYPE_EMPTY_JSON_V1} from '../types/oci/mediatype';

export interface CosignOpts {
  binPath?: string;
}

export interface CosignCommandResult {
  bundle?: SerializedBundle;
  signatureManifestDigest?: string;
  errors?: Array<CosignCommandError>;
}

export interface CosignCommandError {
  code: string;
  message: string;
  detail: string;
}

export class Cosign {
  private readonly binPath: string;
  private _version: string;
  private _versionOnce: boolean;

  constructor(opts?: CosignOpts) {
    this.binPath = opts?.binPath || 'cosign';
    this._version = '';
    this._versionOnce = false;
  }

  public async isAvailable(): Promise<boolean> {
    const ok: boolean = await Exec.getExecOutput(this.binPath, [], {
      ignoreReturnCode: true,
      silent: true
    })
      .then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          core.debug(`Cosign.isAvailable cmd err: ${res.stderr.trim()}`);
          return false;
        }
        return res.exitCode == 0;
      })
      .catch(error => {
        core.debug(`Cosign.isAvailable error: ${error}`);
        return false;
      });

    core.debug(`Cosign.isAvailable: ${ok}`);
    return ok;
  }

  public async version(): Promise<string> {
    if (this._versionOnce) {
      return this._version;
    }
    this._versionOnce = true;
    this._version = await Exec.getExecOutput(this.binPath, ['version', '--json'], {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      return JSON.parse(res.stdout.trim()).gitVersion;
    });
    return this._version;
  }

  public async printVersion() {
    await Exec.exec(this.binPath, ['version', '--json'], {
      failOnStdErr: false
    });
  }

  public async versionSatisfies(range: string, version?: string): Promise<boolean> {
    const ver = version ?? (await this.version());
    if (!ver) {
      core.debug(`Cosign.versionSatisfies false: undefined version`);
      return false;
    }
    const res = semver.satisfies(ver, range) || /^[0-9a-f]{7}$/.exec(ver) !== null;
    core.debug(`Cosign.versionSatisfies ${ver} statisfies ${range}: ${res}`);
    return res;
  }

  public static parseCommandOutput(logs: string): CosignCommandResult {
    let signatureManifestDigest: string | undefined;
    let signatureManifestFallbackDigest: string | undefined;
    let bundlePayload: SerializedBundle | undefined;
    let errors: Array<CosignCommandError> | undefined;

    for (const rawLine of logs.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line.startsWith('{') || !line.endsWith('}')) {
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj: any;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }

      if (obj && Array.isArray(obj.errors) && obj.errors.length > 0) {
        errors = obj.errors;
      }

      // signature manifest digest
      if (!signatureManifestDigest && obj && Array.isArray(obj.manifests) && obj.manifests.length > 0) {
        const m0 = obj.manifests[0];
        if (m0?.artifactType === BUNDLE_V03_MEDIA_TYPE && typeof m0.digest === 'string') {
          signatureManifestDigest = m0.digest;
        } else if (m0?.artifactType === MEDIATYPE_EMPTY_JSON_V1 && typeof m0.digest === 'string') {
          signatureManifestFallbackDigest = m0.digest;
        }
      }

      // signature payload
      if (!bundlePayload && obj && obj.mediaType === BUNDLE_V03_MEDIA_TYPE) {
        bundlePayload = obj as SerializedBundle;
      }

      if (bundlePayload && signatureManifestDigest) {
        break;
      }
    }

    if (!errors && !bundlePayload) {
      throw new Error(`Cannot find signature bundle from cosign command output: ${logs}`);
    }

    return {
      bundle: bundlePayload,
      signatureManifestDigest: signatureManifestDigest || signatureManifestFallbackDigest,
      errors: errors
    };
  }
}
