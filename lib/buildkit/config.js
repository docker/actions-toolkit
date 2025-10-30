"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const fs_1 = __importDefault(require("fs"));
const context_1 = require("../context");
class Config {
    resolveFromString(s) {
        return this.resolve(s, false);
    }
    resolveFromFile(s) {
        return this.resolve(s, true);
    }
    resolve(s, file) {
        if (file) {
            if (!fs_1.default.existsSync(s)) {
                throw new Error(`config file ${s} not found`);
            }
            s = fs_1.default.readFileSync(s, { encoding: 'utf-8' });
        }
        const configFile = context_1.Context.tmpName({ tmpdir: context_1.Context.tmpDir() });
        fs_1.default.writeFileSync(configFile, s);
        return configFile;
    }
}
exports.Config = Config;
//# sourceMappingURL=config.js.map