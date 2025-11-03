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

import {GitHub} from './github';
import {Buildx} from './buildx/buildx';
import {Build as BuildxBuild} from './buildx/build';
import {Bake as BuildxBake} from './buildx/bake';
import {Install as BuildxInstall} from './buildx/install';
import {Builder} from './buildx/builder';
import {BuildKit} from './buildkit/buildkit';
import {Compose} from './compose/compose';
import {Install as ComposeInstall} from './compose/install';
import {Cosign} from './cosign/cosign';
import {Install as CosignInstall} from './cosign/install';
import {Regctl} from './regclient/regctl';
import {Install as RegctlInstall} from './regclient/install';
import {Undock} from './undock/undock';
import {Install as UndockInstall} from './undock/install';
import {Sigstore} from './sigstore/sigstore';

export interface ToolkitOpts {
  /**
   * GitHub token to use for authentication.
   * Uses `process.env.GITHUB_TOKEN` by default.
   */
  githubToken?: string;
}

export class Toolkit {
  public github: GitHub;
  public buildx: Buildx;
  public buildxBuild: BuildxBuild;
  public buildxBake: BuildxBake;
  public buildxInstall: BuildxInstall;
  public builder: Builder;
  public buildkit: BuildKit;
  public compose: Compose;
  public composeInstall: ComposeInstall;
  public cosign: Cosign;
  public cosignInstall: CosignInstall;
  public regctl: Regctl;
  public regctlInstall: RegctlInstall;
  public sigstore: Sigstore;
  public undock: Undock;
  public undockInstall: UndockInstall;

  constructor(opts: ToolkitOpts = {}) {
    this.github = new GitHub({token: opts.githubToken});
    this.buildx = new Buildx();
    this.buildxBuild = new BuildxBuild({buildx: this.buildx});
    this.buildxBake = new BuildxBake({buildx: this.buildx});
    this.buildxInstall = new BuildxInstall();
    this.builder = new Builder({buildx: this.buildx});
    this.buildkit = new BuildKit({buildx: this.buildx});
    this.compose = new Compose();
    this.composeInstall = new ComposeInstall();
    this.cosign = new Cosign();
    this.cosignInstall = new CosignInstall({buildx: this.buildx});
    this.regctl = new Regctl();
    this.regctlInstall = new RegctlInstall();
    this.sigstore = new Sigstore();
    this.undock = new Undock();
    this.undockInstall = new UndockInstall();
  }
}
