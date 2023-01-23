import * as exec from '@actions/exec';

export class Docker {
  public static isAvailable(): boolean {
    let dockerAvailable = false;
    exec
      .getExecOutput('docker', undefined, {
        ignoreReturnCode: true,
        silent: true
      })
      .then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          dockerAvailable = false;
        } else {
          dockerAvailable = res.exitCode == 0;
        }
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .catch(error => {
        dockerAvailable = false;
      });
    return dockerAvailable;
  }

  public static async printVersion(standalone?: boolean) {
    const noDocker = standalone ?? !Docker.isAvailable();
    if (noDocker) {
      return;
    }
    await exec.exec('docker', ['version'], {
      failOnStdErr: false
    });
  }

  public static async printInfo(standalone?: boolean) {
    const noDocker = standalone ?? !Docker.isAvailable();
    if (noDocker) {
      return;
    }
    await exec.exec('docker', ['info'], {
      failOnStdErr: false
    });
  }
}
