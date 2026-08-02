# PFM AI App - Setup Script

# Run: .\setup.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PFM AI App - Windows Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── CHECK PYTHON ─────────────────────────────────────────────
Write-Host "[Checking] Python..." -ForegroundColor Yellow

$pythonCmd = $null
foreach ($cmd in @("python3", "python", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match "Python 3\.(1[0-9]|[89])") {
            $pythonCmd = $cmd
            Write-Host "  Python found: $ver" -ForegroundColor Green
            break
        }
    } catch {}
}

if (-not $pythonCmd) {
    Write-Host ""
    Write-Host "  ERROR: Python 3.10+ is NOT installed or not in PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "  HOW TO FIX:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://www.python.org/downloads/" -ForegroundColor White
    Write-Host "  2. Download Python 3.11 (Windows Installer)" -ForegroundColor White
    Write-Host "  3. Run installer" -ForegroundColor White
    Write-Host "  4. IMPORTANT: Check the box:" -ForegroundColor White
    Write-Host '     [x] Add Python to PATH' -ForegroundColor Cyan
    Write-Host "  5. Click Install Now" -ForegroundColor White
    Write-Host "  6. Close PowerShell and open a NEW window" -ForegroundColor White
    Write-Host "  7. Run .\setup.ps1 again" -ForegroundColor White
    Write-Host ""
    Write-Host "  Opening Python download page..." -ForegroundColor Gray
    Start-Process "https://www.python.org/downloads/"
    Read-Host "Press Enter to exit"
    exit 1
}

# ── CHECK NODE.JS ─────────────────────────────────────────────
Write-Host "[Checking] Node.js / npm..." -ForegroundColor Yellow

$nodeAvailable = $null -ne (Get-Command node -ErrorAction SilentlyContinue)
$npmAvailable  = $null -ne (Get-Command npm  -ErrorAction SilentlyContinue)

if (-not $nodeAvailable -or -not $npmAvailable) {
    Write-Host ""
    Write-Host "  ERROR: Node.js is NOT installed or not in PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "  HOW TO FIX:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://nodejs.org/en/download" -ForegroundColor White
    Write-Host "  2. Download LTS version (Windows .msi installer)" -ForegroundColor White
    Write-Host "  3. Run installer, click Next through all steps" -ForegroundColor White
    Write-Host "  4. Close PowerShell and open a NEW window" -ForegroundColor White
    Write-Host "  5. Run .\setup.ps1 again" -ForegroundColor White
    Write-Host ""
    Write-Host "  Opening Node.js download page..." -ForegroundColor Gray
    Start-Process "https://nodejs.org/en/download"
    Read-Host "Press Enter to exit"
    exit 1
} else {
    Write-Host "  Node.js: $(node --version)" -ForegroundColor Green
    Write-Host "  npm:     v$(npm --version)" -ForegroundColor Green
}

# ── CHECK DOCKER (optional) ──────────────────────────────────
Write-Host "[Checking] Docker (optional)..." -ForegroundColor Yellow
$dockerAvailable = $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
if ($dockerAvailable) {
    Write-Host "  Docker found" -ForegroundColor Green
} else {
    Write-Host "  Docker not found - OK, will run without it" -ForegroundColor Gray
    Write-Host "  (Install Docker Desktop later for easier database setup)" -ForegroundColor Gray
}

Write-Host ""

# ── CREATE .ENV FILES ─────────────────────────────────────────
Write-Host "[1/4] Creating .env files..." -ForegroundColor Yellow

if (-not (Test-Path "backend\.env")) {
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "  Created backend\.env" -ForegroundColor Green
} else {
    Write-Host "  backend\.env already exists" -ForegroundColor Gray
}

if (-not (Test-Path "frontend\.env")) {
    Copy-Item "frontend\.env.example" "frontend\.env"
    Write-Host "  Created frontend\.env" -ForegroundColor Green
} else {
    Write-Host "  frontend\.env already exists" -ForegroundColor Gray
}

# ── BACKEND SETUP ─────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] Setting up Backend (Python)..." -ForegroundColor Yellow

Set-Location backend

$venvValid = $false
if (Test-Path "venv\Scripts\python.exe") {
    try {
        $testPy = & ".\venv\Scripts\python.exe" --version 2>&1
        if ($LASTEXITCODE -eq 0 -and $testPy -match "^Python 3\.") { $venvValid = $true }
    } catch {}
}

if (-not $venvValid) {
    if (Test-Path "venv") {
        Write-Host "  Existing virtual environment is broken, recreating..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force "venv"
    } else {
        Write-Host "  Creating virtual environment..." -ForegroundColor Gray
    }
    & $pythonCmd -m venv venv
    if (-not (Test-Path "venv\Scripts\Activate.ps1")) {
        Write-Host "  ERROR: Failed to create venv. Try: python -m venv venv" -ForegroundColor Red
        Set-Location ..
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "  Virtual environment created" -ForegroundColor Green
} else {
    Write-Host "  Virtual environment already exists" -ForegroundColor Gray
}

Write-Host "  Installing Python packages (2-5 minutes)..." -ForegroundColor Gray
& ".\venv\Scripts\pip.exe" install -r requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: pip install failed." -ForegroundColor Red
    Write-Host "  Try manually: cd backend && .\venv\Scripts\Activate.ps1 && pip install -r requirements.txt" -ForegroundColor Yellow
    Set-Location ..
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "  Python packages installed" -ForegroundColor Green
Set-Location ..

# ── FRONTEND SETUP ────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Setting up Frontend (Node.js)..." -ForegroundColor Yellow

Set-Location frontend
Write-Host "  Installing npm packages (1-2 minutes)..." -ForegroundColor Gray
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: npm install failed." -ForegroundColor Red
    Set-Location ..
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "  npm packages installed" -ForegroundColor Green
Set-Location ..

# ── DONE ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

if ($dockerAvailable) {
    Write-Host "  OPTION A - Docker (recommended):" -ForegroundColor Cyan
    Write-Host "    docker-compose up --build" -ForegroundColor White
    Write-Host ""
}

Write-Host "  OPTION B - Run locally (open 2 terminals):" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Terminal 1 - Backend:" -ForegroundColor Yellow
Write-Host "    cd backend" -ForegroundColor White
Write-Host "    .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "    uvicorn app.main:app --reload --port 8000" -ForegroundColor White
Write-Host ""
Write-Host "  Terminal 2 - Frontend:" -ForegroundColor Yellow
Write-Host "    cd frontend" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  Then open: http://localhost:5173" -ForegroundColor Green
Write-Host "  API Docs:  http://localhost:8000/docs" -ForegroundColor Green
Write-Host "  Login:     demo@pfm.com / Demo@1234" -ForegroundColor Yellow
Write-Host ""
Write-Host "  NOTE: Backend needs PostgreSQL + Redis." -ForegroundColor Gray
Write-Host "  Easiest: install Docker Desktop then run:" -ForegroundColor Gray
Write-Host "    docker-compose up postgres redis -d" -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to close"
