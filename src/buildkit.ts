import * as fs from 'fs';
import * as semver from 'semver';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as buildx from './buildx';
import * as util from './util';

export async function getConfigInline(s: string): Promise<string> {
  return getConfig(s, false);
}

export async function getConfigFile(s: string): Promise<string> {
  return getConfig(s, true);
}

export async function getConfig(s: string, file: boolean): Promise<string> {
  if (file) {
    if (!fs.existsSync(s)) {
      throw new Error(`config file ${s} not found`);
    }
    s = fs.readFileSync(s, {encoding: 'utf-8'});
  }
  const configFile = util.tmpNameSync({
    tmpdir: util.tmpDir()
  });
  fs.writeFileSync(configFile, s);
  return configFile;
}

export async function getVersion(builderName: string, standalone?: boolean): Promise<string | undefined> {
  const builder = await buildx.inspect(builderName, standalone);
  if (builder.nodes.length == 0) {
    // a builder always have on node, should not happen.
    return undefined;
  }
  // TODO: get version for all nodes
  const node = builder.nodes[0];
  if (!node.buildkit && node.name) {
    try {
      return await getVersionWithinImage(node.name);
    } catch (e) {
      core.warning(e);
    }
  }
  return node.buildkit;
}

async function getVersionWithinImage(nodeName: string): Promise<string> {
  return exec
    .getExecOutput(`docker`, ['inspect', '--format', '{{.Config.Image}}', `buildx_buildkit_${nodeName}`], {
      ignoreReturnCode: true,
      silent: true
    })
    .then(bkitimage => {
      if (bkitimage.exitCode == 0 && bkitimage.stdout.length > 0) {
        return exec
          .getExecOutput(`docker`, ['run', '--rm', bkitimage.stdout.trim(), '--version'], {
            ignoreReturnCode: true,
            silent: true
          })
          .then(bkitversion => {
            if (bkitversion.exitCode == 0 && bkitversion.stdout.length > 0) {
              return `${bkitimage.stdout.trim()} => ${bkitversion.stdout.trim()}`;
            } else if (bkitversion.stderr.length > 0) {
              throw new Error(bkitimage.stderr.trim());
            }
            return bkitversion.stdout.trim();
          });
      } else if (bkitimage.stderr.length > 0) {
        throw new Error(bkitimage.stderr.trim());
      }
      return bkitimage.stdout.trim();
    });
}

export async function satisfies(builderName: string, range: string, standalone?: boolean): Promise<boolean> {
  const builder = await buildx.inspect(builderName, standalone);
  for (const node of builder.nodes) {
    let bkversion = node.buildkit;
    if (!bkversion) {
      try {
        bkversion = await getVersionWithinImage(node.name || '');
      } catch (e) {
        return false;
      }
    }
    // BuildKit version reported by moby is in the format of `v0.11.0-moby`
    if (builder.driver == 'docker' && !bkversion.endsWith('-moby')) {
      return false;
    }
    if (!semver.satisfies(bkversion.replace(/-moby$/, ''), range)) {
      return false;
    }
  }
  return true;
}
