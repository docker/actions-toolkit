[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ToolDir,

    [Parameter(Mandatory = $true)]
    [string]$RunDir,

    [Parameter(Mandatory = $true)]
    [string]$DockerHost)

$pwver = (Get-ItemProperty -Path HKLM:\SOFTWARE\Microsoft\PowerShell\3\PowerShellEngine -Name 'PowerShellVersion').PowerShellVersion
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
  & reg delete "HKLM\SYSTEM\CurrentControlSet\Services\EventLog\Application\docker" /f 2>&1 | Out-Null
  $ErrorActionPreference = "Stop"
  Write-Host "Service removed"
}

$env:DOCKER_HOST = $DockerHost
Write-Host "DOCKER_HOST: $env:DOCKER_HOST"

Write-Host "Creating service"
New-Item -ItemType Directory "$RunDir\moby-root" -ErrorAction SilentlyContinue | Out-Null
New-Item -ItemType Directory "$RunDir\moby-exec" -ErrorAction SilentlyContinue | Out-Null
Start-Process -Wait -NoNewWindow "$ToolDir\dockerd" `
  -ArgumentList `
    "--host=$DockerHost", `
    "--data-root=$RunDir\moby-root", `
    "--exec-root=$RunDir\moby-exec", `
    "--pidfile=$RunDir\docker.pid", `
    "--register-service"
Write-Host "Starting service"
Start-Service -Name docker
Write-Host "Service started successfully!"

$tries=20
Write-Host "Waiting for Docker daemon to start..."
While ($true) {
  $ErrorActionPreference = "SilentlyContinue"
  & "$ToolDir\docker" version | Out-Null
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

Get-WinEvent -ea SilentlyContinue `
  -FilterHashtable @{ProviderName= "docker"; LogName = "application"} |
    Sort-Object @{Expression="TimeCreated";Descending=$false} |
    ForEach-Object {"$($_.TimeCreated.ToUniversalTime().ToString("o")) [$($_.LevelDisplayName)] $($_.Message)"}
