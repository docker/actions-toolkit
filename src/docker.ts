import * as core from '@actions/core';
import * as exec from '@actions/exec';

export class Docker {
  public static async isAvailable(): Promise<boolean> {
    return await exec
      .getExecOutput('docker', undefined, {
        ignoreReturnCode: true,
        silent: true
      })
      .then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          return false;
        }
        return res.exitCode == 0;
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .catch(error => {
        return false;
      });
  }

  public static async info(standalone?: boolean) {
    if (standalone) {
      core.info(`Docker info skipped in standalone mode`);
    } else {
      await exec.exec('docker', ['version'], {
        failOnStdErr: false
      });
      await exec.exec('docker', ['info'], {
        failOnStdErr: false
      });
    }
  }
}
