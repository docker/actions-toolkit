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

import {parse} from 'csv-parse/sync';

export class MetaImages {
  /**
   * Resolves metadata-action images input lines to enabled, lowercase names for
   * github-builder exporters, signing and manifest creation.
   */
  public static resolve(inputs: Array<string>): Array<string> {
    const records: Array<Array<string>> = inputs.map(input => parse(input, {relaxColumnCount: true, skipEmptyLines: true})[0]);

    // metadata-action also accepts a single comma-separated list of bare names.
    if (records.length === 1 && records[0].every(field => !field.includes('='))) {
      return records[0].map(name => name.trim().toLowerCase());
    }

    const images: Array<string> = [];
    for (const [index, fields] of records.entries()) {
      let name = '';
      let enable = true;
      for (const field of fields) {
        const parts = field.split('=').map(part => part.trim());
        if (parts.length === 1) {
          name = parts[0];
          continue;
        }
        const [key, value] = parts;
        switch (key.toLowerCase()) {
          case 'name':
            name = value;
            break;
          case 'enable':
            if (!['true', 'false'].includes(value)) {
              throw new Error(`Invalid enable attribute value: ${inputs[index]}`);
            }
            enable = value === 'true';
            break;
          default:
            throw new Error(`Unknown image attribute: ${inputs[index]}`);
        }
      }
      if (name.length === 0) {
        throw new Error(`Image name attribute empty: ${inputs[index]}`);
      }
      if (enable) {
        images.push(name.toLowerCase());
      }
    }
    return images;
  }
}
