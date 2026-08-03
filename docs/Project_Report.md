# Comprehensive Project Report: PFM AI App (Windows PowerShell Edition)

## 1. Executive Summary

The **PFM AI App** is a state-of-the-art, full-stack Artificial Intelligence-driven Personal Finance Manager designed for the Windows environment. It empowers users to track accounts, manage budgets, categorize transactions automatically, detect anomalous spending, and gain deep financial insights through machine learning and Large Language Models (LLMs). The project utilizes a modern technology stack, combining a high-performance Python FastAPI backend with a dynamic React/Vite frontend, all containerized and orchestrated via Docker.

This report provides a detailed breakdown of the system architecture, database design, feature set, artificial intelligence integrations, and deployment guidelines. It serves as a complete reference for academic or professional project documentation.

---

## 2. Introduction and Objectives

### 2.1 Project Overview
Managing personal finances effectively is a complex task. Traditional finance managers require heavy manual input and lack predictive capabilities. The PFM AI App solves this by leveraging AI to automate categorization, predict future expenses, and provide a conversational interface for financial advice.

### 2.2 Core Objectives
- **Automation:** Minimize manual data entry via SMS parsing, webhook integrations, and AI-driven transaction categorization.
- **Intelligence:** Implement ML models (XGBoost, Prophet) to detect fraudulent/anomalous transactions and forecast future spending trends.
- **Conversational UI:** Integrate LLMs (OpenAI/Anthropic) to allow users to ask complex financial questions in natural language.
- **Gamification:** Encourage healthy financial habits through streaks, badges, and points.
- **Real-time Updates:** Utilize WebSockets for instant notifications on budget limits and new transactions.

---

## 3. Technology Stack and Architecture

The system is built on a decoupled, microservices-ready architecture.

### 3.1 Backend Architecture
- **Framework:** FastAPI (Python 3.11+) for high-performance, asynchronous REST APIs.
- **Server:** Uvicorn (ASGI web server).
- **ORM & Database:** SQLAlchemy with PostgreSQL for robust relational data storage. Alembic is used for database migrations.
- **Caching & Pub/Sub:** Redis (aioredis) for caching ML predictions and handling WebSocket pub/sub messaging.
- **Security:** JWT (JSON Web Tokens), Passlib (Bcrypt) for password hashing, and OAuth2 standard flows.

### 3.2 Frontend Architecture
- **Framework:** React 18 with Vite for rapid bundling and HMR.
- **Styling:** Tailwind CSS for responsive, utility-first UI design.
- **State Management:** Zustand for lightweight, global state management.
- **Routing:** React Router DOM (v6).
- **Data Visualization:** Recharts for rendering interactive financial charts and graphs.
- **HTTP Client:** Axios for API communication.

### 3.3 AI and Machine Learning Stack
- **Classical ML:** Scikit-learn and XGBoost for anomaly detection and transaction categorization.
- **Time-Series Forecasting:** Meta's Prophet for predicting future expenses based on historical data.
- **NLP & Embeddings:** Sentence-Transformers for semantic search of transactions.
- **LLM Integration:** LangChain, ChromaDB (Vector Database), and Anthropic/OpenAI APIs for the AI Chatbot and RAG (Retrieval-Augmented Generation) pipeline.

### 3.4 Infrastructure & DevOps
- **Containerization:** Docker and Docker Compose for setting up the database, Redis, pgAdmin, and application containers.
- **Scripting:** Windows PowerShell scripts (`setup.ps1`, `start-backend.ps1`) for seamless developer onboarding on Windows.

---

## 4. System Modules and Features

The application is divided into several logical modules to handle different aspects of personal finance.

### 4.1 Dashboard and Analytics
- **Dashboard (`DashboardPage.jsx`):** Provides a high-level overview of net worth, recent transactions, active budgets, and quick AI insights.
- **Analytics (`AnalyticsPage.jsx`):** Deep dive into spending patterns using Recharts (pie charts, bar charts).
- **Expense Map (`ExpenseMapPage.jsx`):** Geospatial visualization of transactions using the `latitude` and `longitude` data stored in the database.

### 4.2 Account and Transaction Management
- **Accounts (`AccountsPage.jsx`, `accounts.py`):** Users can link multiple bank accounts (savings, current, credit). The system stores tokenized account references.
- **Transactions (`TransactionsPage.jsx`, `transactions.py`):** CRUD operations for transactions. Each transaction is automatically tagged with a category by the AI engine.

### 4.3 Budgeting and Goals
- **Budgets (`BudgetPage.jsx`, `budgets.py`):** Users can set monthly or weekly limits for specific categories. The `budget_service.py` calculates real-time utilization.
- **Savings Goals (`GoalsPage.jsx`):** Track progress towards specific financial milestones (e.g., "Buy a Car", "Emergency Fund") with target amounts and deadlines.

### 4.4 Artificial Intelligence Features
- **AI Chatbot (`ChatbotPage.jsx`, `ai_routes.py`):** A conversational interface where users can ask questions like "How much did I spend on food last month?". It uses LangChain to query the database and summarize answers.
- **Predictions (`PredictionsPage.jsx`, `ForecastPage.jsx`, `predictions.py`):** Uses Prophet to extrapolate historical spending into the future, helping users anticipate cash flow shortages.
- **Voice Commands (`VoicePage.jsx`):** Allows hands-free addition of transactions and balance inquiries.

### 4.5 Gamification and Engagement
- **Gamification (`GamificationPage.jsx`, `gamification.py`):** Awards points for staying under budget, categorizing transactions, and logging in consecutively (streaks). Includes a leaderboard and badge system.

### 4.6 Notifications and Integrations
- **Alerts (`alert_service.py`, `websocket.py`):** Real-time alerts for anomalous transactions (detected by XGBoost) or budget overruns, delivered via WebSockets.
- **SMS Import (`SMSImportPage.jsx`, `sms_receiver.py`):** Parses standard bank SMS formats to automatically log transactions without manual entry.
- **Split Expenses (`SplitExpensePage.jsx`):** Utility to split bills with friends and track who owes whom.

---

## 5. Database Schema Design

The relational database is carefully structured to ensure data integrity and fast querying.

### 5.1 `users` Table
- `id` (UUID, Primary Key)
- `email`, `full_name`, `hashed_password`
- `monthly_income` (Float)
- `is_active`, `is_verified`
- **Relationships:** One-to-Many with Accounts, Budgets, SavingsGoals, Alerts.

### 5.2 `accounts` Table
- `id` (UUID, Primary Key)
- `user_id` (Foreign Key)
- `bank_name`, `account_token`, `account_last4`
- `account_type` (savings, current, credit)
- `balance` (Float)

### 5.3 `transactions` Table
- `id` (UUID, Primary Key)
- `account_id` (Foreign Key)
- `amount`, `merchant`, `description`
- `category`, `subcategory` (AI-Assigned)
- `transaction_type` (DEBIT/CREDIT)
- `is_anomaly` (Boolean), `anomaly_score` (Float)
- `is_recurring` (Boolean)
- `latitude`, `longitude`, `timestamp`

### 5.4 `budgets` Table
- `id` (UUID, Primary Key)
- `user_id` (Foreign Key)
- `category`, `limit_amount`, `spent_amount`
- `period` (monthly, weekly)
- `month`, `year`

### 5.5 `savings_goals` Table
- `id` (UUID, Primary Key)
- `user_id` (Foreign Key)
- `goal_name`, `target_amount`, `current_amount`
- `monthly_contribution`, `deadline`, `is_completed`

### 5.6 `alerts` Table
- `id` (UUID, Primary Key)
- `user_id` (Foreign Key)
- `alert_type` (ANOMALY, BUDGET_EXCEEDED, BILL_DUE)
- `title`, `message`, `severity`, `is_read`

---

## 6. Artificial Intelligence & Machine Learning Integration

The most distinct feature of this project is its heavy reliance on Machine Learning to reduce user friction.

### 6.1 Automated Categorization
Instead of manually selecting categories, an ML model (`train_categorizer.py`) trained on historical banking data classifies the `merchant` and `description` text into standardized categories (e.g., Groceries, Transport, Utilities, Entertainment).

### 6.2 Anomaly Detection
Every incoming transaction is evaluated against the user's historical spending patterns. Anomaly scores are calculated using Isolation Forests or XGBoost. If a transaction deviates significantly from the norm (e.g., a $500 charge at a foreign merchant when the user usually spends locally), `is_anomaly` is set to True, and an Alert is generated.

### 6.3 Time-Series Forecasting
Using Meta's `prophet` library, the system aggregates daily spending and models trends, weekly seasonality, and yearly seasonality. This allows the application to project the user's bank balance 30, 60, or 90 days into the future.

### 6.4 RAG-based AI Assistant
The chatbot implements a Retrieval-Augmented Generation (RAG) architecture. When a user asks a question, the system uses `sentence-transformers` to embed the query, searches `ChromaDB` for relevant past transactions or budgets, and injects this context into the prompt for the Anthropic/OpenAI LLM. This ensures the AI's answers are strictly grounded in the user's actual financial data, avoiding hallucinations.

---

## 7. Security and Authentication

- **Authentication Flow:** The app uses OAuth2 with Password Flow. Users exchange credentials for a short-lived JWT Access Token.
- **Password Storage:** Passwords are never stored in plaintext. They are hashed using Bcrypt with a work factor that protects against brute-force attacks.
- **Data Segregation:** Every API endpoint verifies the JWT and ensures that the requested resource (Account, Transaction) belongs to the authenticated `user_id`.
- **Environment Variables:** Secrets (Database URLs, API Keys) are managed via `.env` files and `pydantic-settings`, ensuring they are never hardcoded in the repository.

---

## 8. Deployment and Local Environment

The project is optimized for the Windows environment using PowerShell scripts.

### 8.1 Docker Workflow
The `docker-compose.yml` file defines the infrastructure services:
- `db`: PostgreSQL 15 container.
- `redis`: Redis container for caching and WebSockets.
- `pgadmin`: Web interface for database administration.

### 8.2 Setup Scripts
- `setup.ps1`: Orchestrates the initial setup. It checks for prerequisites (Python, Node.js, Docker), creates a Python virtual environment, installs backend requirements, installs frontend node modules, and starts the Docker containers.
- `start-backend.ps1` / `start-frontend.ps1`: Convenience scripts to spin up the local development servers (`uvicorn` and `vite`).
- `train-model.ps1`: Executes the Python scripts inside the `ml/` directory to retrain the categorization models.

### 8.3 Environment Configuration
The system relies on a `.env` file at the root of the backend directory. Key variables include:
- `DATABASE_URL=postgresql://pfm_user:pfm_pass@localhost:5432/pfm_db`
- `REDIS_URL=redis://localhost:6379/0`
- `SECRET_KEY` (for JWT signing)
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`

---

## 9. Future Enhancements

While the current feature set is robust, several areas are targeted for future development:
1. **Plaid Integration:** Direct integration with banking APIs via Plaid or Salt Edge for automatic, real-time transaction syncing, replacing the need for SMS parsing.
2. **Advanced Investment Tracking:** Adding support for stock portfolios, crypto assets, and calculating ROI.
3. **Multi-Currency Support:** Allowing users to hold accounts in different currencies with real-time exchange rate conversions.
4. **Mobile Application:** Porting the React frontend to React Native for native iOS and Android experiences.

---

## 10. Conclusion

The PFM AI App represents a significant leap forward from traditional spreadsheet-based finance trackers. By seamlessly blending a robust modern web stack (FastAPI, React, PostgreSQL) with cutting-edge Artificial Intelligence (LLMs, Time-Series Forecasting, Anomaly Detection), it provides an unparalleled, proactive financial management experience. The modular architecture ensures that the system is scalable, maintainable, and ready for future integrations.

