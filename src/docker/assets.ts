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

import fs from 'fs';
import {Context} from '../context';

export const setupDockerLinuxSh = (): string => {
  return get('docker-setup-linux.sh', setupDockerLinuxShData, '0755');
};

export const setupDockerWinPs1 = (): string => {
  return get('docker-setup-win.ps1', setupDockerWinPs1Data);
};

export const colimaYaml = (): string => {
  return get('colima.yaml', colimaYamlData);
};

const get = (filename: string, data: string, mode?: string): string => {
  const assetPath = Context.tmpName({
    template: `docker-asset-XXXXXX-${filename}`,
    tmpdir: Context.tmpDir()
  });
  fs.writeFileSync(assetPath, data);
  if (mode) {
    fs.chmodSync(assetPath, mode);
  }
  return assetPath;
};

export const setupDockerLinuxShData = `
#!/usr/bin/env bash

set -eu

: "\${TOOLDIR=}"
: "\${RUNDIR=}"
: "\${DOCKER_HOST=}"

export PATH="$TOOLDIR::$PATH"

if [ -z "$DOCKER_HOST" ]; then
  echo >&2 'error: DOCKER_HOST required'
  false
fi

if ! command -v dockerd &> /dev/null; then
  echo >&2 'error: dockerd missing from PATH'
  false
fi

mkdir -p "$RUNDIR"

(
  echo "Starting dockerd"
  set -x
  exec dockerd \\
    --host="$DOCKER_HOST" \\
    --exec-root="$RUNDIR/execroot" \\
    --data-root="$RUNDIR/data" \\
    --pidfile="$RUNDIR/docker.pid" \\
    --userland-proxy=false \\
    2>&1 | tee "$RUNDIR/dockerd.log"
) &
`;

export const setupDockerWinPs1Data = `
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ToolDir,

    [Parameter(Mandatory = $true)]
    [string]$RunDir,

    [Parameter(Mandatory = $true)]
    [string]$DockerHost)

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

$env:DOCKER_HOST = $DockerHost
Write-Host "DOCKER_HOST: $env:DOCKER_HOST"

Write-Host "Creating service"
New-Item -ItemType Directory "$RunDir\\moby-root" -ErrorAction SilentlyContinue | Out-Null
New-Item -ItemType Directory "$RunDir\\moby-exec" -ErrorAction SilentlyContinue | Out-Null
Start-Process -Wait -NoNewWindow "$ToolDir\\dockerd" \`
  -ArgumentList \`
    "--host=$DockerHost", \`
    "--data-root=$RunDir\\moby-root", \`
    "--exec-root=$RunDir\\moby-exec", \`
    "--pidfile=$RunDir\\docker.pid", \`
    "--register-service"
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

Get-WinEvent -ea SilentlyContinue \`
  -FilterHashtable @{ProviderName= "docker"; LogName = "application"} |
    Sort-Object @{Expression="TimeCreated";Descending=$false} |
    ForEach-Object {"$($_.TimeCreated.ToUniversalTime().ToString("o")) [$($_.LevelDisplayName)] $($_.Message)"}
`;

export const colimaYamlData = `
# Number of CPUs to be allocated to the virtual machine.
# Default: 2
cpu: 2

# Size of the disk in GiB to be allocated to the virtual machine.
# NOTE: changing this has no effect after the virtual machine has been created.
# Default: 60
disk: 60

# Size of the memory in GiB to be allocated to the virtual machine.
# Default: 2
memory: 2

# Architecture of the virtual machine (x86_64, aarch64, host).
# Default: host
arch: host

# Container runtime to be used (docker, containerd).
# Default: docker
runtime: docker

# Kubernetes configuration for the virtual machine.
kubernetes:
  enabled: false

# Auto-activate on the Host for client access.
# Setting to true does the following on startup
#  - sets as active Docker context (for Docker runtime).
#  - sets as active Kubernetes context (if Kubernetes is enabled).
# Default: true
autoActivate: false

# Network configurations for the virtual machine.
network:
  # Assign reachable IP address to the virtual machine.
  # NOTE: this is currently macOS only and ignored on Linux.
  # Default: false
  address: false

  # Custom DNS resolvers for the virtual machine.
  #
  # EXAMPLE
  # dns: [8.8.8.8, 1.1.1.1]
  #
  # Default: []
  dns: []

  # DNS hostnames to resolve to custom targets using the internal resolver.
  # This setting has no effect if a custom DNS resolver list is supplied above.
  # It does not configure the /etc/hosts files of any machine or container.
  # The value can be an IP address or another host.
  #
  # EXAMPLE
  # dnsHosts:
  #   example.com: 1.2.3.4
  dnsHosts:
    host.docker.internal: host.lima.internal

  # Network driver to use (slirp, gvproxy), (requires vmType \`qemu\`)
  #   - slirp is the default user mode networking provided by Qemu
  #   - gvproxy is an alternative to VPNKit based on gVisor https://github.com/containers/gvisor-tap-vsock
  # Default: gvproxy
  driver: gvproxy

# Forward the host's SSH agent to the virtual machine.
# Default: false
forwardAgent: false

# Docker daemon configuration that maps directly to daemon.json.
# https://docs.docker.com/engine/reference/commandline/dockerd/#daemon-configuration-file.
# NOTE: some settings may affect Colima's ability to start docker. e.g. \`hosts\`.
#
# EXAMPLE - disable buildkit
# docker:
#   features:
#     buildkit: false
#
# EXAMPLE - add insecure registries
# docker:
#   insecure-registries:
#     - myregistry.com:5000
#     - host.docker.internal:5000
#
# Colima default behaviour: buildkit enabled
# Default: {}
docker: {}

# Virtual Machine type (qemu, vz)
# NOTE: this is macOS 13 only. For Linux and macOS <13.0, qemu is always used.
#
# vz is macOS virtualization framework and requires macOS 13
#
# Default: qemu
vmType: qemu

# Volume mount driver for the virtual machine (virtiofs, 9p, sshfs).
#
# virtiofs is limited to macOS and vmType \`vz\`. It is the fastest of the options.
#
# 9p is the recommended and the most stable option for vmType \`qemu\`.
#
# sshfs is faster than 9p but the least reliable of the options (when there are lots
# of concurrent reads or writes).
#
# Default: virtiofs (for vz), sshfs (for qemu)
mountType: 9p

# The CPU type for the virtual machine (requires vmType \`qemu\`).
# Options available for host emulation can be checked with: \`qemu-system-$(arch) -cpu help\`.
# Instructions are also supported by appending to the cpu type e.g. "qemu64,+ssse3".
# Default: host
cpuType: host

# For a more general purpose virtual machine, Ubuntu container is optionally provided
# as a layer on the virtual machine.
# The underlying virtual machine is still accessible via \`colima ssh --layer=false\` or running \`colima\` in
# the Ubuntu session.
#
# Default: false
layer: false

# Custom provision scripts for the virtual machine.
# Provisioning scripts are executed on startup and therefore needs to be idempotent.
#
# EXAMPLE - script exected as root
# provision:
#   - mode: system
#     script: apk add htop vim
#
# EXAMPLE - script exected as user
# provision:
#   - mode: user
#     script: |
#       [ -f ~/.provision ] && exit 0;
#       echo provisioning as $USER...
#       touch ~/.provision
#
# Default: []
provision:
  - mode: system
    script: |
      mkdir -p /tmp/docker-bins
      cd /tmp/docker-bins
      wget -qO- "https://download.docker.com/linux/static/{{dockerChannel}}/{{hostArch}}/docker-{{dockerVersion}}.tgz" | tar xvz --strip 1
      mv -f /tmp/docker-bins/* /usr/bin/

# Modify ~/.ssh/config automatically to include a SSH config for the virtual machine.
# SSH config will still be generated in ~/.colima/ssh_config regardless.
# Default: true
sshConfig: false

# Configure volume mounts for the virtual machine.
# Colima mounts user's home directory by default to provide a familiar
# user experience.
#
# EXAMPLE
# mounts:
#   - location: ~/secrets
#     writable: false
#   - location: ~/projects
#     writable: true
#
# Colima default behaviour: $HOME and /tmp/colima are mounted as writable.
# Default: []
mounts: []

# Environment variables for the virtual machine.
#
# EXAMPLE
# env:
#   KEY: value
#   ANOTHER_KEY: another value
#
# Default: {}
env: {}
`;
