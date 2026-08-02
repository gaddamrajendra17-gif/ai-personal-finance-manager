# PFM AI App - Windows PowerShell Edition

Full-stack AI Personal Finance Manager for Windows.

## Prerequisites
- Python 3.11+  : https://python.org/downloads  (check "Add to PATH")
- Node.js 18+   : https://nodejs.org
- Docker Desktop: https://docker.com/products/docker-desktop
- VS Code       : https://code.visualstudio.com

## Quick Start

### Step 1 - Allow PowerShell scripts
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Step 2 - Setup & Run (Docker)
```powershell
.\setup.ps1
```

### Step 2 - Setup & Run (No Docker)
```powershell
.\setup.ps1 -Local
```

Then open two PowerShell terminals:

Terminal 1:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Terminal 2:
```powershell
cd frontend
npm run dev
```

## URLs
- Frontend : http://localhost:5173
- API Docs : http://localhost:8000/docs
- pgAdmin  : http://localhost:5050
- Architecture Details: [docs/architecture.md](file:///c:/Users/HP/Downloads/pfm-app-win/pfm-app-win/docs/architecture.md)
- AI Categorizer Specs: [docs/transaction_categorization.md](file:///c:/Users/HP/Downloads/pfm-app-win/pfm-app-win/docs/transaction_categorization.md)
- Predictive Forecasting Specs: [docs/predictive_forecasting.md](file:///c:/Users/HP/Downloads/pfm-app-win/pfm-app-win/docs/predictive_forecasting.md)
- Safe-to-Save Safety Specs: [docs/safe_to_save_rules.md](file:///c:/Users/HP/Downloads/pfm-app-win/pfm-app-win/docs/safe_to_save_rules.md)

## Demo Login
- Email    : demo@pfm.com
- Password : Demo@1234

## Enable AI Chatbot
Edit backend\.env and add:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```
Get key from: https://console.anthropic.com

## VS Code
Open pfm-app.code-workspace, then Ctrl+Shift+P > "Tasks: Run Task"
to start backend, frontend, Docker, or train ML model.

## Common Fixes

"scripts disabled" error:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Python not found:
- Reinstall Python, check "Add Python to PATH"

Docker not starting:
- Open Docker Desktop from Start menu first
