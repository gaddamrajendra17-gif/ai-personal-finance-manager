# 💎 AI Personal Finance Manager

A full-stack, AI-powered Personal Finance Management (PFM) system built with **FastAPI**, **React (Vite)**, **Tailwind CSS**, and **Machine Learning**.

![Python](https://img.shields.io/badge/Python-3.12-blue?style=flat&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-1.0-009688?style=flat&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat&logo=tailwindcss)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat&logo=postgresql)
![Status](https://img.shields.io/badge/Status-Active-success)

---

## ✨ Features

- 📊 **Interactive Analytics Dashboard**: Real-time spending breakdowns, net worth tracking, and cash flow visualizer.
- 🤖 **AI Financial Advisor**: Intelligent chatbot powered by LLMs for personalized budget insights and financial strategy.
- 🔮 **Predictive Expense Forecasting**: Machine learning models predicting 30-day category spending and anomaly alerts.
- 📈 **Trading & Backtesting Suite**: Historical quantitative trading simulation with SMA, RSI, and Momentum indicators.
- 💡 **Smart Budgeting & Goals**: Category budget allocation, visual progress meters, and target savings goal tracker.
- 🔒 **Secure Authentication**: JWT token authentication with bcrypt password hashing.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Zustand, WebSocket |
| **Backend** | FastAPI, Python 3.12, PostgreSQL, SQLAlchemy |
| **Face & OCR Model** | Tesseract OCR, OpenCV, PyTorch |
| **Voice Model** | Librosa, Pyin, MFCC Audio Processing |
| **Recommendation Engine** | Scikit-Learn, DistilBERT, Financial API Integrations |
| **Deployment** | Docker, Nginx, PowerShell Scripts |

---

## 📁 Project Folder Structure

```text
ai-personal-finance-manager/
├── backend/                  # FastAPI Python Backend
│   ├── app/
│   │   ├── ai/              # AI Agents, Chatbot, OCR & ML Predictors
│   │   ├── api/             # REST API Routers (Auth, Transactions, Budgets, Trading, etc.)
│   │   ├── core/            # Database Config, Security (JWT/Bcrypt), Redis Setup
│   │   ├── models/          # SQLAlchemy Database Models (User, Account, Budget, Transaction)
│   │   ├── schemas/         # Pydantic Request/Response Schemas
│   │   ├── services/        # Business Logic Services & Financial Simulations
│   │   └── main.py          # FastAPI Application Entry Point
│   ├── tests/               # Backend Pytest Test Suite
│   └── requirements.txt     # Python Dependencies
├── frontend/                 # React (Vite) Frontend Application
│   ├── src/
│   │   ├── components/      # UI Layouts, Toast Notifications & Modals
│   │   ├── hooks/           # Custom React Hooks (Real-Time WebSockets)
│   │   ├── pages/           # Application Views (Dashboard, Budget, Trading, Chatbot)
│   │   ├── services/        # Axios API Client Integration
│   │   └── store/           # Zustand State Management (Auth, User State)
│   ├── package.json         # Frontend Node Dependencies
│   └── vite.config.js       # Vite Build & Dev Server Configuration
├── docker/                   # Docker Containerization Configurations
│   ├── Dockerfile.backend
│   └── Dockerfile.frontend
├── docs/                     # Technical Architecture & API Documentation
├── ml/                       # Machine Learning Training Pipelines & Models
├── docker-compose.yml        # Docker Multi-Container Orchestration
├── setup.ps1                 # Automated Windows PowerShell Setup Script
├── start-backend.ps1         # One-click Backend Start Script
└── start-frontend.ps1        # One-click Frontend Start Script
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Python 3.10+](https://python.org/downloads)
- [Node.js 18+](https://nodejs.org)

### 1. Start Backend Server
```powershell
cd backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```
*(Runs on http://localhost:8000 - API Documentation: http://localhost:8000/docs)*

### 2. Start Frontend App
```powershell
cd frontend
npm run dev
```
*(Runs on http://localhost:5173)*

---

## 🔑 Demo Account
- **Email**: `demo@pfm.com`
- **Password**: `Demo@1234`

---

## 👨‍💻 Author

- **Name**: Gaddam Rajendra
- **Department**: Department of Artificial Intelligence and Machine Learning
- **Institution**: Dhanalakshmi Srinivasan University — Batch 2023–2027
