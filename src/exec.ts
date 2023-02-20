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
import * as exec from '@actions/exec';
import {ExecOptions, ExecOutput} from '@actions/exec';

export class Exec {
  public static async exec(commandLine: string, args?: string[], options?: ExecOptions): Promise<number> {
    core.debug(`Exec.exec: ${commandLine} ${args?.join(' ')}`);
    return exec.exec(commandLine, args, options);
  }

  public static async getExecOutput(commandLine: string, args?: string[], options?: ExecOptions): Promise<ExecOutput> {
    core.debug(`Exec.getExecOutput: ${commandLine} ${args?.join(' ')}`);
    return exec.getExecOutput(commandLine, args, options);
  }
}
