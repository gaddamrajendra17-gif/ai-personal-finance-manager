# PFM AI - Windows PowerShell Cheatsheet
# Keep this open while developing!

# ============================================================
# FIRST TIME SETUP
# ============================================================

# Allow PowerShell scripts (run ONCE as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run full setup
.\setup.ps1                    # With Docker
.\setup.ps1 -Local             # Without Docker


# ============================================================
# DAILY DEVELOPMENT (No Docker)
# ============================================================

# --- Backend (Terminal 1) ---
cd backend
.\venv\Scripts\Activate.ps1             # Activate Python venv
uvicorn app.main:app --reload --port 8000

# --- Frontend (Terminal 2) ---
cd frontend
npm run dev

# --- Stop servers ---
Ctrl+C                                  # Stop any running server


# ============================================================
# DOCKER COMMANDS
# ============================================================

docker-compose up --build               # Start all (first time)
docker-compose up -d                    # Start all (background)
docker-compose down                     # Stop all
docker-compose down -v                  # Stop + delete data
docker-compose logs -f backend          # View backend logs
docker-compose logs -f frontend         # View frontend logs
docker-compose ps                       # Check running services


# ============================================================
# PYTHON / BACKEND
# ============================================================

# Activate venv (always do this first in backend folder)
cd backend
.\venv\Scripts\Activate.ps1

# Deactivate venv
deactivate

# Install a new package
pip install package-name
pip freeze > requirements.txt           # Save to requirements

# Run database migrations (if using Alembic)
alembic upgrade head

# Train ML model
cd backend
.\venv\Scripts\Activate.ps1
$env:PYTHONPATH = "."
python ..\ml\training\train_categorizer.py


# ============================================================
# NODE / FRONTEND
# ============================================================

cd frontend
npm install                             # Install all packages
npm run dev                             # Start dev server
npm run build                           # Build for production
npm install package-name                # Add a new package


# ============================================================
# DATABASE (PostgreSQL via Docker)
# ============================================================

# Connect to DB (via pgAdmin at http://localhost:5050)
# Or via PowerShell:
docker exec -it pfm_postgres psql -U pfm_user -d pfm_db

# Common SQL
\dt                                     # List all tables
\d transactions                         # Describe table
SELECT * FROM users LIMIT 5;
SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 10;


# ============================================================
# USEFUL URLS
# ============================================================

# http://localhost:5173         Frontend
# http://localhost:8000         Backend API
# http://localhost:8000/docs    Swagger API Docs (interactive!)
# http://localhost:8000/redoc   ReDoc API Docs
# http://localhost:5050         pgAdmin (DB GUI)

# Demo login: demo@pfm.com / Demo@1234


# ============================================================
# TROUBLESHOOTING
# ============================================================

# "uvicorn not found"
.\venv\Scripts\Activate.ps1             # Activate venv first!

# "Module not found" in Python
$env:PYTHONPATH = "."                   # Set Python path

# "npm not found"
# Install Node.js from https://nodejs.org

# Port already in use
netstat -ano | findstr :8000            # Find process using port
taskkill /PID <PID> /F                  # Kill the process

# Docker "port already in use"
Stop-Service postgresql* -ErrorAction SilentlyContinue

# Reset everything
docker-compose down -v                  # Wipe all Docker data
Remove-Item -Recurse backend\venv       # Remove Python venv
Remove-Item -Recurse frontend\node_modules  # Remove node_modules
.\setup.ps1 -Local                      # Start fresh
