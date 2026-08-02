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

## 🛠️ Technology Stack

| Category | Technologies & Tools |
| :--- | :--- |
| **Frontend UI** | ![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black) ![Vite](https://img.shields.io/badge/Vite_5-646CFF?style=flat-square&logo=vite&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white) ![Recharts](https://img.shields.io/badge/Recharts-222222?style=flat-square) ![Zustand](https://img.shields.io/badge/Zustand-450?style=flat-square) |
| **Backend API** | ![Python](https://img.shields.io/badge/Python_3.12-3776AB?style=flat-square&logo=python&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white) ![Uvicorn](https://img.shields.io/badge/Uvicorn-499848?style=flat-square) ![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=flat-square) ![Pydantic](https://img.shields.io/badge/Pydantic_v2-E92063?style=flat-square) |
| **Database & Cache** | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL_15-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![SQLite](https://img.shields.io/badge/SQLite_Fallback-003B57?style=flat-square&logo=sqlite&logoColor=white) ![Redis](https://img.shields.io/badge/Redis_Cache-DC382D?style=flat-square&logo=redis&logoColor=white) |
| **AI & ML Engine** | ![OpenAI](https://img.shields.io/badge/OpenAI_GPT--4-412991?style=flat-square&logo=openai&logoColor=white) ![Claude](https://img.shields.io/badge/Anthropic_Claude-D97706?style=flat-square) ![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-F7931E?style=flat-square&logo=scikit-learn&logoColor=white) ![Pandas](https://img.shields.io/badge/Pandas-150458?style=flat-square&logo=pandas&logoColor=white) ![NumPy](https://img.shields.io/badge/NumPy-013243?style=flat-square&logo=numpy&logoColor=white) |
| **Security & Auth** | ![JWT](https://img.shields.io/badge/JWT_Bearer-000000?style=flat-square&logo=json-web-tokens&logoColor=white) ![Bcrypt](https://img.shields.io/badge/Bcrypt-Passlib-333333?style=flat-square) ![OAuth2](https://img.shields.io/badge/OAuth2-Password_Flow-3C873A?style=flat-square) |
| **DevOps & Containers** | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) ![Docker Compose](https://img.shields.io/badge/Docker_Compose-2496ED?style=flat-square&logo=docker&logoColor=white) ![PowerShell](https://img.shields.io/badge/PowerShell-5391FE?style=flat-square&logo=powershell&logoColor=white) |

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
