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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Toolkit = void 0;
const buildx_1 = require("./buildx/buildx");
const build_1 = require("./buildx/build");
const bake_1 = require("./buildx/bake");
const install_1 = require("./buildx/install");
const builder_1 = require("./buildx/builder");
const buildkit_1 = require("./buildkit/buildkit");
const compose_1 = require("./compose/compose");
const install_2 = require("./compose/install");
const undock_1 = require("./undock/undock");
const github_1 = require("./github");
class Toolkit {
    constructor(opts = {}) {
        this.github = new github_1.GitHub({ token: opts.githubToken });
        this.buildx = new buildx_1.Buildx();
        this.buildxBuild = new build_1.Build({ buildx: this.buildx });
        this.buildxBake = new bake_1.Bake({ buildx: this.buildx });
        this.buildxInstall = new install_1.Install();
        this.builder = new builder_1.Builder({ buildx: this.buildx });
        this.buildkit = new buildkit_1.BuildKit({ buildx: this.buildx });
        this.compose = new compose_1.Compose();
        this.composeInstall = new install_2.Install();
        this.undock = new undock_1.Undock();
    }
}
exports.Toolkit = Toolkit;
//# sourceMappingURL=toolkit.js.map