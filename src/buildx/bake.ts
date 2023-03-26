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

import {Buildx} from './buildx';
import {Exec} from '../exec';
import {Inputs} from './inputs';
import {Util} from '../util';

import {BakeDefinition} from '../types/bake';

export interface BakeOpts {
  buildx?: Buildx;
}

export class Bake {
  private readonly buildx: Buildx;

  constructor(opts?: BakeOpts) {
    this.buildx = opts?.buildx || new Buildx();
  }

  public async parseDefinitions(sources: Array<string>, targets: Array<string>, workdir?: string): Promise<BakeDefinition> {
    const args = ['bake'];

    let remoteDef;
    const files: Array<string> = [];
    if (sources) {
      for (const source of sources) {
        if (!Util.isValidRef(source)) {
          files.push(source);
          continue;
        }
        if (remoteDef) {
          throw new Error(`Only one remote bake definition is allowed`);
        }
        remoteDef = source;
      }
    }
    if (remoteDef) {
      args.push(remoteDef);
    }
    for (const file of files) {
      args.push('--file', file);
    }

    const printCmd = await this.buildx.getCommand([...args, '--print', ...targets]);
    return await Exec.getExecOutput(printCmd.command, printCmd.args, {
      cwd: workdir,
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr);
      }
      return <BakeDefinition>JSON.parse(res.stdout.trim());
    });
  }

  public static hasLocalExporter(def: BakeDefinition): boolean {
    return Inputs.hasExporterType('local', Bake.exporters(def));
  }

  public static hasTarExporter(def: BakeDefinition): boolean {
    return Inputs.hasExporterType('tar', Bake.exporters(def));
  }

  public static hasDockerExporter(def: BakeDefinition, load?: boolean): boolean {
    return load || Inputs.hasExporterType('docker', Bake.exporters(def));
  }

  private static exporters(def: BakeDefinition): Array<string> {
    const exporters = new Array<string>();
    for (const key in def.target) {
      const target = def.target[key];
      if (target.output) {
        exporters.push(...target.output);
      }
    }
    return exporters;
  }
}
