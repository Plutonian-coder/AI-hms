"""
Receipt Validation Service — AI-powered receipt validation and RRR extraction.

This service does TWO things in a single Gemini call:
1. Verifies the image looks like a legitimate Remita/school fee receipt
2. Extracts the 12-digit RRR number if the receipt passes validation

12-Factor Compliant:
  - Factor IV:  Lazy Gemini initialization
  - Factor XI:  Structured logging to stdout
"""
import re
import json
import logging

logger = logging.getLogger(__name__)

# ── Lazy Gemini initialization (Factor IV) ───────────────────────────────────
_model = None


def _get_model():
    """Lazy-init Gemini model — only created on first use."""
    global _model
    if _model is None:
        import google.generativeai as genai
        from config import GEMINI_API_KEY
        genai.configure(api_key=GEMINI_API_KEY)
        _model = genai.GenerativeModel("gemini-2.5-flash")
        logger.info("Gemini model initialized for receipt validation")
    return _model


VALIDATION_PROMPT = """You are a fraud detection AI for a Nigerian university hostel payment system.

Analyze this uploaded image and perform TWO checks:

**CHECK 1 — AUTHENTICITY**: Determine if this image is a genuine Remita payment receipt or school fee receipt.
A legitimate receipt should have MOST of these features:
- Remita branding, logo, or header
- A clearly printed 12-digit RRR (Remita Retrieval Reference)
- Payment details (amount, payer name, date)
- An institutional reference (school name, faculty, department)
- Official formatting (not handwritten, not a screenshot of a text editor, not a plain image of numbers)

Flag as FRAUDULENT if:
- The image is not a receipt at all (random photo, blank page, meme, etc.)
- The image is clearly fabricated (numbers typed in a text editor, photoshopped, hand-drawn)
- There is no Remita or payment context surrounding the number
- The image only contains a bare number with no receipt context

**CHECK 2 — EXTRACTION**: If authentic, extract the 12-digit RRR number.

Respond in this EXACT JSON format (no markdown, no code fences):
{"is_authentic": true, "rrr": "310234567890", "rejection_reason": null}
OR
{"is_authentic": false, "rrr": null, "rejection_reason": "Brief reason why it was rejected"}

Rules:
- The RRR is exactly 12 digits
- If authentic but you cannot find a clear 12-digit RRR, set rrr to null
- Be strict but fair — real scanned/photographed receipts may be slightly blurry
- NEVER fabricate an RRR number"""


def extract_rrr(image_path: str) -> dict:
    """
    Use Gemini to validate receipt authenticity AND extract the RRR.

    Returns a dict:
        {"is_authentic": bool, "rrr": str|None, "rejection_reason": str|None}
    """
    try:
        from PIL import Image
        model = _get_model()
        img = Image.open(image_path)
        response = model.generate_content([VALIDATION_PROMPT, img])
        text = response.text.strip()

        # Strip markdown code fences if Gemini wraps the JSON
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)

        result = json.loads(text)

        # Validate the RRR format if one was returned
        if result.get("rrr"):
            rrr = str(result["rrr"]).strip()
            if not re.fullmatch(r'\d{12}', rrr):
                result["rrr"] = None

        return {
            "is_authentic": bool(result.get("is_authentic", False)),
            "rrr": result.get("rrr"),
            "rejection_reason": result.get("rejection_reason"),
        }

    except (json.JSONDecodeError, KeyError) as e:
        logger.error("Receipt validation parse error: %s — raw: %s", e, text)
        return {"is_authentic": False, "rrr": None, "rejection_reason": "AI could not process this image. Please upload a clearer receipt."}
    except Exception as e:
        logger.error("Receipt validation error: %s", e, exc_info=True)
        return {"is_authentic": False, "rrr": None, "rejection_reason": "Receipt processing failed. Please try again."}
