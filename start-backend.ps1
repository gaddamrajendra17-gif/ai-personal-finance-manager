# PFM AI App - Start Backend Script

# Run: .\start-backend.ps1

Write-Host "Starting PFM Backend..." -ForegroundColor Cyan

Set-Location $PSScriptRoot\backend

$pyCmd = ".\venv\Scripts\python.exe"
if (-not (Test-Path $pyCmd)) {
    $pyCmd = "python"
}

Write-Host "Backend running at http://localhost:8000" -ForegroundColor Green
Write-Host "API Docs at http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""

& $pyCmd -m uvicorn app.main:app --reload --port 8000

