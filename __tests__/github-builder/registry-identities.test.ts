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

import {afterEach, describe, expect, it, vi} from 'vitest';
import * as core from '@actions/core';

import {RegistryIdentities} from '../../src/github-builder/registry-identities.js';

vi.mock('@actions/core', () => ({info: vi.fn()}));

const aws = {type: 'aws-ecr', registry: '123.dkr.ecr.us-east-1.amazonaws.com', 'role-to-assume': 'arn:aws:iam::123:role/build', region: 'us-east-1'};
const gcp = {type: 'gcp-wif', registry: 'us-docker.pkg.dev', workload_identity_provider: 'projects/123/locations/global/workloadIdentityPools/pool/providers/provider', service_account: 'build@example.iam.gserviceaccount.com'};
const hub = {type: 'dockerhub', username: 'builder', connection_id: 'connection'};
const azure = {type: 'azure-acr', registry: 'myregistry.azurecr.io', client_id: 'client', tenant_id: 'tenant', subscription_id: 'subscription'};
const chainguard = {type: 'chainguard', identity: 'organization/identity'};
const identities = [aws, gcp, hub, azure, chainguard];

describe('RegistryIdentities.parse', () => {
  afterEach(() => {
    vi.mocked(core.info).mockReset();
  });

  it.each(['', ' \n\t'])('accepts blank configuration %j without logging', input => {
    expect(RegistryIdentities.parse(input)).toEqual({});
    expect(core.info).not.toHaveBeenCalled();
  });

  it.each(['null', '~', '---\n'])('accepts empty parsed configuration %j and logs why outputs are disabled', input => {
    expect(RegistryIdentities.parse(input)).toEqual({});
    expect(core.info).toHaveBeenCalledExactlyOnceWith('Registry identities input is empty after parsing; disabling registry identity outputs');
  });

  it('accepts an empty identity list and logs why outputs are disabled', () => {
    expect(RegistryIdentities.parse('[]')).toEqual({});
    expect(core.info).toHaveBeenCalledExactlyOnceWith('No registry identity entries parsed; disabling registry identity outputs');
  });

  it('accepts a single AWS identity and trims field values', () => {
    expect(RegistryIdentities.parse('type: " aws-ecr "\nregistry: " registry "\nrole-to-assume: " role "\nregion: " region "')).toEqual({
      awsEcr: {registry: 'registry', roleToAssume: 'role', region: 'region', accountIDs: ''}
    });
  });

  it('accepts all providers in a list with optional field defaults', () => {
    expect(RegistryIdentities.parse(JSON.stringify(identities))).toEqual({
      awsEcr: {registry: aws.registry, roleToAssume: aws['role-to-assume'], region: aws.region, accountIDs: ''},
      gcpWif: {registry: gcp.registry, workloadIdentityProvider: gcp.workload_identity_provider, serviceAccount: gcp.service_account, projectId: ''},
      dockerhubOidc: {registry: 'docker.io', username: 'builder', connectionID: 'connection'},
      azureAcr: {registry: azure.registry, clientId: azure.client_id, tenantId: azure.tenant_id, subscriptionId: azure.subscription_id},
      chainguard: {identity: chainguard.identity, apkHost: 'apk.cgr.dev', librariesHost: 'libraries.cgr.dev'}
    });
    expect(core.info).toHaveBeenCalledExactlyOnceWith('Validating 5 registry identity entries');
  });

  it('preserves explicit optional fields, trimming whitespace', () => {
    const result = RegistryIdentities.parse(
      JSON.stringify([
        {...aws, account_ids: ' 012345678910,023456789012 '},
        {...gcp, project_id: ' project '},
        {...hub, registry: ' index.docker.io '},
        {...chainguard, apk_host: ' apk.example.com ', libraries_host: ' libraries.example.com '}
      ])
    );
    expect(result.awsEcr?.accountIDs).toBe('012345678910,023456789012');
    expect(result.gcpWif?.projectId).toBe('project');
    expect(result.dockerhubOidc?.registry).toBe('index.docker.io');
    expect(result.chainguard).toEqual({identity: chainguard.identity, apkHost: 'apk.example.com', librariesHost: 'libraries.example.com'});
  });

  it.each(identities)('rejects duplicate provider $type', identity => {
    expect(() => RegistryIdentities.parse(JSON.stringify([identity, identity]))).toThrow(`only one ${identity.type} registry identity is supported`);
  });

  it.each(identities)('rejects unknown fields for $type', identity => {
    expect(() => RegistryIdentities.parse(JSON.stringify({...identity, unexpected: 'value'}))).toThrow(`registry-identities[0].unexpected is not supported for ${identity.type}`);
  });

  it.each([
    [aws, 'registry'],
    [aws, 'role-to-assume'],
    [aws, 'region'],
    [gcp, 'registry'],
    [gcp, 'workload_identity_provider'],
    [gcp, 'service_account'],
    [hub, 'username'],
    [hub, 'connection_id'],
    [azure, 'registry'],
    [azure, 'client_id'],
    [azure, 'tenant_id'],
    [azure, 'subscription_id'],
    [chainguard, 'identity'],
    [hub, 'type']
  ] as Array<[Record<string, unknown>, string]>)('rejects missing or invalid required fields in %j: %s', (identity, key) => {
    const missing = {...identity};
    delete missing[key];
    expect(() => RegistryIdentities.parse(JSON.stringify(missing))).toThrow(`registry-identities[0].${key} must be a non-empty string`);
    for (const value of ['', '  ', null, true, 123, [], {}]) {
      expect(() => RegistryIdentities.parse(JSON.stringify({...identity, [key]: value}))).toThrow(`registry-identities[0].${key} must be a non-empty string`);
    }
  });

  it.each([
    [aws, 'account_ids'],
    [gcp, 'project_id'],
    [hub, 'registry'],
    [chainguard, 'apk_host'],
    [chainguard, 'libraries_host']
  ] as Array<[Record<string, unknown>, string]>)('rejects invalid optional fields in %j: %s', (identity, key) => {
    for (const value of ['', '  ', null, false, 123, [], {}]) {
      expect(() => RegistryIdentities.parse(JSON.stringify({...identity, [key]: value}))).toThrow(`registry-identities[0].${key} must be a non-empty string`);
    }
  });

  it.each(['text', 'true', '123', '[null]', '[[]]', '[text]'])('rejects non-object entries %j', input => {
    expect(() => RegistryIdentities.parse(input)).toThrow('Invalid registry-identities input: registry-identities[0] must be an object');
  });

  it('reports the index of an invalid entry', () => {
    expect(() => RegistryIdentities.parse(JSON.stringify([aws, null]))).toThrow('registry-identities[1] must be an object');
  });

  it('rejects unknown providers', () => {
    expect(() => RegistryIdentities.parse('type: unknown')).toThrow('registry-identities[0].type has unsupported provider unknown');
  });

  it('retains default YAML scalar typing rather than coercing identity fields to strings', () => {
    expect(() => RegistryIdentities.parse('type: dockerhub\nusername: user\nconnection_id: 123')).toThrow('connection_id must be a non-empty string');
    expect(RegistryIdentities.parse('type: dockerhub\nusername: user\nconnection_id: "123"').dockerhubOidc?.connectionID).toBe('123');
  });

  it.each(['type: [PRIVATE', 'type: !PRIVATE value', 'type: *PRIVATE', 'type: PRIVATE\ntype: dockerhub'])('suppresses secret-bearing YAML errors for %j', input => {
    expect(() => RegistryIdentities.parse(input)).toThrow(/^Invalid registry-identities input: Failed to parse YAML at line \d+, column \d+$/);
  });
});
