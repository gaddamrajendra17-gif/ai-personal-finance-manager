"""
PFM AI Financial Manager - ML Training Pipeline for Expense Categorizer

- Algorithm: Multinomial Naive Bayes
- Features: TF-IDF with unigrams & bigrams, sub-linear term frequency scaling
- Dataset size: 10,000 train / 2,500 test records matching the distributions in Table I
- Output: Save trained Pipeline to ml/models/categorizer.pkl
"""
import pandas as pd
import numpy as np
import joblib
import os
import random
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, accuracy_score

def generate_synthetic_corpus():
    """
    Generate synthetic dataset of Indian merchant transactions matching the paper counts:
    Food & Dining: 2100 train, 525 test
    Transport: 1400 train, 350 test
    Shopping: 1650 train, 412 test
    Utilities: 980 train, 245 test
    Healthcare: 760 train, 190 test
    Entertainment: 870 train, 217 test
    Education: 640 train, 160 test
    Others: 600 train, 150 test
    Travel: 1000 train, 251 test
    """
    merchants = {
        "Food & Dining": [
            "Swiggy", "Zomato", "McDonald's", "KFC", "Dominos Pizza", "Pizza Hut", "Starbucks Coffee", 
            "Cafe Coffee Day", "Burger King", "Chai Point", "Chaayos", "Haldiram's", "Bikanervala",
            "Swiggy Instamart Food", "Zomato Restaurant Delivery", "Local Biryani House", "Punjab Grill",
            "Barbeque Nation", "Subway", "Dunkin Donuts", "Taco Bell", "Leon Grill", "Empire Restaurant"
        ],
        "Transport": [
            "Uber Rides", "Ola Cabs", "Rapido Bike Taxi", "Namma Metro Bangalore", "Delhi Metro Card",
            "HP Petrol Pump", "IndianOil Fuel Station", "Bharat Petroleum", "Shell Petrol", "Bus Ticket BMTC",
            "IRCTC Train Ticket", "Redbus booking", "MakeMyTrip Cab", "Fastag Recharge HDFC", "Paytm Fastag"
        ],
        "Shopping": [
            "Amazon Shopping", "Flipkart Online", "Myntra Fashion", "Meesho Store", "Ajio Trends",
            "Nykaa Beauty", "Reliance Digital", "DMart Supermarket", "BigBasket Grocery", "Blinkit",
            "Zepto Grocery", "Zara Store", "H&M Apparel", "Decathlon Sports", "Tata Cliq", "Shopclues"
        ],
        "Utilities": [
            "Airtel Mobile Recharge", "Jio Prepaid Bill", "BSNL Broadband", "Vi Postpaid", "ACT Fibernet Bill",
            "BESCOM Electricity", "Water Supply Bill", "Tata Play DTH", "Dish TV Recharge", "Water Supply Bill", "Indane Gas Booking"
        ],
        "Healthcare": [
            "Apollo Pharmacy", "Medplus Chemists", "PharmEasy Medicines", "Tata 1mg Health", "Fortis Hospital",
            "Apollo Diagnostics", "Max Healthcare", "Local Dental Clinic", "Eye Hospital", "Lal PathLabs"
        ],
        "Entertainment": [
            "Netflix Subscription", "Disney Hotstar VIP", "Amazon Prime Video", "Spotify Music Premium",
            "BookMyShow Movie Tickets", "PVR Cinemas", "Inox Leisure", "YouTube Premium", "SonyLIV Sub"
        ],
        "Education": [
            "Udemy Online Courses", "Coursera Certificate", "Byju's Learning App", "School Term Fees",
            "College Semester Fees", "Stationery Shop", "Oxford Books Store", "Exam Registration Fee"
        ],
        "Others": [
            "Miscellaneous Spend", "Cash Withdrawal", "General Transfer", "Personal Payment", "Unknown Merchant"
        ],
        "Travel": [
            "MakeMyTrip Flight", "Goibibo Hotel", "Yatra Travels", "EaseMyTrip Booking", "Indigo Airlines", 
            "Air India Flight", "Akasa Air", "SpiceJet", "Booking.com Hotel", "Expedia", "Airbnb Stay", 
            "Thomas Cook", "SOTC Travels"
        ]
    }
    
    suffixes = [
        " Bangalore", " Mumbai", " Delhi", " UPI", " Pay", " Wallet", " Store", " outlet", " online", "",
        " Merchant", " payment", " transfer", " Ref 12345", " Ref 9876", " GPay", " PhonePe", " Paytm"
    ]
    
    random.seed(42)
    
    train_data = []
    test_data = []
    
    targets = {
        "Food & Dining": (2100, 525),
        "Transport": (1400, 350),
        "Shopping": (1650, 412),
        "Utilities": (980, 245),
        "Healthcare": (760, 190),
        "Entertainment": (870, 217),
        "Education": (640, 160),
        "Others": (600, 150),
        "Travel": (1000, 251)
    }
    
    for cat, (train_count, test_count) in targets.items():
        base_merchants = merchants[cat]
        # Train set
        for _ in range(train_count):
            base = random.choice(base_merchants)
            suffix = random.choice(suffixes)
            merchant_name = f"{base}{suffix}".strip()
            amount = round(random.uniform(10.0, 5000.0), 2)
            train_data.append((merchant_name, amount, cat))
            
        # Test set
        for _ in range(test_count):
            base = random.choice(base_merchants)
            suffix = random.choice(suffixes)
            merchant_name = f"{base}{suffix}".strip()
            amount = round(random.uniform(10.0, 5000.0), 2)
            test_data.append((merchant_name, amount, cat))
            
    return train_data, test_data

def train_model():
    print("Training expense categorizer model matching paper specifications...")
    
    train_raw, test_raw = generate_synthetic_corpus()
    
    train_df = pd.DataFrame(train_raw, columns=["merchant", "amount", "category"])
    test_df = pd.DataFrame(test_raw, columns=["merchant", "amount", "category"])
    
    print(f"Training corpus size: {len(train_df)} labeled records")
    print(f"Test corpus size: {len(test_df)} records")
    print(f"Categories: {train_df['category'].nunique()}")
    
    # Extract texts and labels
    # Preprocessing: Lowercase and punctuation removal
    import string
    import re

    # NLTK English stopwords list (179 words)
    NLTK_STOPWORDS = [
        'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're", "you've", "you'll", "you'd",
        'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', "she's", 'her', 'hers',
        'herself', 'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
        'who', 'whom', 'this', 'that', "that'll", 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
        'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
        'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
        'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
        'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
        'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
        'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', "don't", 'should',
        "should've", 'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', "aren't", 'couldn', "couldn't",
        'didn', "didn't", 'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't", 'isn', "isn't",
        'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn', "needn't", 'shan', "shan't", 'shouldn', "shouldn't",
        'wasn', "wasn't", 'weren', "weren't", 'won', "won't", 'wouldn', "wouldn't"
    ]

    def preprocess_text(text):
        if not isinstance(text, str):
            return ""
        text = text.lower()
        # Remove punctuation by replacing with space
        text = re.sub(f"[{re.escape(string.punctuation)}]", " ", text)
        # Remove multiple spaces
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    train_texts = train_df["merchant"].apply(preprocess_text)
    train_labels = train_df["category"]
    
    test_texts = test_df["merchant"].apply(preprocess_text)
    test_labels = test_df["category"]
    
    # TF-IDF Pipeline with unigram & bigram features, sublinear term frequency scaling and NLTK stopwords
    pipeline = Pipeline([
        ('vectorizer', TfidfVectorizer(
            ngram_range=(1, 2),
            sublinear_tf=True,
            max_features=5000,
            stop_words=NLTK_STOPWORDS,
            lowercase=True
        )),
        ('classifier', MultinomialNB(alpha=1.0))
    ])
    
    # Fit the pipeline
    pipeline.fit(train_texts, train_labels)
    
    # Evaluate
    test_preds = pipeline.predict(test_texts)
    acc = accuracy_score(test_labels, test_preds)
    
    # Print the exact performance metrics
    print(f"\nWeighted-Average Accuracy: {acc:.2%}")
    print("\nClassification Report:")
    print(classification_report(test_labels, test_preds))
    
    # Ensure models directory exists
    models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
    os.makedirs(models_dir, exist_ok=True)
    save_path = os.path.join(models_dir, "categorizer.pkl")
    
    # Save the pipeline and components
    joblib.dump({
        "model": pipeline,
        "vectorizer": pipeline.named_steps['vectorizer'],
        "categories": list(pipeline.named_steps['classifier'].classes_)
    }, save_path)
    
    print(f"\nPipeline saved to: {save_path}")
    return pipeline

if __name__ == "__main__":
    train_model()

