import json
import math
from typing import Dict, List

try:
    import numpy as np
except Exception:
    np = None

try:
    import pandas as pd
except Exception:
    pd = None

from app.services.market_data_service import MarketDataService

class TradingService:
    @staticmethod
    def calculate_sma(prices: List[float], period: int) -> List[float]:
        """Calculate Simple Moving Average."""
        smas = []
        for i in range(len(prices)):
            if i < period - 1:
                smas.append(prices[i])
            else:
                smas.append(sum(prices[i - period + 1 : i + 1]) / period)
        return smas

    @staticmethod
    def calculate_rsi(prices: List[float], period: int = 14) -> List[float]:
        """Calculate Relative Strength Index."""
        rsi = [50.0] * len(prices)
        if len(prices) < period + 1:
            return rsi
            
        deltas = np.diff(prices)
        seed = deltas[:period]
        up = seed[seed >= 0].sum() / period
        down = -seed[seed < 0].sum() / period
        rs = up / down if down != 0 else 0
        rsi[period] = 100.0 - (100.0 / (1.0 + rs))
        
        for i in range(period + 1, len(prices)):
            delta = deltas[i - 1]
            if delta > 0:
                upval = delta
                downval = 0.0
            else:
                upval = 0.0
                downval = -delta
                
            up = (up * (period - 1) + upval) / period
            down = (down * (period - 1) + downval) / period
            rs = up / down if down != 0 else 0
            rsi[i] = 100.0 - (100.0 / (1.0 + rs))
            
        return rsi

    @staticmethod
    def run_backtest(symbol: str, strategy_type: str, params_str: str, initial_capital: float = 100000.0) -> Dict:
        """
        Execute backtest on historical data and return equity curve, signals, and metrics.
        """
        params = {}
        if params_str:
            try:
                params = json.loads(params_str)
            except Exception:
                pass
                
        # Fetch 180 days of historical prices
        history = MarketDataService.get_historical_prices(symbol, 180)
        if len(history) < 30:
            return {"status": "insufficient_data", "message": "Need at least 30 days of data."}
            
        df = pd.DataFrame(history)
        prices = df["price"].tolist()
        dates = df["date"].tolist()
        
        signals = [] # 'BUY', 'SELL', 'HOLD'
        fast_sma = []
        slow_sma = []
        rsi = []
        
        # ── Compute Indicators ────────────────────────────────────────
        if strategy_type == "SMA_CROSSOVER":
            fast_p = int(params.get("fast_period", 10))
            slow_p = int(params.get("slow_period", 30))
            fast_sma = TradingService.calculate_sma(prices, fast_p)
            slow_sma = TradingService.calculate_sma(prices, slow_p)
            
            # Signals generation
            for i in range(len(prices)):
                if i < slow_p:
                    signals.append("HOLD")
                else:
                    # Crossover check
                    prev_fast = fast_sma[i - 1]
                    prev_slow = slow_sma[i - 1]
                    curr_fast = fast_sma[i]
                    curr_slow = slow_sma[i]
                    
                    if prev_fast <= prev_slow and curr_fast > curr_slow:
                        signals.append("BUY")
                    elif prev_fast >= prev_slow and curr_fast < curr_slow:
                        signals.append("SELL")
                    else:
                        signals.append("HOLD")
                        
        elif strategy_type == "MEAN_REVERSION":
            rsi_p = int(params.get("rsi_period", 14))
            oversold = float(params.get("rsi_lower", 30))
            overbought = float(params.get("rsi_upper", 70))
            rsi = TradingService.calculate_rsi(prices, rsi_p)
            
            # Signals generation
            for i in range(len(prices)):
                if i < rsi_p:
                    signals.append("HOLD")
                else:
                    curr_rsi = rsi[i]
                    prev_rsi = rsi[i - 1]
                    # Buy when rsi crosses above oversold limit
                    if prev_rsi < oversold and curr_rsi >= oversold:
                        signals.append("BUY")
                    # Sell when rsi crosses below overbought limit
                    elif prev_rsi > overbought and curr_rsi <= overbought:
                        signals.append("SELL")
                    else:
                        signals.append("HOLD")
                        
        else: # MOMENTUM
            mom_p = int(params.get("momentum_period", 20))
            sma_p = int(params.get("sma_period", 20))
            sma = TradingService.calculate_sma(prices, sma_p)
            fast_sma = sma # Share fast_sma slot for chart rendering
            
            for i in range(len(prices)):
                if i < max(mom_p, sma_p):
                    signals.append("HOLD")
                else:
                    curr_price = prices[i]
                    past_price = prices[i - mom_p]
                    curr_sma = sma[i]
                    # Buy if price is above moving average and positive rate of change
                    if curr_price > curr_sma and curr_price > past_price:
                        signals.append("BUY")
                    elif curr_price < curr_sma or curr_price < past_price:
                        signals.append("SELL")
                    else:
                        signals.append("HOLD")
                        
        # ── Execute Trading Simulation ─────────────────────────────────
        cash = initial_capital
        position = 0.0 # Number of shares
        equity_curve = []
        trade_log = []
        
        # Metrics trackers
        wins = 0
        total_trades = 0
        peak_equity = initial_capital
        max_drawdown = 0.0
        
        for i in range(len(prices)):
            price = prices[i]
            date = dates[i]
            sig = signals[i]
            
            # Action BUY
            if sig == "BUY" and position == 0.0:
                position = cash / price
                cash = 0.0
                trade_log.append({
                    "date": date,
                    "action": "BUY",
                    "price": price,
                    "shares": round(position, 4),
                    "capital": round(position * price, 2)
                })
                total_trades += 1
                
            # Action SELL
            elif sig == "SELL" and position > 0.0:
                value = position * price
                cash = value
                buy_price = trade_log[-1]["price"]
                profit = (price - buy_price) * position
                profit_percent = ((price - buy_price) / buy_price) * 100
                
                trade_log.append({
                    "date": date,
                    "action": "SELL",
                    "price": price,
                    "shares": round(position, 4),
                    "capital": round(cash, 2),
                    "profit": round(profit, 2),
                    "profit_percent": round(profit_percent, 2)
                })
                
                if profit > 0:
                    wins += 1
                position = 0.0
                
            # Portfolio value at day's close
            portfolio_value = cash + (position * price)
            equity_curve.append({
                "date": date,
                "price": price,
                "portfolio_value": round(portfolio_value, 2),
                "fast_indicator": round(fast_sma[i], 2) if fast_sma else None,
                "slow_indicator": round(slow_sma[i], 2) if slow_sma else None,
                "rsi_indicator": round(rsi[i], 2) if rsi else None,
                "signal": sig if sig in ["BUY", "SELL"] else None
            })
            
            # Drawdown check
            if portfolio_value > peak_equity:
                peak_equity = portfolio_value
            dd = (peak_equity - portfolio_value) / peak_equity * 100
            if dd > max_drawdown:
                max_drawdown = dd
                
        final_equity = cash + (position * prices[-1])
        total_return_pct = ((final_equity - initial_capital) / initial_capital) * 100
        win_rate = (wins / (total_trades or 1)) * 100 if total_trades > 0 else 0.0
        
        # Calculate Sharpe (simple monthly return volatility proxy)
        curve_values = [d["portfolio_value"] for d in equity_curve]
        daily_returns = np.diff(curve_values) / curve_values[:-1]
        std = np.std(daily_returns) if len(daily_returns) > 1 else 0.0
        mean = np.mean(daily_returns) if len(daily_returns) > 1 else 0.0
        
        # Annualized Sharpe (assuming 252 trading days)
        sharpe = (mean / std * np.sqrt(252)) if std > 0 else 0.0
        
        return {
            "status": "success",
            "metrics": {
                "initial_capital": initial_capital,
                "final_capital": round(final_equity, 2),
                "total_return_percent": round(total_return_pct, 2),
                "win_rate_percent": round(win_rate, 2),
                "total_trades": total_trades,
                "max_drawdown_percent": round(max_drawdown, 2),
                "sharpe_ratio": round(sharpe, 2)
            },
            "equity_curve": equity_curve,
            "trade_log": trade_log
        }

