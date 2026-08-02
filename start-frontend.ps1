# Start Frontend - PowerShell
# Run: .\start-frontend.ps1

Write-Host "Starting PFM Frontend..." -ForegroundColor Cyan

Set-Location $PSScriptRoot\frontend

if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules not found. Running npm install..." -ForegroundColor Yellow
    npm install
}

Write-Host "Frontend running at http://localhost:5173" -ForegroundColor Green
Write-Host ""
npm run dev
