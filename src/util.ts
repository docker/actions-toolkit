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

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';
import {parse} from 'csv-parse/sync';

export interface ListOpts {
  ignoreComma?: boolean;
  comment?: string;
  quote?: string | boolean | Buffer | null;
}

export class Util {
  public static getInputList(name: string, opts?: ListOpts): string[] {
    return this.getList(core.getInput(name), opts);
  }

  public static getList(input: string, opts?: ListOpts): string[] {
    const res: Array<string> = [];
    if (input == '') {
      return res;
    }

    const records = parse(input, {
      columns: false,
      relaxQuotes: true,
      comment: opts?.comment,
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

  public static getInputNumber(name: string): number | undefined {
    const value = core.getInput(name);
    if (!value) {
      return undefined;
    }
    return parseInt(value);
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

  public static trimPrefix(str: string, suffix: string): string {
    if (!str || !suffix) {
      return str;
    }
    const index = str.indexOf(suffix);
    if (index !== 0) {
      return str;
    }
    return str.substring(suffix.length);
  }

  public static trimSuffix(str: string, suffix: string): string {
    if (!str || !suffix) {
      return str;
    }
    const index = str.lastIndexOf(suffix);
    if (index === -1 || index + suffix.length !== str.length) {
      return str;
    }
    return str.substring(0, index);
  }

  public static sleep(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  public static hash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  // https://github.com/golang/go/blob/f6b93a4c358b28b350dd8fe1780c1f78e520c09c/src/strconv/atob.go#L7-L18
  public static parseBool(str: string): boolean {
    switch (str) {
      case '1':
      case 't':
      case 'T':
      case 'true':
      case 'TRUE':
      case 'True':
        return true;
      case '0':
      case 'f':
      case 'F':
      case 'false':
      case 'FALSE':
      case 'False':
        return false;
      default:
        throw new Error(`parseBool syntax error: ${str}`);
    }
  }

  public static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public static generateRandomString(length = 10) {
    const bytes = crypto.randomBytes(Math.ceil(length / 2));
    return bytes.toString('hex').slice(0, length);
  }

  public static stringToUnicodeEntities(str: string) {
    return Array.from(str)
      .map(char => `&#x${char.charCodeAt(0).toString(16)};`)
      .join('');
  }

  public static countLines(input: string): number {
    return input.split(/\r\n|\r|\n/).length;
  }

  public static isPathRelativeTo(parentPath: string, childPath: string): boolean {
    const rpp = path.resolve(parentPath);
    const rcp = path.resolve(childPath);
    return rcp.startsWith(rpp.endsWith(path.sep) ? rpp : `${rpp}${path.sep}`);
  }

  public static formatDuration(ns: number): string {
    if (ns === 0) return '0s';

    const totalSeconds = Math.floor(ns / 1e9);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (seconds || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join('');
  }
}
