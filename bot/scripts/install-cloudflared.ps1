$ErrorActionPreference = 'Stop'
$botDir = Split-Path -Parent $PSScriptRoot
$target = Join-Path $botDir 'node_modules\.cache\cloudflared.exe'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
if (-not (Test-Path -LiteralPath $target)) {
  Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $target
}
& $target --version
