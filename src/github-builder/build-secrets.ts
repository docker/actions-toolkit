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

import fs from 'fs';
import path from 'path';
import * as core from '@actions/core';
import {FAILSAFE_SCHEMA, load, YAMLException} from 'js-yaml';

import {Context} from '../context.js';

export interface PreparedBuildSecrets {
  // Persist as a step output for cleanup after the build, including on failure
  directory: string;
  // Join with newlines for Build secret-files or append to Bake set input
  inputs: Array<string>;
}

interface Secret {
  key: string;
  value: string;
}

// The github-builder build-secrets contract, backed by temporary files.
// Read the input with core.getInput('build-secrets', {trimWhitespace: false}).
export class BuildSecrets {
  public static prepareBuild(input: string): PreparedBuildSecrets {
    const secrets = Object.entries(BuildSecrets.parse(input)).map(([id, value]) => {
      // secret-files is parsed as a comma-aware list of id=path entries.
      if (!id || id !== id.trim() || /[\r\n=,"]/.test(id)) {
        throw new Error('Build secret IDs must not be empty or contain surrounding whitespace, line breaks, commas, double quotes or "="');
      }
      if (id === 'GIT_AUTH_TOKEN') {
        throw new Error('Build secret id "GIT_AUTH_TOKEN" is reserved for Git context authentication');
      }
      if (typeof value !== 'string') {
        throw new Error(`build-secrets value for "${id}" must be a string`);
      }
      return {key: id, value};
    });
    return BuildSecrets.write(secrets, '');
  }

  public static prepareBake(input: string, defaultTarget: string, targets: Array<string>): PreparedBuildSecrets {
    const allowedTargets = new Set(targets);
    const secrets = Object.entries(BuildSecrets.parse(input)).flatMap(([key, value]) => {
      if (typeof value !== 'string' && (!value || typeof value !== 'object' || Array.isArray(value))) {
        throw new Error('build-secrets entries must be secret strings or target mappings');
      }
      const target = typeof value === 'string' ? defaultTarget : key;
      if (!target || /[\r\n=]/.test(target)) {
        throw new Error('Build secret targets must not be empty or contain line breaks or "="');
      }
      if (!allowedTargets.has(target)) {
        throw new Error(`Build secret target "${target}" is not part of the resolved Bake definition`);
      }
      // Only nested mappings qualify targets; dots in IDs are always literal.
      const entries: Array<[string, unknown]> = typeof value === 'string' ? [[key, value]] : Object.entries(value);
      return entries.map(([id, secret]) => {
        if (!id || /[\r\n=]/.test(id)) {
          throw new Error('Build secret IDs must not be empty or contain line breaks or "="');
        }
        if (typeof secret !== 'string') {
          throw new Error('build-secrets values within target mappings must be strings');
        }
        return {key: `${target}.secret.${id}`, value: secret};
      });
    });
    return BuildSecrets.write(secrets, 'src=');
  }

  // Call from the workflow always() cleanup step using the returned directory
  public static cleanup(directory: string): void {
    if (directory) {
      fs.rmSync(directory, {recursive: true, force: true});
    }
  }

  private static parse(input: string): Record<string, unknown> {
    if (!input.trim()) {
      return {};
    }
    let parsed: unknown;
    try {
      parsed = load(input, {schema: FAILSAFE_SCHEMA});
    } catch (err) {
      // Messages and reasons can include secrets, even without a source excerpt.
      const location = err instanceof YAMLException && err.mark ? ` at line ${err.mark.line + 1}, column ${err.mark.column + 1}` : '';
      throw new Error(`Failed to parse build-secrets YAML${location}`);
    }
    if (!parsed) {
      return {};
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('build-secrets must be a YAML object');
    }
    return parsed as Record<string, unknown>;
  }

  private static write(secrets: Array<Secret>, source: string): PreparedBuildSecrets {
    if (!secrets.length) {
      return {directory: '', inputs: []};
    }
    secrets.forEach(secret => core.setSecret(secret.value));
    const directory = fs.mkdtempSync(path.join(Context.tmpDir(), 'build-secrets-'));
    try {
      const inputs = secrets.map(({key, value}, index) => {
        const file = path.join(directory, String(index));
        fs.writeFileSync(file, value, {mode: 0o600});
        return `${key}=${source}${file}`;
      });
      return {directory, inputs};
    } catch (err) {
      BuildSecrets.cleanup(directory);
      throw err;
    }
  }
}
