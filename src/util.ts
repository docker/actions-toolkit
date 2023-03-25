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

import fs from 'fs';
import * as core from '@actions/core';
import * as io from '@actions/io';
import {parse} from 'csv-parse/sync';

export interface InputListOpts {
  ignoreComma?: boolean;
  quote?: string | boolean | Buffer | null;
}

export class Util {
  public static getInputList(name: string, opts?: InputListOpts): string[] {
    const res: Array<string> = [];

    const items = core.getInput(name);
    if (items == '') {
      return res;
    }

    const records = parse(items, {
      columns: false,
      relaxQuotes: true,
      comment: '#',
      relaxColumnCount: true,
      skipEmptyLines: true,
      quote: opts?.quote
    });

    for (const record of records as Array<string[]>) {
      if (record.length == 1) {
        if (opts?.ignoreComma) {
          res.push(record[0]);
        } else {
          res.push(...record[0].split(','));
        }
      } else if (!opts?.ignoreComma) {
        res.push(...record);
      } else {
        res.push(record.join(','));
      }
    }

    return res.filter(item => item).map(pat => pat.trim());
  }

  public static async asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }

  public static isValidURL(urlStr: string): boolean {
    let url;
    try {
      url = new URL(urlStr);
    } catch (e) {
      return false;
    }
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  public static isValidRef(refStr: string): boolean {
    if (Util.isValidURL(refStr)) {
      return true;
    }
    for (const prefix of ['git://', 'github.com/', 'git@']) {
      if (refStr.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  }

  public static async powershellCommand(script: string, params?: Record<string, string>) {
    const powershellPath: string = await io.which('powershell', true);
    const escapedScript = script.replace(/'/g, "''").replace(/"|\n|\r/g, '');
    const escapedParams: string[] = [];
    if (params) {
      for (const key in params) {
        escapedParams.push(`-${key} '${params[key].replace(/'/g, "''").replace(/"|\n|\r/g, '')}'`);
      }
    }
    return {
      command: `"${powershellPath}"`,
      args: ['-NoLogo', '-Sta', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Unrestricted', '-Command', `& '${escapedScript}' ${escapedParams.join(' ')}`]
    };
  }

  public static isDirectory(p) {
    try {
      return fs.lstatSync(p).isDirectory();
    } catch (_) {
      // noop
    }
    return false;
  }
}
