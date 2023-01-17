import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tmp from 'tmp';
import * as core from '@actions/core';
import * as github from '@actions/github';
import {parse} from 'csv-parse/sync';

let _defaultContext, _tmpDir: string;

export function defaultContext(): string {
  if (!_defaultContext) {
    let ref = github.context.ref;
    if (github.context.sha && ref && !ref.startsWith('refs/')) {
      ref = `refs/heads/${github.context.ref}`;
    }
    if (github.context.sha && !ref.startsWith(`refs/pull/`)) {
      ref = github.context.sha;
    }
    _defaultContext = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${github.context.repo.owner}/${github.context.repo.repo}.git#${ref}`;
  }
  return _defaultContext;
}

export function tmpDir(): string {
  if (!_tmpDir) {
    _tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-actions-toolkit-')).split(path.sep).join(path.posix.sep);
  }
  return _tmpDir;
}

export function tmpNameSync(options?: tmp.TmpNameOptions): string {
  return tmp.tmpNameSync(options);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function select(obj: any, path: string): any {
  if (!obj) {
    return undefined;
  }
  const i = path.indexOf('.');
  if (i < 0) {
    return obj[path];
  }
  const key = path.slice(0, i);
  return select(obj[key], path.slice(i + 1));
}

export function getInputList(name: string, ignoreComma?: boolean): string[] {
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
    skipEmptyLines: true
  });

  for (const record of records as Array<string[]>) {
    if (record.length == 1) {
      res.push(record[0]);
      continue;
    } else if (!ignoreComma) {
      res.push(...record);
      continue;
    }
    res.push(record.join(','));
  }

  return res.filter(item => item).map(pat => pat.trim());
}

export const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
  } catch (e) {
    return false;
  }
  return true;
}
