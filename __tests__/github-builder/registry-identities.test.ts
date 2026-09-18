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

import {describe, expect, it} from 'vitest';

import {RegistryIdentities} from '../../src/github-builder/registry-identities.js';

const aws = {type: 'aws-ecr', registry: '123.dkr.ecr.us-east-1.amazonaws.com', 'role-to-assume': 'arn:aws:iam::123:role/build', region: 'us-east-1'};
const gcp = {type: 'gcp-wif', registry: 'us-docker.pkg.dev', workload_identity_provider: 'projects/123/locations/global/workloadIdentityPools/pool/providers/provider', service_account: 'build@example.iam.gserviceaccount.com'};
const hub = {type: 'dockerhub', username: 'builder', connection_id: 'connection'};

describe('RegistryIdentities.parse', () => {
  it.each(['', ' \n\t', 'null', '~', '---\n', '[]'])('accepts empty configuration %j', input => {
    expect(RegistryIdentities.parse(input)).toEqual({});
  });

  it('accepts a single AWS identity and trims field values', () => {
    expect(RegistryIdentities.parse('type: " aws-ecr "\nregistry: " registry "\nrole-to-assume: " role "\nregion: " region "')).toEqual({
      awsEcr: {registry: 'registry', roleToAssume: 'role', region: 'region'}
    });
  });

  it('accepts all providers in a list with optional field defaults', () => {
    expect(RegistryIdentities.parse(JSON.stringify([aws, gcp, hub]))).toEqual({
      awsEcr: {registry: aws.registry, roleToAssume: aws['role-to-assume'], region: aws.region},
      gcpWif: {registry: gcp.registry, workloadIdentityProvider: gcp.workload_identity_provider, serviceAccount: gcp.service_account, projectId: ''},
      dockerhubOidc: {registry: 'docker.io', username: 'builder', connectionID: 'connection'}
    });
  });

  it('preserves explicit optional fields, trimming whitespace', () => {
    const result = RegistryIdentities.parse(
      JSON.stringify([
        {...gcp, project_id: ' project '},
        {...hub, registry: ' index.docker.io '}
      ])
    );
    expect(result.gcpWif?.projectId).toBe('project');
    expect(result.dockerhubOidc?.registry).toBe('index.docker.io');
  });

  it.each([aws, gcp, hub])('rejects duplicate provider $type', identity => {
    expect(() => RegistryIdentities.parse(JSON.stringify([identity, identity]))).toThrow(`only one ${identity.type} registry identity is supported`);
  });

  it.each([aws, gcp, hub])('rejects unknown fields for $type', identity => {
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
    [gcp, 'project_id'],
    [hub, 'registry']
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
