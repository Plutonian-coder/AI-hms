"""
Eligibility OCR Service — AI-powered document verification using Gemini Vision.

Verifies eligibility documents (acceptance fee, e-screening, school fees)
and extracts the student's matric/application number for identity matching.
"""
import re
import json
import google.generativeai as genai
from PIL import Image
from config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash")


PROMPTS = {
    "acceptance_fee": """You are a document verification AI for a Nigerian polytechnic hostel management system.

Analyze this uploaded image and determine if it is a genuine **Acceptance Fee receipt**.

A legitimate acceptance fee receipt should have MOST of these features:
- Institutional branding (polytechnic name, logo, or header)
- Clear mention of "acceptance fee" or "admission acceptance"
- Payment amount and date
- Student name, application number, or matriculation number
- Official formatting (not handwritten, not fabricated)

**EXTRACTION**: Find the student's Application Number or Matriculation Number on the receipt.
Look for patterns like: APP/2024/XXXX, YCT/XX/XX/XXXXX, or similar institutional ID formats.

Respond in this EXACT JSON format (no markdown, no code fences):
{"is_authentic": true, "extracted_identifier": "YCT/FE/22/00123", "rejection_reason": null}
OR
{"is_authentic": false, "extracted_identifier": null, "rejection_reason": "Brief reason"}

Rules:
- Be strict but fair — real scanned/photographed receipts may be slightly blurry
- If authentic but you cannot find a clear identifier, set extracted_identifier to null
- NEVER fabricate an identifier""",

    "e_screening": """You are a document verification AI for a Nigerian polytechnic hostel management system.

Analyze this uploaded image and determine if it is a genuine **E-Screening receipt or confirmation**.

A legitimate e-screening document should have MOST of these features:
- Institutional branding (polytechnic name, logo, or header)
- Clear mention of "e-screening", "screening fee", or "screening confirmation"
- Payment details or confirmation status
- Student name, application number, or matriculation number
- Official formatting (not handwritten, not fabricated)

**EXTRACTION**: Find the student's Application Number or Matriculation Number on the document.
Look for patterns like: APP/2024/XXXX, YCT/XX/XX/XXXXX, or similar institutional ID formats.

Respond in this EXACT JSON format (no markdown, no code fences):
{"is_authentic": true, "extracted_identifier": "YCT/FE/22/00123", "rejection_reason": null}
OR
{"is_authentic": false, "extracted_identifier": null, "rejection_reason": "Brief reason"}

Rules:
- Be strict but fair — real scanned/photographed receipts may be slightly blurry
- If authentic but you cannot find a clear identifier, set extracted_identifier to null
- NEVER fabricate an identifier""",

    "school_fees": """You are a document verification AI for a Nigerian polytechnic hostel management system.

Analyze this uploaded image and determine if it is a genuine **School Fees payment receipt**.

A legitimate school fees receipt should have MOST of these features:
- Institutional branding (polytechnic name, logo, or header)
- Clear mention of "school fees", "tuition", or "semester fees"
- Payment amount and date
- Student name and matriculation number
- Session/semester information
- Official formatting (not handwritten, not fabricated)

**EXTRACTION**: Find the student's Matriculation Number on the receipt.
Look for patterns like: YCT/XX/XX/XXXXX, F/HD/22/XXXX, or similar institutional ID formats.

Respond in this EXACT JSON format (no markdown, no code fences):
{"is_authentic": true, "extracted_identifier": "YCT/FE/22/00123", "rejection_reason": null}
OR
{"is_authentic": false, "extracted_identifier": null, "rejection_reason": "Brief reason"}

Rules:
- Be strict but fair — real scanned/photographed receipts may be slightly blurry
- If authentic but you cannot find a clear identifier, set extracted_identifier to null
- NEVER fabricate an identifier""",
}


def verify_eligibility_document(image_path: str, document_type: str) -> dict:
    """
    Use Gemini Vision to verify an eligibility document and extract the student identifier.

    Returns:
        {"is_authentic": bool, "extracted_identifier": str|None, "rejection_reason": str|None}
    """
    if document_type not in PROMPTS:
        return {
            "is_authentic": False,
            "extracted_identifier": None,
            "rejection_reason": f"Unknown document type: {document_type}",
        }

    try:
        img = Image.open(image_path)
        response = model.generate_content([PROMPTS[document_type], img])
        text = response.text.strip()

        # Strip markdown code fences if Gemini wraps the JSON
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)

        result = json.loads(text)

        return {
            "is_authentic": bool(result.get("is_authentic", False)),
            "extracted_identifier": result.get("extracted_identifier"),
            "rejection_reason": result.get("rejection_reason"),
        }

    except (json.JSONDecodeError, KeyError) as e:
        print(f"Eligibility OCR parse error: {e} — raw: {text}")
        return {
            "is_authentic": False,
            "extracted_identifier": None,
            "rejection_reason": "AI could not process this document. Please upload a clearer image.",
        }
    except Exception as e:
        print(f"Eligibility OCR error: {e}")
        return {
            "is_authentic": False,
            "extracted_identifier": None,
            "rejection_reason": "Document processing failed. Please try again.",
        }
