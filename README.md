# 💎 AI Personal Finance Manager

A full-stack, AI-powered Personal Finance Management (PFM) system built with **FastAPI**, **React (Vite)**, **Tailwind CSS**, and **Machine Learning**.

![Python](https://img.shields.io/badge/Python-3.12-blue?style=flat&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-1.0-009688?style=flat&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat&logo=tailwindcss)
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

- **Frontend**: React, Vite, Tailwind CSS, Recharts, Zustand
- **Backend**: Python 3.12, FastAPI, SQLAlchemy, Uvicorn, Pydantic
- **Database**: PostgreSQL / SQLite fallback
- **Machine Learning**: Scikit-Learn, Pandas, NumPy, XGBoost

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
