# 💎 AI Personal Finance Manager

A full-stack, AI-powered Personal Finance Management (PFM) system built with **FastAPI**, **React (Vite)**, **Tailwind CSS**, and **Machine Learning**.

![Python](https://img.shields.io/badge/Python-3.12-blue?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-1.0-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## ✨ Key Platform Highlights

- 📊 **Interactive Analytics Dashboard**: Real-time spending breakdowns, net worth tracking, and cash flow visualizer.
- 🤖 **AI Financial Advisor & Chatbot**: Conversational AI assistant giving personalized recommendations, budget advice, and spending summaries.
- 🔮 **Predictive Expense Forecasting**: Machine learning models predicting 30-day category spending and anomaly alerts.
- 📈 **Quantitative Trading & Strategy Backtester**: Historical quantitative trading simulation with SMA, RSI, and Momentum indicators.
- 🧾 **OCR Receipt & Invoice Parser**: Automatic extraction of total amount, date, and merchant details from uploaded bill images.
- 🔒 **Enterprise-Grade Security**: JWT authentication with Bcrypt password encryption and input data validation.

---

## 🧠 Intelligent AI Modules

| Module | Engine / Model | Capabilities |
| :--- | :--- | :--- |
| 🔮 **Expense Forecaster** | Machine Learning (Prophet / Scikit-Learn) | Predicts 30-day category spending trajectories & flags budget anomalies |
| 🤖 **Financial Advisor Chatbot** | LLM RAG Pipeline (OpenAI / Claude) | Answers user queries, analyzes spending habits & offers personalized savings advice |
| 📈 **Quantitative Backtester** | SMA, RSI & Momentum Indicators | Simulates historical trading strategies with win rate & Sharpe ratio calculation |
| 🧾 **OCR Invoice Parser** | Computer Vision (Tesseract OCR / OpenCV) | Extracts merchant names, transaction dates, and total amounts from bill images |

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
├── docs/                     # Technical Architecture & API Documentation
├── ml/                       # Machine Learning Training Pipelines & Models
├── docker-compose.yml        # Docker Multi-Container Orchestration
└── setup.ps1                 # Automated Setup Script
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

## 🔑 Demo Credentials
- **Email**: `demo@pfm.com`
- **Password**: `Demo@1234`

---

## 👨‍💻 Author

- **Name**: Gaddam Rajendra
- **Department**: Department of Artificial Intelligence and Machine Learning
- **Institution**: Dhanalakshmi Srinivasan University — Batch 2023–2027
