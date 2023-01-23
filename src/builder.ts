import * as exec from '@actions/exec';

import {Buildx} from './buildx';

export interface BuilderInfo {
  name?: string;
  driver?: string;
  lastActivity?: Date;
  nodes: NodeInfo[];
}

export interface NodeInfo {
  name?: string;
  endpoint?: string;
  driverOpts?: Array<string>;
  status?: string;
  buildkitdFlags?: string;
  buildkitVersion?: string;
  platforms?: string;
}

export interface BuilderOpts {
  buildx?: Buildx;
}

export class Builder {
  private buildx: Buildx;

  constructor(opts?: BuilderOpts) {
    this.buildx = opts?.buildx || new Buildx();
  }

  public async inspect(name: string): Promise<BuilderInfo> {
    const cmd = this.buildx.getCommand(['inspect', name]);
    return await exec
      .getExecOutput(cmd.command, cmd.args, {
        ignoreReturnCode: true,
        silent: true
      })
      .then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          throw new Error(res.stderr.trim());
        }
        return Builder.parseInspect(res.stdout);
      });
  }

  public static parseInspect(data: string): BuilderInfo {
    const builder: BuilderInfo = {
      nodes: []
    };
    let node: NodeInfo = {};
    for (const line of data.trim().split(`\n`)) {
      const [key, ...rest] = line.split(':');
      const value = rest.map(v => v.trim()).join(':');
      if (key.length == 0 || value.length == 0) {
        continue;
      }
      switch (key.toLowerCase()) {
        case 'name': {
          if (builder.name == undefined) {
            builder.name = value;
          } else {
            if (Object.keys(node).length > 0) {
              builder.nodes.push(node);
              node = {};
            }
            node.name = value;
          }
          break;
        }
        case 'driver': {
          builder.driver = value;
          break;
        }
        case 'last activity': {
          builder.lastActivity = new Date(value);
          break;
        }
        case 'endpoint': {
          node.endpoint = value;
          break;
        }
        case 'driver options': {
          node.driverOpts = (value.match(/(\w+)="([^"]*)"/g) || []).map(v => v.replace(/^(.*)="(.*)"$/g, '$1=$2'));
          break;
        }
        case 'status': {
          node.status = value;
          break;
        }
        case 'flags': {
          node.buildkitdFlags = value;
          break;
        }
        case 'buildkit': {
          node.buildkitVersion = value;
          break;
        }
        case 'platforms': {
          let platforms: Array<string> = [];
          // if a preferred platform is being set then use only these
          // https://docs.docker.com/engine/reference/commandline/buildx_inspect/#get-information-about-a-builder-instance
          if (value.includes('*')) {
            for (const platform of value.split(', ')) {
              if (platform.includes('*')) {
                platforms.push(platform.replace('*', ''));
              }
            }
          } else {
            // otherwise set all platforms available
            platforms = value.split(', ');
          }
          node.platforms = platforms.join(',');
          break;
        }
      }
    }
    if (Object.keys(node).length > 0) {
      builder.nodes.push(node);
    }
    return builder;
  }
}
