Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path "$repoRoot\backend\.venv\Scripts\python.exe")) {
    throw "backend/.venv is missing. Run scripts/install.ps1 first."
}

& "$repoRoot\backend\.venv\Scripts\python.exe" backend/main.py
