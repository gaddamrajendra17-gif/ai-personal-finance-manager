import math
import random
from datetime import datetime, timedelta
from typing import List, Dict

# Standard Indian Tickers and Asset names
TICKERS = {
    "RELIANCE": {"name": "Reliance Industries Ltd.", "start": 2450.0, "vol": 0.015, "drift": 0.0005},
    "TCS": {"name": "Tata Consultancy Services Ltd.", "start": 3600.0, "vol": 0.012, "drift": 0.0004},
    "HDFCBANK": {"name": "HDFC Bank Ltd.", "start": 1420.0, "vol": 0.014, "drift": 0.0003},
    "INFY": {"name": "Infosys Ltd.", "start": 1480.0, "vol": 0.016, "drift": 0.0002},
    "NIFTY50": {"name": "Nifty 50 Index", "start": 22200.0, "vol": 0.008, "drift": 0.0006},
    "GOLD": {"name": "SBI Gold Exchange Traded Fund", "start": 6200.0, "vol": 0.006, "drift": 0.0004},
}

class MarketDataService:
    @staticmethod
    def get_historical_prices(symbol: str, days: int = 180) -> List[Dict]:
        """
        Generate deterministic historical prices for the past N days.
        Seeded deterministically by symbol to remain consistent.
        """
        symbol = symbol.upper()
        if symbol not in TICKERS:
            symbol = "NIFTY50"
        
        info = TICKERS[symbol]
        start_val = info["start"]
        vol = info["vol"]
        drift = info["drift"]
        
        # Seed generator deterministically based on symbol name hash
        rng = random.Random(hash(symbol) & 0xFFFFFFFF)
        
        # Generate 365 days of data, then slice the last `days` days
        prices = []
        current_val = start_val
        now = datetime.utcnow().date()
        
        # Start history 365 days ago
        start_date = now - timedelta(days=365)
        
        for i in range(366):
            date_str = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
            # Geometric Brownian Motion simulation step
            # r = drift + vol * random_normal
            r = drift + vol * rng.normalvariate(0, 1)
            current_val = max(1.0, current_val * math.exp(r))
            
            prices.append({
                "date": date_str,
                "price": round(current_val, 2),
                "open": round(current_val * (1 - 0.005 * rng.random()), 2),
                "high": round(current_val * (1 + 0.01 * rng.random()), 2),
                "low": round(current_val * (1 - 0.01 * rng.random()), 2),
                "close": round(current_val, 2),
                "volume": int(rng.uniform(100000, 2000000))
            })
            
        # Return only the requested period ending today
        return prices[-days:]

    @staticmethod
    def get_live_price(symbol: str) -> float:
        """
        Get the current price, with simulated live ticks based on current time.
        """
        symbol = symbol.upper()
        history = MarketDataService.get_historical_prices(symbol, 1)
        if not history:
            return 100.0
            
        base_price = history[0]["price"]
        
        # Use minute and second of current time to generate a live float tick
        now = datetime.utcnow()
        rng = random.Random(now.minute * 60 + now.second + hash(symbol))
        noise_percent = rng.uniform(-0.003, 0.003)
        
        return round(base_price * (1 + noise_percent), 2)

    @staticmethod
    def get_tickers_overview() -> List[Dict]:
        """Get list of available tickers and their current price / change."""
        overview = []
        for symbol, info in TICKERS.items():
            hist = MarketDataService.get_historical_prices(symbol, 2)
            yesterday_price = hist[0]["price"] if len(hist) > 1 else info["start"]
            current_price = MarketDataService.get_live_price(symbol)
            change = current_price - yesterday_price
            change_percent = (change / yesterday_price) * 100
            
            overview.append({
                "symbol": symbol,
                "name": info["name"],
                "price": current_price,
                "change": round(change, 2),
                "change_percent": round(change_percent, 2)
            })
        return overview
