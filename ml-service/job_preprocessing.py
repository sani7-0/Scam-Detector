"""
Preprocessing for the FraudJobGuard job-posting model. Extracted directly
from the training notebook's make_text() — must stay byte-identical to
what the model was trained on, since this determines the exact token
stream the TF-IDF vectorizer sees.

Usable on a single plain-text string (e.g. a user-pasted job description
with no structured fields) by passing everything else empty — the
function already defaults missing/blank fields gracefully.
"""
from __future__ import annotations
import re
import pandas as pd

TEXT_FIELDS = ['title', 'company_profile', 'description', 'requirements', 'benefits']
CAT_FIELDS = ['location', 'department', 'employment_type', 'required_experience', 'required_education', 'industry', 'function']
BIN_FIELDS = ['telecommuting', 'has_company_logo', 'has_questions']
SUSPICIOUS_TERMS = [
    'money order', 'wire transfer', 'cashier check', 'bitcoin', 'cryptocurrency',
    'western union', 'processing fee', 'application fee', 'registration fee',
    'training fee', 'send money', 'bank account', 'bank details', 'credit card',
    'social security', 'ssn', 'gift card', 'guaranteed income', 'quick money'
]
EMAIL_RE = re.compile(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}')
URL_RE = re.compile(r'https?://|www\.', re.I)
PHONE_RE = re.compile(r'\+?\d[\d\s().-]{7,}\d')


def make_text(df: pd.DataFrame) -> pd.Series:
    x = df.copy()
    for c in TEXT_FIELDS + CAT_FIELDS:
        if c not in x.columns:
            x[c] = ''
        x[c] = x[c].fillna('').astype(str).str.strip()
    for c in BIN_FIELDS:
        if c not in x.columns:
            x[c] = 0
        x[c] = pd.to_numeric(x[c], errors='coerce').fillna(0).astype(int)

    caps = {'title': 400, 'company_profile': 600, 'description': 1800, 'requirements': 1400, 'benefits': 800}
    parts = [c + ': ' + x[c].str.slice(0, caps[c]) for c in TEXT_FIELDS]
    parts += [c + '_category: ' + x[c].str.slice(0, 250) for c in CAT_FIELDS]
    text = pd.concat(parts, axis=1).agg(' '.join, axis=1)

    missing = x[TEXT_FIELDS].eq('').sum(axis=1)
    url_count = text.str.count(URL_RE)
    email_count = text.str.count(EMAIL_RE)
    phone_count = text.str.count(PHONE_RE)
    text_len_bin = (text.str.len() // 250).clip(0, 20)
    exclamation_bin = text.str.count('!').clip(0, 8)
    lower = text.str.lower()
    suspicious_count = pd.Series(0, index=text.index, dtype='int64')
    flags = []
    for term in SUSPICIOUS_TERMS:
        hit = lower.str.count(re.escape(term))
        suspicious_count += hit
        flags.append((term, hit))

    extras = (
        ' __telecommute_' + x['telecommuting'].astype(str)
        + ' __logo_' + x['has_company_logo'].astype(str)
        + ' __questions_' + x['has_questions'].astype(str)
        + ' __missing_' + missing.astype(str)
        + ' __textlen_' + text_len_bin.astype(str)
        + ' __urls_' + url_count.clip(0, 5).astype(str)
        + ' __emails_' + email_count.clip(0, 5).astype(str)
        + ' __phones_' + phone_count.clip(0, 5).astype(str)
        + ' __exclaim_' + exclamation_bin.astype(str)
        + ' __suspicious_' + suspicious_count.clip(0, 8).astype(str)
    )
    for term, hit in flags:
        extras = extras + hit.gt(0).map({True: ' __flag_' + term.replace(' ', '_'), False: ''})
    return (text + extras).astype(str)


def text_to_job_input(raw_text: str) -> pd.DataFrame:
    """Wraps a single plain-text string as a one-row DataFrame usable by
    make_text(), treating it as the 'description' field with everything
    else left empty/default."""
    return pd.DataFrame([{"description": raw_text}])