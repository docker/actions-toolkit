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

import {Context} from '../context.js';

export class Config {
  public resolveFromString(s: string): string {
    return this.resolve(s, false);
  }

  public resolveFromFile(s: string): string {
    return this.resolve(s, true);
  }

  private resolve(s: string, file: boolean): string {
    if (file) {
      if (!fs.existsSync(s)) {
        throw new Error(`config file ${s} not found`);
      }
      s = fs.readFileSync(s, {encoding: 'utf-8'});
    }
    const configFile = Context.tmpName({tmpdir: Context.tmpDir()});
    fs.writeFileSync(configFile, s);
    return configFile;
  }
}
