from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
import joblib
import pytesseract
from PIL import Image
import io

app = FastAPI(title="Scam Detector ML Service")

# Model and vectorizer were saved SEPARATELY (confirmed from the training
# notebook) — not a combined Pipeline. Both must be loaded and used together:
# vectorizer.transform() first, then model.predict_proba() on the result.
text_model = joblib.load("models/sms_model.pkl")
vectorizer = joblib.load("models/tfidf_vectorizer.pkl")

def to_verdict(p: float) -> str:
    return "safe" if p < 0.3 else "suspicious" if p < 0.7 else "scam"

def score_text(text: str) -> dict:
    X = vectorizer.transform([text])
    p = float(text_model.predict_proba(X)[0][1])  # classes_ = [0, 1], 1 = spam/scam
    return {
        "risk_score": round(p, 4),
        "verdict": to_verdict(p),
        "category": "sms_scam" if p >= 0.7 else None,
        "confidence": round(max(p, 1 - p), 4),
        "source": "sms_model_v1",
    }

class TextRequest(BaseModel):
    text: str

@app.get("/health")
def health():
    return {"status": "ok", "text_model": "loaded", "url_model": "unavailable"}

@app.post("/predict/text")
def predict_text(req: TextRequest):
    return score_text(req.text)

@app.post("/predict/image")
async def predict_image(file: UploadFile = File(...)):
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes))
    extracted_text = pytesseract.image_to_string(image).strip()

    if not extracted_text:
        return {
            "risk_score": 0.0, "verdict": "pending", "category": None,
            "confidence": 0.0, "source": "image_ocr_empty", "extracted_text": "",
        }

    result = score_text(extracted_text)
    result["source"] = "sms_model_v1_via_ocr"
    result["extracted_text"] = extracted_text
    return result

@app.post("/predict/url")
def predict_url(req: TextRequest):
    # URL model is being fixed separately — return an honest, clearly-marked
    # "unavailable" response rather than a wrong or crashing one, so the
    # backend and frontend keep working normally for URL checks in the
    # meantime (they'll just show "pending" instead of a real verdict).
    return {
        "risk_score": 0.0,
        "verdict": "pending",
        "category": None,
        "confidence": 0.0,
        "source": "url_model_unavailable",
        "reasons": ["URL model is being retrained — not available yet."],
    }