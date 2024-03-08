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

import * as core from '@actions/core';

import {Buildx} from './buildx';
import {Exec} from '../exec';

import {BuilderInfo, GCPolicy, NodeInfo} from '../types/builder';

export interface BuilderOpts {
  buildx?: Buildx;
}

export class Builder {
  private readonly buildx: Buildx;

  constructor(opts?: BuilderOpts) {
    this.buildx = opts?.buildx || new Buildx();
  }

  public async exists(name: string): Promise<boolean> {
    const cmd = await this.buildx.getCommand(['inspect', name]);

    const ok: boolean = await Exec.getExecOutput(cmd.command, cmd.args, {
      ignoreReturnCode: true,
      silent: true
    })
      .then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          core.debug(`Builder.exists cmd err: ${res.stderr.trim()}`);
          return false;
        }
        return res.exitCode == 0;
      })
      .catch(error => {
        core.debug(`Builder.exists error: ${error}`);
        return false;
      });

    core.debug(`Builder.exists: ${ok}`);
    return ok;
  }

  public async inspect(name: string): Promise<BuilderInfo> {
    const cmd = await this.buildx.getCommand(['inspect', name]);
    return await Exec.getExecOutput(cmd.command, cmd.args, {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      return Builder.parseInspect(res.stdout);
    });
  }

  public static parseInspect(data: string): BuilderInfo {
    const builder: BuilderInfo = {
      nodes: []
    };
    let parsingType: string | undefined;
    let currentNode: NodeInfo = {};
    let currentGCPolicy: GCPolicy | undefined;
    for (const line of data.trim().split(`\n`)) {
      const [key, ...rest] = line.split(':');
      const lkey = key.toLowerCase();
      const value = rest.map(v => v.trim()).join(':');
      if (key.length == 0) {
        continue;
      }
      switch (true) {
        case lkey == 'name':
          parsingType = undefined;
          if (builder.name == undefined) {
            builder.name = value;
          } else {
            if (currentGCPolicy && currentNode.gcPolicy) {
              currentNode.gcPolicy.push(currentGCPolicy);
              currentGCPolicy = undefined;
            }
            if (currentNode.name) {
              builder.nodes.push(currentNode);
            }
            currentNode = {name: value};
          }
          break;
        case lkey == 'driver':
          parsingType = undefined;
          builder.driver = value;
          break;
        case lkey == 'last activity':
          parsingType = undefined;
          builder.lastActivity = new Date(value);
          break;
        case lkey == 'endpoint':
          parsingType = undefined;
          currentNode.endpoint = value;
          break;
        case lkey == 'driver options':
          parsingType = undefined;
          currentNode['driver-opts'] = (value.match(/([a-zA-Z0-9_.]+)="([^"]*)"/g) || []).map(v => v.replace(/^(.*)="(.*)"$/g, '$1=$2'));
          break;
        case lkey == 'status':
          parsingType = undefined;
          currentNode.status = value;
          break;
        case lkey == 'buildkit daemon flags':
        case lkey == 'flags': // buildx < v0.13
          parsingType = undefined;
          currentNode['buildkitd-flags'] = value;
          break;
        case lkey == 'buildkit version':
        case lkey == 'buildkit': // buildx < v0.13
          parsingType = undefined;
          currentNode.buildkit = value;
          break;
        case lkey == 'platforms': {
          parsingType = undefined;
          if (!value) {
            break;
          }
          let platforms: Array<string> = [];
          // if a preferred platform is being set then use only these
          // https://docs.docker.com/engine/reference/commandline/buildx_inspect/#get-information-about-a-builder-instance
          if (value.includes('*')) {
            for (const platform of value.split(', ')) {
              if (platform.includes('*')) {
                platforms.push(platform.replace(/\*/g, ''));
              }
            }
          } else {
            // otherwise set all platforms available
            platforms = value.split(', ');
          }
          currentNode.platforms = platforms.join(',');
          break;
        }
        case lkey == 'labels':
          parsingType = 'label';
          currentNode.labels = {};
          break;
        case lkey.startsWith('gc policy rule#'):
          parsingType = 'gcpolicy';
          if (currentNode.gcPolicy && currentGCPolicy) {
            currentNode.gcPolicy.push(currentGCPolicy);
            currentGCPolicy = undefined;
          }
          break;
        default: {
          switch (parsingType || '') {
            case 'label': {
              currentNode.labels = currentNode.labels || {};
              currentNode.labels[key.trim()] = value;
              break;
            }
            case 'gcpolicy': {
              currentNode.gcPolicy = currentNode.gcPolicy || [];
              currentGCPolicy = currentGCPolicy || {};
              switch (lkey.trim()) {
                case 'all': {
                  currentGCPolicy.all = value == 'true';
                  break;
                }
                case 'filters': {
                  if (value) {
                    currentGCPolicy.filter = value.split(',');
                  }
                  break;
                }
                case 'keep duration': {
                  currentGCPolicy.keepDuration = value;
                  break;
                }
                case 'keep bytes': {
                  currentGCPolicy.keepBytes = value;
                  break;
                }
              }
              break;
            }
          }
        }
      }
    }
    if (currentGCPolicy && currentNode.gcPolicy) {
      currentNode.gcPolicy.push(currentGCPolicy);
    }
    if (currentNode.name) {
      builder.nodes.push(currentNode);
    }
    return builder;
  }
}
