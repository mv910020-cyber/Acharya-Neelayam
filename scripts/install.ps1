Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Installing frontend dependencies..."
npm install --prefix frontend

Write-Host "Creating backend virtual environment..."
python -m venv backend/.venv

Write-Host "Installing backend dependencies..."
& "$repoRoot\backend\.venv\Scripts\python.exe" -m pip install -r backend/requirements.txt

Write-Host "Install complete."
