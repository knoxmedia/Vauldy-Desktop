# Build Vauldy Desktop installers/binaries for the current host platform.
# Cross-platform matrix builds run in GitHub Actions (.github/workflows/desktop-build.yml).
# Outputs: dist/desktop/<target-triple>/
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$env:PATH = "$env:USERPROFILE\.cargo\bin;" + $env:PATH

if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
  throw "Rust is required. Install from https://rustup.rs/ then re-run this script."
}

Write-Host "Toolchain: $(rustc --version)"
& "$root\scripts\download-mpv.ps1"

if (-not (Test-Path "src-tauri/icons/icon.ico")) {
  Write-Host "Generating app icons..."
  npm run tauri -- icon src-tauri/icons/256x256.png
}

npm install
npx tauri build

$hostTriple = (rustc -vV | Select-String "host:").ToString().Split(":")[1].Trim()
$distRoot = Join-Path $root "dist/desktop/$hostTriple"
if (Test-Path $distRoot) { Remove-Item $distRoot -Recurse -Force }
New-Item -ItemType Directory -Path $distRoot -Force | Out-Null

$releaseDir = Join-Path $root "src-tauri/target/release"
Copy-Item (Join-Path $releaseDir "vauldy-desktop.exe") $distRoot -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $releaseDir "vauldy-desktop") $distRoot -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $releaseDir "mpv.exe") $distRoot -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $releaseDir "mpv") $distRoot -Force -ErrorAction SilentlyContinue

$bundleRoot = Join-Path $root "src-tauri/target/release/bundle"
if (Test-Path $bundleRoot) {
  Get-ChildItem $bundleRoot -Recurse -File | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $distRoot $_.Name) -Force
  }
}

Write-Host ""
Write-Host "Build complete. Artifacts in $distRoot :"
Get-ChildItem $distRoot | ForEach-Object {
  Write-Host ("  {0}  ({1:N2} MB)" -f $_.Name, ($_.Length / 1MB))
}
