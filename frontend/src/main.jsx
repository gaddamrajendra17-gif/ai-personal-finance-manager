import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import useAuthStore from './store/authStore'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import TransactionsPage from './pages/TransactionsPage'
import BudgetPage from './pages/BudgetPage'
import GoalsPage from './pages/GoalsPage'
import ForecastPage from './pages/ForecastPage'
import ChatbotPage from './pages/ChatbotPage'
import GamificationPage from './pages/GamificationPage'
import PredictionsPage from './pages/PredictionsPage'
import SMSImportPage from './pages/SMSImportPage'
import AnalyticsPage from './pages/AnalyticsPage'
import VoicePage from './pages/VoicePage'
import RealtimeAgentPage from './pages/RealtimeAgentPage'
import ExpenseMapPage from './pages/ExpenseMapPage'
import SplitExpensePage from './pages/SplitExpensePage'
import ReceiptScanPage from './pages/ReceiptScanPage'
import Layout from './components/Layout'
import AccountsPage from './pages/AccountsPage'
import RoboAdvisorPage from './pages/RoboAdvisorPage'
import InvestmentsPage from './pages/InvestmentsPage'
import TradingPage from './pages/TradingPage'
import FinancialAdvisorPage from './pages/FinancialAdvisorPage'
import SecurityPage from './pages/SecurityPage'

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" />
}

function App() {
  const { restoreToken } = useAuthStore()
  React.useEffect(() => { restoreToken() }, [])
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="receipt-scan" element={<ReceiptScanPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="budgets" element={<BudgetPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="forecast" element={<ForecastPage />} />
          <Route path="chat" element={<ChatbotPage />} />
          <Route path="gamification" element={<GamificationPage />} />
          <Route path="predictions" element={<PredictionsPage />} />
          <Route path="sms-import" element={<SMSImportPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="voice" element={<VoicePage />} />
          <Route path="real-time-agent" element={<RealtimeAgentPage />} />
          <Route path="expense-map" element={<ExpenseMapPage />} />
          <Route path="split" element={<SplitExpensePage />} />
          <Route path="robo-advisor" element={<RoboAdvisorPage />} />
          <Route path="investments" element={<InvestmentsPage />} />
          <Route path="trading" element={<TradingPage />} />
          <Route path="financial-advisor" element={<FinancialAdvisorPage />} />
          <Route path="security" element={<SecurityPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)


