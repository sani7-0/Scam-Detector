"""
Feature extraction for the URL phishing model. Mirrors url_checker_v3.py's
calculate_features() exactly — this must stay in sync with however the
model was actually trained. Kept as its own module (same pattern as
job_preprocessing.py) so main.py and any future retraining/eval script
share one definition instead of drifting apart.
"""
import re
from urllib.parse import urlparse

NUMERIC_COLS = [
    "URLLength", "DomainLength", "IsDomainIP", "URLSimilarityIndex",
    "CharContinuationRate", "TLDLegitimateProb", "TLDLength",
    "NoOfSubDomain", "NoOfLettersInURL", "NoOfDegitsInURL",
    "NoOfEqualsInURL", "IsHTTPS",
]

DEFAULT_TLD_PROB = 0.001


def calculate_features(url: str, tld_probs: dict) -> dict:
    """Computes the 12 numeric features + the raw URL column the model's
    preprocessor expects, straight from a raw URL string."""
    normalized_url = url if "://" in url else "https://" + url
    parsed = urlparse(normalized_url)
    domain = parsed.netloc.lower()

    subdomain_parts = domain.split(".")
    no_of_subdomain = max(len(subdomain_parts) - 2, 0)

    tld = domain.split(".")[-1] if "." in domain else ""
    is_ip = bool(re.match(r"^\d{1,3}(\.\d{1,3}){3}$", domain))

    n_letters = sum(c.isalpha() for c in normalized_url)
    n_digits = sum(c.isdigit() for c in normalized_url)
    n_equals = normalized_url.count("=")

    clean_chars = sum(c.isalnum() for c in normalized_url)
    char_continuation_rate = clean_chars / len(normalized_url) if len(normalized_url) > 0 else 0

    suspicious_chars = any(c in normalized_url for c in ["@", "%", "--"]) or n_equals > 2
    url_similarity_index = 40.0 if (suspicious_chars or is_ip) else 100.0

    tld_prob = tld_probs.get(tld, DEFAULT_TLD_PROB)

    return {
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