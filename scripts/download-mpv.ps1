# Download mpv sidecar for the current (or specified) Rust target triple.
# Usage: .\scripts\download-mpv.ps1 [-Target x86_64-pc-windows-msvc]
param(
  [string]$Target = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$binDir = Join-Path $root "src-tauri\bin"
New-Item -ItemType Directory -Path $binDir -Force | Out-Null

if (-not $Target) {
  $env:PATH = "$env:USERPROFILE\.cargo\bin;" + $env:PATH
  if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
    throw "rustc not found. Pass -Target explicitly or install Rust."
  }
  $Target = (rustc -vV | Select-String "host:").ToString().Split(":")[1].Trim()
}

$dest = Join-Path $binDir "mpv-$Target$(if ($Target -like '*windows*') { '.exe' } else { '' })"
if (Test-Path $dest) {
  Write-Host "mpv sidecar already present: $dest"
  return
}

$tmp = Join-Path $env:TEMP "vauldy-mpv-$Target"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

function Get-7zr {
  $local = Join-Path $tmp "7zr.exe"
  if (-not (Test-Path $local)) {
    curl.exe -L -o $local "https://www.7-zip.org/a/7zr.exe"
  }
  return $local
}

switch -Wildcard ($Target) {
  "*windows*" {
    $archive = Join-Path $tmp "mpv.7z"
    $url = "https://ghfast.top/https://github.com/zhongfly/mpv-winbuild/releases/download/2026-07-11-e5486b96d7/mpv-x86_64-20260711-git-e5486b96d7.7z"
    Write-Host "Downloading Windows mpv..."
    curl.exe -L --retry 3 -o $archive $url
    & (Get-7zr) x $archive "-o$tmp\extracted" -y | Out-Null
    $mpv = Get-ChildItem "$tmp\extracted" -Recurse -Filter "mpv.exe" | Select-Object -First 1
    if (-not $mpv) { throw "mpv.exe not found in archive" }
    Copy-Item $mpv.FullName $dest -Force
  }
  "*linux*" {
    throw "Linux mpv sidecar must be built on Linux (see .github/workflows/desktop-build.yml)."
  }
  "*darwin*" {
    throw "macOS mpv sidecar must be built on macOS (see .github/workflows/desktop-build.yml)."
  }
  default {
    throw "Unsupported target: $Target"
  }
}

Write-Host "Installed mpv sidecar: $dest ($([math]::Round((Get-Item $dest).Length / 1MB, 2)) MB)"
