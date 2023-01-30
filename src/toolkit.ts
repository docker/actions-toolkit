import {Context} from './context';
import {Buildx} from './buildx';
import {BuildKit} from './buildkit';
import {GitHub} from './github';

export {Builder, BuilderOpts, BuilderInfo, NodeInfo} from './builder';
export {BuildKit, BuildKitOpts} from './buildkit';
export {Buildx, BuildxOpts} from './buildx';
export {Context} from './context';
export {Docker} from './docker';
export {Git} from './git';
export {GitHub, GitHubRepo, GitHubActionsRuntimeToken} from './github';
export {Util} from './util';

export interface ToolkitOpts {
  /**
   * GitHub token to use for authentication.
   * Uses `process.env.GITHUB_TOKEN` by default.
   */
  githubToken?: string;
}

export class Toolkit {
  public context: Context;
  public github: GitHub;
  public buildx: Buildx;
  public buildkit: BuildKit;

  constructor(opts: ToolkitOpts = {}) {
    this.context = new Context();
    this.github = new GitHub({token: opts.githubToken});
    this.buildx = new Buildx({context: this.context});
    this.buildkit = new BuildKit({context: this.context, buildx: this.buildx});
  }
}
