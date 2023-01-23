import * as core from '@actions/core';
import {parse} from 'csv-parse/sync';

export class Util {
  public static getInputList(name: string, ignoreComma?: boolean): string[] {
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

  public static async asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }

  public static isValidUrl(url: string): boolean {
    try {
      new URL(url);
    } catch (e) {
      return false;
    }
    return true;
  }
}
