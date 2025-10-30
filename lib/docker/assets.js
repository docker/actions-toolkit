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
exports.limaYamlData = exports.dockerServiceLogsPs1Data = exports.setupDockerWinPs1Data = exports.limaYaml = exports.dockerServiceLogsPs1 = exports.setupDockerWinPs1 = void 0;
const fs_1 = __importDefault(require("fs"));
const context_1 = require("../context");
const setupDockerWinPs1 = () => {
    return get('docker-setup-win.ps1', exports.setupDockerWinPs1Data);
};
exports.setupDockerWinPs1 = setupDockerWinPs1;
const dockerServiceLogsPs1 = () => {
    return get('docker-service-logs.ps1', exports.dockerServiceLogsPs1Data);
};
exports.dockerServiceLogsPs1 = dockerServiceLogsPs1;
const limaYaml = () => {
    return get('lima.yaml', exports.limaYamlData);
};
exports.limaYaml = limaYaml;
const get = (filename, data, mode) => {
    const assetPath = context_1.Context.tmpName({
        template: `docker-asset-XXXXXX-${filename}`,
        tmpdir: context_1.Context.tmpDir()
    });
    fs_1.default.writeFileSync(assetPath, data);
    if (mode) {
        fs_1.default.chmodSync(assetPath, mode);
    }
    return assetPath;
};
exports.setupDockerWinPs1Data = `
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ToolDir,

    [Parameter(Mandatory = $true)]
    [string]$RunDir,

    [Parameter(Mandatory = $true)]
    [string]$DockerHostSocket,

    [Parameter(Mandatory = $false)]
    [string]$DockerHostTCP,

    [Parameter(Mandatory = $false)]
    [string]$DaemonConfig)

$pwver = (Get-ItemProperty -Path HKLM:\\SOFTWARE\\Microsoft\\PowerShell\\3\\PowerShellEngine -Name 'PowerShellVersion').PowerShellVersion
Write-Host "PowerShell version: $pwver"

# Create run directory
New-Item -ItemType Directory "$RunDir" -ErrorAction SilentlyContinue | Out-Null

# Remove existing service
if (Get-Service docker -ErrorAction SilentlyContinue) {
  $dockerVersion = (docker version -f "{{.Server.Version}}")
  Write-Host "Current installed Docker version: $dockerVersion"
  # stop service
  Stop-Service -Force -Name docker
  Write-Host "Service stopped"
  # remove service
  sc.exe delete "docker"
  # removes event log entry. we could use "Remove-EventLog -LogName -Source docker"
  # but this cmd is not available atm
  $ErrorActionPreference = "SilentlyContinue"
  & reg delete "HKLM\\SYSTEM\\CurrentControlSet\\Services\\EventLog\\Application\\docker" /f 2>&1 | Out-Null
  $ErrorActionPreference = "Stop"
  Write-Host "Service removed"
}

$env:Path = "$ToolDir;" + [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Write-Host "Path: $env:Path"

$env:DOCKER_HOST = $DockerHostSocket
Write-Host "DOCKER_HOST: $env:DOCKER_HOST"

if ($DaemonConfig) {
  Write-Host "Writing Docker daemon config"
  New-Item -ItemType Directory -Force -Path "$env:ProgramData\\Docker\\config"
  $DaemonConfig | Out-File -FilePath "$env:ProgramData\\Docker\\config\\daemon.json"
}

$arguments = @(
  "--host=$DockerHostSocket",
  "--data-root=$RunDir\\\\moby-root",
  "--exec-root=$RunDir\\\\moby-exec",
  "--pidfile=$RunDir\\\\docker.pid",
  "--register-service"
)
if ($DockerHostTCP) {
  $arguments += "--host=$DockerHostTCP"
}

Write-Host "Creating service"
New-Item -ItemType Directory "$RunDir\\moby-root" -ErrorAction SilentlyContinue | Out-Null
New-Item -ItemType Directory "$RunDir\\moby-exec" -ErrorAction SilentlyContinue | Out-Null
Start-Process -Wait -NoNewWindow "$ToolDir\\dockerd" -ArgumentList $arguments
Write-Host "Starting service"
Start-Service -Name docker
Write-Host "Service started successfully!"

$tries=20
Write-Host "Waiting for Docker daemon to start..."
While ($true) {
  $ErrorActionPreference = "SilentlyContinue"
  & "$ToolDir\\docker" version | Out-Null
  $ErrorActionPreference = "Stop"
  If ($LastExitCode -eq 0) {
    break
  }
  $tries--
  If ($tries -le 0) {
    Throw "Failed to get a response from Docker daemon"
  }
  Write-Host -NoNewline "."
  Start-Sleep -Seconds 1
}
Write-Host "Docker daemon started successfully!"
`;
exports.dockerServiceLogsPs1Data = `
Get-WinEvent -ea SilentlyContinue \`
  -FilterHashtable @{ProviderName= "docker"; LogName = "application"} |
    Sort-Object @{Expression="TimeCreated";Descending=$false} |
    ForEach-Object {"$($_.TimeCreated.ToUniversalTime().ToString("o")) [$($_.LevelDisplayName)] $($_.Message)"}
`;
exports.limaYamlData = `
# Source:
# - https://github.com/lima-vm/lima/blob/master/templates/docker-rootful.yaml
# - https://github.com/lima-vm/lima/blob/master/templates/_images/ubuntu-lts.yaml
# - https://github.com/lima-vm/lima/blob/master/templates/_images/ubuntu-24.04.yaml

# VM type: "qemu" or "vz" (on macOS 13 and later).
# The vmType can be specified only on creating the instance.
# The vmType of existing instances cannot be changed.
# Builtin default: "qemu"
vmType: qemu

# OS: "Linux".
# Builtin default: "Linux"
os: null

# Arch: "default", "x86_64", "aarch64".
# Builtin default: "default" (corresponds to the host architecture)
arch: null

images:
{{#each customImages}}
- location: "{{location}}"
  arch: "{{arch}}"
  digest: "{{digest}}"
{{/each}}
- location: "https://cloud-images.ubuntu.com/releases/noble/release-20250704/ubuntu-24.04-server-cloudimg-amd64.img"
  arch: "x86_64"
  digest: "sha256:f1652d29d497fb7c623433705c9fca6525d1311b11294a0f495eed55c7639d1f"
  kernel:
    location: "https://cloud-images.ubuntu.com/releases/noble/release-20250704/unpacked/ubuntu-24.04-server-cloudimg-amd64-vmlinuz-generic"
    digest: "sha256:67cd9af083515de2101de032b49a64fc4b65778e5383df6ef21cf788a3f4688e"
    cmdline: "root=LABEL=cloudimg-rootfs ro console=tty1 console=ttyAMA0 no_timer_check"
  initrd:
    location: "https://cloud-images.ubuntu.com/releases/noble/release-20250704/unpacked/ubuntu-24.04-server-cloudimg-amd64-initrd-generic"
    digest: "sha256:f257d581c44f66da2d80c7c5dc3fa598ce76ef313d6e27b368683e8030a9e8fd"
- location: "https://cloud-images.ubuntu.com/releases/noble/release-20250704/ubuntu-24.04-server-cloudimg-arm64.img"
  arch: "aarch64"
  digest: "sha256:bbecbb88100ee65497927ed0da247ba15af576a8855004182cf3c87265e25d35"
# Fallback to the latest release image.
# Hint: run \`limactl prune\` to invalidate the cache
- location: https://cloud-images.ubuntu.com/releases/noble/release/ubuntu-24.04-server-cloudimg-amd64.img
  arch: "x86_64"
- location: https://cloud-images.ubuntu.com/releases/noble/release/ubuntu-24.04-server-cloudimg-arm64.img
  arch: "aarch64"

# CPUs
# Builtin default: min(4, host CPU cores)
cpus: null

# Memory size
# Builtin default: min("4GiB", half of host memory)
memory: null

# Disk size
# Builtin default: "100GiB"
disk: 60GiB

# Expose host directories to the guest, the mount point might be accessible from all UIDs in the guest
# Builtin default: null (Mount nothing)
# This file: Mount the home as read-only, /tmp/lima as writable
mounts:
- location: "~"
- location: "/tmp/lima"
  writable: true

# Mount type for above mounts, such as "reverse-sshfs" (from sshocker), "9p" (EXPERIMENTAL, from QEMU’s virtio-9p-pci, aka virtfs),
# or "virtiofs" (EXPERIMENTAL, needs \`vmType: vz\`)
# Builtin default: "reverse-sshfs" (for QEMU), "virtiofs" (for vz)
mountType: null

containerd:
  system: false
  user: false

provision:
- mode: system
  # This script defines the host.docker.internal hostname when hostResolver is disabled.
  # It is also needed for lima 0.8.2 and earlier, which does not support hostResolver.hosts.
  # Names defined in /etc/hosts inside the VM are not resolved inside containers when
  # using the hostResolver; use hostResolver.hosts instead (requires lima 0.8.3 or later).
  script: |
    #!/bin/sh
    sed -i 's/host.lima.internal.*/host.lima.internal host.docker.internal/' /etc/hosts
- mode: system
  script: |
    #!/bin/sh
    apt-get install -f -y iptables
- mode: system
  script: |
    #!/bin/bash
    set -eux -o pipefail
    command -v docker >/dev/null 2>&1 && exit 0
    if [ ! -e /etc/systemd/system/docker.socket.d/override.conf ]; then
      mkdir -p /etc/systemd/system/docker.socket.d
      # Alternatively we could just add the user to the "docker" group, but that requires restarting the user session
      cat <<-EOF >/etc/systemd/system/docker.socket.d/override.conf
      [Socket]
      SocketUser=\${LIMA_CIDATA_USER}
    EOF
    fi
    if [ ! -e /etc/docker/daemon.json ]; then
      mkdir -p /etc/docker
      cat <<-EOF >/etc/docker/daemon.json
      {{stringify daemonConfig}}
    EOF
    fi
    export DEBIAN_FRONTEND=noninteractive
    if [ "{{srcType}}" == "archive" ]; then
      curl -fsSL https://get.docker.com | sh -s -- --channel {{srcArchiveChannel}} --version {{srcArchiveVersion}}
      sed -i 's|^ExecStart=.*|ExecStart=/usr/bin/dockerd -H fd://{{#if localTCPPort}} -H tcp://0.0.0.0:2375{{/if}} --containerd=/run/containerd/containerd.sock|' /usr/lib/systemd/system/docker.service
      systemctl daemon-reload
      systemctl restart docker
      systemctl status docker.socket || true
      systemctl status docker.service || true
    elif [ "{{srcType}}" == "image" ]; then
      arch=$(uname -m)
      case $arch in
        x86_64) arch=amd64;;
        aarch64) arch=arm64;;
      esac
      url="https://github.com/crazy-max/undock/releases/download/v0.10.0/undock_0.10.0_linux_$arch.tar.gz"

      wget "$url" -O /tmp/undock.tar.gz
      tar -C /usr/local/bin -xvf /tmp/undock.tar.gz
      undock --version

      HOME=/tmp undock moby/moby-bin:{{srcImageTag}} /usr/local/bin

      wget https://raw.githubusercontent.com/moby/moby/{{gitCommit}}/contrib/init/systemd/docker.service \
        -O /etc/systemd/system/docker.service
      wget https://raw.githubusercontent.com/moby/moby/{{gitCommit}}/contrib/init/systemd/docker.socket \
        -O /etc/systemd/system/docker.socket

      sed -i 's|^ExecStart=.*|ExecStart=/usr/local/bin/dockerd -H fd://{{#if localTCPPort}} -H tcp://0.0.0.0:2375{{/if}}|' /etc/systemd/system/docker.service
      sed -i 's|containerd.service||' /etc/systemd/system/docker.service
      if ! getent group docker; then
        groupadd --system docker
      fi
      systemctl daemon-reload
      fail=0
      if ! systemctl enable --now docker; then
        fail=1
      fi
      systemctl status docker.socket || true
      systemctl status docker.service || true
      exit $fail
    fi

probes:
- script: |
    #!/bin/bash
    set -eux -o pipefail
    # Don't check for docker CLI as it's not installed in the VM (only on the host)
    if ! timeout 30s bash -c "until pgrep dockerd; do sleep 3; done"; then
      echo >&2 "dockerd is not running"
      exit 1
    fi
  hint: See "/var/log/cloud-init-output.log". in the guest

hostResolver:
  # hostResolver.hosts requires lima 0.8.3 or later. Names defined here will also
  # resolve inside containers, and not just inside the VM itself.
  hosts:
    host.docker.internal: host.lima.internal

portForwards:
- guestSocket: "/var/run/docker.sock"
  hostSocket: "{{dockerSock}}"
{{#if localTCPPort}}
- guestPort: 2375
  hostPort: {{localTCPPort}}
{{/if}}

audio:
  # EXPERIMENTAL
  # QEMU audiodev, e.g., "none", "coreaudio", "pa", "alsa", "oss".
  # VZ driver, use "vz" as device name
  # Choosing "none" will mute the audio output, and not play any sound.
  # Builtin default: ""
  device: none
`;
//# sourceMappingURL=assets.js.map