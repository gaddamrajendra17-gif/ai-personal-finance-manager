# PFM AI App - Train ML Model Script

# Run: .\train-model.ps1

Write-Host "Training Expense Categorizer Model..." -ForegroundColor Cyan

Set-Location $PSScriptRoot\backend

if (Test-Path "venv\Scripts\Activate.ps1") {
    & ".\venv\Scripts\Activate.ps1"
} else {
    Write-Host "Virtual env not found. Run .\setup.ps1 first." -ForegroundColor Red
    exit 1
}

Set-Location $PSScriptRoot
$env:PYTHONPATH = "$PSScriptRoot\backend"
python ml\training\train_categorizer.py

Write-Host ""
Write-Host "Model saved to ml\models\categorizer.pkl" -ForegroundColor Green
