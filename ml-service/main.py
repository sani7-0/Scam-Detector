from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
import joblib
import json
import pandas as pd
from xgboost import XGBClassifier
import pytesseract
from PIL import Image
import io

from job_preprocessing import make_text, text_to_job_input
from url_preprocessing import calculate_features, NUMERIC_COLS

app = FastAPI(title="Scam Detector ML Service")


# ==========================================
# LOAD MODELS
# ==========================================

# SMS/Text model
text_model = joblib.load("models/sms_model.pkl")
vectorizer = joblib.load("models/tfidf_vectorizer.pkl")

# URL model
# Real model from the team: a combined preprocessor (TF-IDF on the URL
# string + the 12 engineered numeric features together) feeding an
# XGBClassifier. The classifier is saved in XGBoost's native JSON format
# and loaded through the sklearn wrapper API (XGBClassifier().load_model()),
# matching exactly how the model team's own url_checker_v3.py reference
# script uses it — not the raw xgb.Booster()/DMatrix API from the earlier
# placeholder version.
url_preprocessor = joblib.load("models/url_preprocessor.joblib")
url_model = XGBClassifier()
url_model.load_model("models/url_xgb_model.json")
with open("models/url_tld_legit_probs.json") as f:
    URL_TLD_PROBS = json.load(f)

# Job posting model (FraudJobGuard) — a full sklearn Pipeline
# (TF-IDF -> ComplementNB), but it expects a specifically engineered text
# representation, not raw text directly. job_preprocessing.make_text()
# reproduces that exact preprocessing. Comes with its own tuned decision
# threshold in job_model_meta.json — NOT the generic 0.3/0.7 buckets.
job_model = joblib.load("models/job_model.joblib")
with open("models/job_model_meta.json") as f:
    job_meta = json.load(f)
JOB_THRESHOLD = float(job_meta["threshold"])


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def to_verdict(p: float) -> str:
    return "safe" if p < 0.3 else "suspicious" if p < 0.7 else "scam"


def score_text_sms(text: str) -> dict:
    X = vectorizer.transform([text])
    p = float(text_model.predict_proba(X)[0][1])
    return {
        "risk_score": p,
        "verdict": to_verdict(p),
        "category": "sms_scam" if p >= 0.7 else None,
        "confidence": round(max(p, 1 - p), 4),
        "source": "sms_model_v1",
    }


def score_text_job(text: str) -> dict:
    df = text_to_job_input(text)
    engineered = make_text(df)
    p = float(job_model.predict_proba(engineered)[0][1])
    # Uses THEIR tuned threshold to decide flagged/not — not our generic
    # 0.3/0.7 buckets, since ComplementNB's calibration and their chosen
    # precision/recall tradeoff don't necessarily align with those defaults.
    flagged = p >= JOB_THRESHOLD
    verdict = "scam" if flagged else ("suspicious" if p >= JOB_THRESHOLD * 0.5 else "safe")
    return {
        "risk_score": p,
        "verdict": verdict,
        "category": "job_scam" if flagged else None,
        "confidence": round(max(p, 1 - p), 4),
        "source": "job_model_v1",
    }


def score_text(text: str) -> dict:
    """Unified entry point: runs BOTH specialized text models and returns
    whichever is more confident this is a scam. Not a merged retrain —
    the SMS and job models take structurally different inputs (raw
    message vs. engineered job-posting text), so this is an ensemble by
    max score, not a single unified classifier."""
    sms_result = score_text_sms(text)
    job_result = score_text_job(text)
    winner = dict(sms_result if sms_result["risk_score"] >= job_result["risk_score"] else job_result)
    winner["risk_score"] = round(winner["risk_score"], 4)
    winner["all_scores"] = {
        "sms": round(sms_result["risk_score"], 4),
        "job": round(job_result["risk_score"], 4),
    }
    return winner


def score_url(url: str) -> dict:
    features = calculate_features(url, URL_TLD_PROBS)
    row = pd.DataFrame([features])
    X = row[["URL"] + NUMERIC_COLS]
    X_transformed = url_preprocessor.transform(X)

    # risk_score is always P(phishing) — class index 1 — regardless of
    # which class the model's own argmax would pick, so this stays
    # consistent with how the SMS/job scores are computed above.
    p = float(url_model.predict_proba(X_transformed)[0][1])

    return {
        "risk_score": round(p, 4),
        "verdict": to_verdict(p),
        "category": "phishing_url" if p >= 0.7 else None,
        "confidence": round(max(p, 1 - p), 4),
        "source": "url_xgboost_v3",
    }


# ==========================================
# REQUEST MODELS
# ==========================================

class TextRequest(BaseModel):
    text: str


class URLRequest(BaseModel):
    url: str


# ==========================================
# HEALTH CHECK
# ==========================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "text_model": "loaded",
        "job_model": "loaded",
        "url_model": "loaded",
    }


# ==========================================
# TEXT PREDICTION
# ==========================================

@app.post("/predict/text")
def predict_text(req: TextRequest):
    return score_text(req.text)


# ==========================================
# IMAGE PREDICTION
# ==========================================

@app.post("/predict/image")
async def predict_image(file: UploadFile = File(...)):

    image_bytes = await file.read()

    image = Image.open(io.BytesIO(image_bytes))

    extracted_text = pytesseract.image_to_string(image).strip()

    if not extracted_text:
        return {
            "risk_score": 0.0,
            "verdict": "pending",
            "category": None,
            "confidence": 0.0,
            "source": "image_ocr_empty",
            "extracted_text": "",
        }

    result = score_text(extracted_text)

    result["source"] = result["source"] + "_via_ocr"

    result["extracted_text"] = extracted_text

    return result


# ==========================================
# URL PREDICTION
# ==========================================

@app.post("/predict/url")
def predict_url(req: URLRequest):

    return score_url(req.url)