"""
AI Expense Categorizer
Uses XGBoost with TF-IDF merchant name features.
Falls back to rule-based keyword matching for cold start.
"""
import re
from typing import Tuple, Optional
import joblib
import os
import numpy as np

# Lazy load NLP transformers
_zero_shot_classifier = None
_sentence_transformer_model = None
_category_embeddings = None

def get_finbert_pipeline():
    global _zero_shot_classifier
    if _zero_shot_classifier is None:
        try:
            from transformers import pipeline
            # Load only from local cache to prevent network requests and hangs
            _zero_shot_classifier = pipeline("zero-shot-classification", model="ProsusAI/finbert", local_files_only=True)
        except Exception:
            pass
    return _zero_shot_classifier

def get_sentence_transformer():
    global _sentence_transformer_model, _category_embeddings
    if _sentence_transformer_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            # Load only from local cache to prevent network requests and hangs
            _sentence_transformer_model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
            _category_embeddings = _sentence_transformer_model.encode(CATEGORIES, convert_to_tensor=True)
        except Exception:
            pass
    return _sentence_transformer_model

# ── Category Definitions ──────────────────────────────────────
CATEGORIES = [
    "Food & Dining",
    "Rent",
    "Transport",
    "Entertainment",
    "Health & Medical",
    "Utilities",
    "Shopping",
    "EMI & Loans",
    "Education",
    "Travel",
    "Investments",
    "Other",
]

# ── Rule-Based Keyword Map (fallback + cold start) ────────────
KEYWORD_RULES = {
    "Food & Dining": [
        "swiggy", "zomato", "mcdonald", "kfc", "domino", "pizza",
        "burger", "cafe", "restaurant", "food", "eat", "biryani",
        "hotel", "dhaba", "subway", "dunkin", "starbucks", "chai",
    ],
    "Rent": [
        "rent", "lease", "housing", "apartment", "flat", "pg",
        "hostel", "accommodation", "nobroker", "magicbricks",
    ],
    "Transport": [
        "uber", "ola", "rapido", "metro", "bus", "train", "irctc",
        "petrol", "fuel", "parking", "toll", "cab", "auto", "nammametro",
    ],
    "Entertainment": [
        "netflix", "hotstar", "amazon prime", "spotify", "youtube",
        "movie", "cinema", "pvr", "inox", "bookmyshow", "gaming",
        "zee5", "sony liv", "jio cinema",
    ],
    "Health & Medical": [
        "apollo", "medplus", "pharmeasy", "netmeds", "1mg",
        "hospital", "clinic", "doctor", "pharmacy", "medical",
        "health", "lab", "diagnostic", "chemist", "pathology",
    ],
    "Utilities": [
        "electricity", "water", "gas", "internet", "broadband",
        "airtel", "jio", "bsnl", "vi ", "vodafone", "tata sky",
        "d2h", "dish tv", "recharge", "mobile bill", "wifi",
    ],
    "Shopping": [
        "amazon", "flipkart", "myntra", "meesho", "ajio", "nykaa",
        "reliance", "dmart", "bigbasket", "blinkit", "zepto",
        "instamart", "dunzo", "mall", "store", "mart",
    ],
    "EMI & Loans": [
        "emi", "loan", "bajaj", "hdfc loan", "icici loan", "sbi loan",
        "lic", "insurance", "policy", "premium", "credit card",
    ],
    "Travel": [
        "flight", "airline", "indigo", "air india", "spicejet",
        "makemytrip", "goibibo", "cleartrip", "yatra", "hotel booking",
        "oyo", "airbnb", "holiday", "tour",
    ],
    "Education": [
        "byju", "unacademy", "coursera", "udemy", "school", "college",
        "tuition", "books", "stationery", "exam", "coaching",
    ],
    "Investments": [
        "zerodha", "groww", "upstox", "kuvera", "coin", "mutual fund",
        "sip", "nps", "ppf", "fd", "gold", "stocks", "demat",
    ],
}

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "ml", "models", "categorizer.pkl")
_model = None
_vectorizer = None


def _load_model():
    global _model, _vectorizer
    if os.path.exists(MODEL_PATH):
        try:
            data = joblib.load(MODEL_PATH)
            _model = data.get("model")
            _vectorizer = data.get("vectorizer")
        except Exception:
            pass


def _rule_based_category(merchant: str, description: Optional[str]) -> Tuple[str, Optional[str]]:
    """Keyword-based categorization as fallback."""
    text = f"{merchant} {description or ''}".lower()
    for category, keywords in KEYWORD_RULES.items():
        for kw in keywords:
            if kw in text:
                return category, None
    return "Other", None


def preprocess_text(text: str) -> str:
    import string
    text = text.lower()
    # Remove punctuation
    text = re.sub(f"[{re.escape(string.punctuation)}]", " ", text)
    # Remove multiple spaces
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def categorize_transaction(
    merchant: str,
    amount: float,
    description: Optional[str] = None
) -> Tuple[str, Optional[str]]:
    """
    Categorize a transaction using a five-tier decision hierarchy:
    Tier 1: Zero-shot FinBERT Transformer classification
    Tier 2: Sentence-Transformers (all-MiniLM-L6-v2) semantic similarity
    Tier 3: Trained TF-IDF Naive Bayes / XGBoost model
    Tier 4: Keyword matching rules (KEYWORD_RULES)
    Tier 5: SMS parser vocabulary reuse
    """
    raw_text = f"{merchant} {description or ''}"
    text = preprocess_text(raw_text)

    # Tier 1: Try FinBERT Zero-Shot Classification
    finbert = get_finbert_pipeline()
    if finbert:
        try:
            res = finbert(raw_text, candidate_labels=CATEGORIES)
            best_cat = res["labels"][0]
            score = res["scores"][0]
            if score > 0.4:
                return best_cat, None
        except Exception:
            pass

    # Tier 2: Try Sentence-Transformers semantic similarity
    st_model = get_sentence_transformer()
    if st_model and _category_embeddings is not None:
        try:
            from sentence_transformers import util
            text_embedding = st_model.encode(raw_text, convert_to_tensor=True)
            cos_scores = util.cos_sim(text_embedding, _category_embeddings)[0]
            best_idx = int(np.argmax(cos_scores.cpu().numpy()))
            best_score = float(cos_scores[best_idx])
            
            # Map index to category if confidence is reasonable
            if best_score > 0.3:
                return CATEGORIES[best_idx], None
        except Exception:
            pass

    # Tier 3: Trained TF-IDF model
    _load_model()
    use_ml = False
    if _model and _vectorizer:
        try:
            vocab = getattr(_vectorizer, "vocabulary_", {})
            tokens = re.findall(r'\b\w+\b', text)
            if any(tok in vocab for tok in tokens):
                use_ml = True
        except Exception:
            use_ml = True

    if use_ml:
        try:
            if hasattr(_model, "predict"):
                pred = _model.predict([text])[0]
                # Map to standard database category names
                if pred == "Healthcare":
                    pred = "Health & Medical"
                elif pred == "Others":
                    pred = "Other"
                return pred, None
        except Exception:
            pass

    # Tier 4: Keyword-based category map (fallback)
    category, sub = _rule_based_category(merchant, description)
    if category != "Other":
        return category, None

    # Tier 5: SMS vocabulary reuse
    try:
        from app.api.sms_receiver import detect_category
        sms_cat = detect_category(text, merchant)
        if sms_cat == "Healthcare":
            sms_cat = "Health & Medical"
        elif sms_cat == "Others":
            sms_cat = "Other"
        if sms_cat != "Other":
            return sms_cat, None
    except Exception:
        pass

    return "Other", None
