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

import * as core from '@actions/core';

export interface RunnerConfig {
  defaultRunner: string;
  rules: Array<{pattern: string; runner: string}>;
}

// Parses github-builder runner input and selects runners by platform prefix
export class RunnerMapping {
  public static parse(input: Array<string>): RunnerConfig {
    const lines = input.map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) {
      throw new Error('runner input cannot be empty');
    }
    if (lines.length === 1 && !lines[0].includes('=')) {
      const label = lines[0];
      if (label === 'auto') {
        core.warning('The runner input value "auto" is deprecated; use a runner mapping with default=ubuntu-24.04, linux/arm=ubuntu-24.04-arm, and linux/arm64=ubuntu-24.04-arm instead');
        return {
          defaultRunner: 'ubuntu-24.04',
          rules: [
            {pattern: 'linux/arm', runner: 'ubuntu-24.04-arm'},
            {pattern: 'linux/arm64', runner: 'ubuntu-24.04-arm'}
          ]
        };
      }
      if (label === 'amd64' || label === 'arm64') {
        const runner = label === 'amd64' ? 'ubuntu-24.04' : 'ubuntu-24.04-arm';
        core.warning(`The runner input value "${label}" is deprecated; use runner=${runner} instead`);
        return {defaultRunner: runner, rules: []};
      }
      return {defaultRunner: label, rules: []};
    }
    const rules: RunnerConfig['rules'] = [];
    let defaultRunner: string | undefined;
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx === -1) {
        throw new Error(`Invalid runner mapping: ${line}`);
      }
      const pattern = line.substring(0, idx).trim();
      const runner = line.substring(idx + 1).trim();
      if (!pattern) {
        throw new Error('Runner mapping pattern cannot be empty');
      }
      if (!runner) {
        throw new Error(`Runner mapping value cannot be empty for ${pattern}`);
      }
      if (pattern === 'default') {
        defaultRunner = runner;
        continue;
      }
      if (pattern.split('/').some(part => part.length === 0)) {
        throw new Error(`Runner mapping pattern is not a valid platform prefix: ${pattern}`);
      }
      rules.push({pattern, runner});
    }
    if (!defaultRunner) {
      throw new Error('Runner mapping must define a default runner');
    }
    return {defaultRunner, rules};
  }

  public static resolve(config: RunnerConfig, platform?: string): string {
    if (!platform) {
      return config.defaultRunner;
    }
    const platformParts = platform.split('/');
    let runner = config.defaultRunner;
    let specificity = 0;
    for (const rule of config.rules) {
      const patternParts = rule.pattern.split('/');
      if (patternParts.length > platformParts.length || !patternParts.every((part, index) => part === platformParts[index])) {
        continue;
      }
      // Prefer the most specific prefix; later rules win at equal specificity.
      if (patternParts.length >= specificity) {
        runner = rule.runner;
        specificity = patternParts.length;
      }
    }
    return runner;
  }
}
