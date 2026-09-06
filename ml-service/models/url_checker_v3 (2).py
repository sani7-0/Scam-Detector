"""
url_checker.py

Lets you test a PLAIN URL (like "https://youtube.com") directly —
no need to manually calculate the 12 numeric features yourself.

Usage:
    python url_checker.py
    (then type a URL when prompted)

Or import and use in your own code:
    from url_checker import check_url
    check_url("https://youtube.com")
"""

import re
import json
from urllib.parse import urlparse
import joblib
import pandas as pd
from xgboost import XGBClassifier

# Load the preprocessor (TF-IDF + numeric passthrough) and the XGBoost model separately —
# this avoids version-mismatch crashes that can happen when the whole pipeline is pickled together
preprocessor = joblib.load("preprocessor.joblib")

xgb_model = XGBClassifier()
xgb_model.load_model("xgb_model.json")

with open("tld_legit_probs.json") as f:
    TLD_PROBS = json.load(f)

# Fallback probability for any TLD we've never seen before
DEFAULT_TLD_PROB = 0.001


def calculate_features(url: str) -> dict:
    """
    Computes the 12 numeric features the model expects, straight from a raw URL string.
    This mirrors the same feature definitions used in the original training dataset.
    """
    # Normalize: if no scheme given (e.g. "youtube.com" or "www.youtube.com"),
    # assume https:// — this matches how most real users type URLs, and matches
    # the scheme used for the legitimate brand examples in training.
    normalized_url = url if "://" in url else "https://" + url
    parsed = urlparse(normalized_url)
    domain = parsed.netloc.lower()

    # Strip a leading "www." off when counting "real" subdomains, matching dataset convention
    subdomain_parts = domain.split(".")
    # crude subdomain count: anything beyond "domain.tld" counts as a subdomain level
    no_of_subdomain = max(len(subdomain_parts) - 2, 0)

    tld = domain.split(".")[-1] if "." in domain else ""
    is_ip = bool(re.match(r"^\d{1,3}(\.\d{1,3}){3}$", domain))

    n_letters = sum(c.isalpha() for c in normalized_url)
    n_digits = sum(c.isdigit() for c in normalized_url)
    n_equals = normalized_url.count("=")

    # CharContinuationRate: fraction of characters that are alphanumeric (a simple stand-in
    # for "clean, non-fragmented" URLs — matches the ~1.0 seen for simple legit URLs in training data)
    clean_chars = sum(c.isalnum() for c in normalized_url)
    char_continuation_rate = clean_chars / len(normalized_url) if len(normalized_url) > 0 else 0

    # URLSimilarityIndex: without the original dataset's full reference-matching methodology,
    # we approximate: 100 for a clean, short, no-suspicious-character domain; lower otherwise.
    suspicious_chars = any(c in normalized_url for c in ["@", "%", "--"]) or n_equals > 2
    url_similarity_index = 40.0 if (suspicious_chars or is_ip) else 100.0

    tld_prob = TLD_PROBS.get(tld, DEFAULT_TLD_PROB)

    return {
        # Feed the NORMALIZED form to the model (matches the https://... format seen in training)
        "URL": normalized_url,
        "URLLength": len(normalized_url),
        "DomainLength": len(domain),
        "IsDomainIP": int(is_ip),
        "URLSimilarityIndex": url_similarity_index,
        "CharContinuationRate": char_continuation_rate,
        "TLDLegitimateProb": tld_prob,
        "TLDLength": len(tld),
        "NoOfSubDomain": no_of_subdomain,
        "NoOfLettersInURL": n_letters,
        "NoOfDegitsInURL": n_digits,
        "NoOfEqualsInURL": n_equals,
        "IsHTTPS": int(parsed.scheme == "https"),
    }


def check_url(url: str) -> dict:
    """
    Takes a plain URL string, computes its features, and returns a prediction.
    """
    features = calculate_features(url)
    row = pd.DataFrame([features])

    numeric_cols = ["URLLength", "DomainLength", "IsDomainIP", "URLSimilarityIndex",
                     "CharContinuationRate", "TLDLegitimateProb", "TLDLength",
                     "NoOfSubDomain", "NoOfLettersInURL", "NoOfDegitsInURL",
                     "NoOfEqualsInURL", "IsHTTPS"]

    X = row[["URL"] + numeric_cols]
    X_transformed = preprocessor.transform(X)
    prediction = xgb_model.predict(X_transformed)[0]
    probability = xgb_model.predict_proba(X_transformed)[0]

    verdict = "phishing" if prediction == 1 else "legit"
    confidence = probability[prediction]

    return {
        "url": url,
        "verdict": verdict,
        "confidence": round(float(confidence), 4),
    }


if __name__ == "__main__":
    while True:
        url = input("\nEnter a URL to check (or 'quit' to exit): ").strip()
        if url.lower() == "quit":
            break
        result = check_url(url)
        print(f"  -> {result['verdict'].upper()}  (confidence: {result['confidence']})")
