/**
 * Copyright 2026 actions-toolkit authors
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

import {load, YAMLException} from 'js-yaml';

export interface RegistryIdentityConfig {
  awsEcr?: {
    registry: string;
    roleToAssume: string;
    region: string;
  };
  gcpWif?: {
    registry: string;
    workloadIdentityProvider: string;
    serviceAccount: string;
    projectId: string;
  };
  dockerhubOidc?: {
    registry: string;
    username: string;
    connectionID: string;
  };
}

// Parses github-builder keyless registry identity configuration
export class RegistryIdentities {
  public static parse(input: string): RegistryIdentityConfig {
    if (!input.trim()) {
      return {};
    }
    let parsed: unknown;
    try {
      parsed = load(input);
    } catch (err) {
      // Do not include YAML excerpts or tag/alias names in diagnostics.
      const location = err instanceof YAMLException && err.mark ? ` at line ${err.mark.line + 1}, column ${err.mark.column + 1}` : '';
      RegistryIdentities.fail(`Failed to parse YAML${location}`);
    }
    if (parsed === null || parsed === undefined) {
      return {};
    }
    const result: RegistryIdentityConfig = {};
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    entries.forEach((entry, index) => {
      const location = `registry-identities[${index}]`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        RegistryIdentities.fail(`${location} must be an object`);
      }
      const requireString = (key: string): string => {
        const value = entry[key];
        if (typeof value !== 'string' || !value.trim()) {
          RegistryIdentities.fail(`${location}.${key} must be a non-empty string`);
        }
        return value.trim();
      };
      const optionalString = (key: string, fallback: string): string => (Object.prototype.hasOwnProperty.call(entry, key) ? requireString(key) : fallback);
      const type = requireString('type');
      const validateKeys = (keys: Array<string>): void => {
        for (const key of Object.keys(entry)) {
          if (!keys.includes(key)) {
            RegistryIdentities.fail(`${location}.${key} is not supported for ${type}`);
          }
        }
      };
      switch (type) {
        case 'aws-ecr':
          validateKeys(['type', 'registry', 'role-to-assume', 'region']);
          if (result.awsEcr) {
            RegistryIdentities.fail('only one aws-ecr registry identity is supported');
          }
          result.awsEcr = {
            registry: requireString('registry'),
            roleToAssume: requireString('role-to-assume'),
            region: requireString('region')
          };
          break;
        case 'gcp-wif':
          validateKeys(['type', 'registry', 'workload_identity_provider', 'service_account', 'project_id']);
          if (result.gcpWif) {
            RegistryIdentities.fail('only one gcp-wif registry identity is supported');
          }
          result.gcpWif = {
            registry: requireString('registry'),
            workloadIdentityProvider: requireString('workload_identity_provider'),
            serviceAccount: requireString('service_account'),
            projectId: optionalString('project_id', '')
          };
          break;
        case 'dockerhub':
          validateKeys(['type', 'registry', 'username', 'connection_id']);
          if (result.dockerhubOidc) {
            RegistryIdentities.fail('only one dockerhub registry identity is supported');
          }
          result.dockerhubOidc = {
            registry: optionalString('registry', 'docker.io'),
            username: requireString('username'),
            connectionID: requireString('connection_id')
          };
          break;
        default:
          RegistryIdentities.fail(`${location}.type has unsupported provider ${type}`);
      }
    });
    return result;
  }

  private static fail(message: string): never {
    throw new Error(`Invalid registry-identities input: ${message}`);
  }
}
