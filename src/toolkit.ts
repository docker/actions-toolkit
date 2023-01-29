import {Context} from './context';
import {Buildx} from './buildx';
import {BuildKit} from './buildkit';

export {BuildKit, BuildKitOpts} from './buildkit';
export {Builder, BuilderOpts, BuilderInfo, NodeInfo} from './builder';
export {Buildx, BuildxOpts} from './buildx';
export {Context, ReposGetResponseData, Jwt} from './context';
export {Docker} from './docker';
export {Git} from './git';
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
  public buildx: Buildx;
  public buildkit: BuildKit;

  constructor(opts: ToolkitOpts = {}) {
    this.context = new Context(opts.githubToken);
    this.buildx = new Buildx({context: this.context});
    this.buildkit = new BuildKit({context: this.context, buildx: this.buildx});
  }
}
