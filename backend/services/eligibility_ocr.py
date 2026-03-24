"""
Eligibility OCR Service — AI-powered document verification using Gemini Vision.

Verifies eligibility documents (acceptance fee, e-screening, school fees)
and extracts the student's matric/application number, RRR, and name for
identity matching and payment validation.
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

**EXTRACTION — extract ALL of these if visible**:
1. **Student Identifier**: Application Number or Matriculation Number (e.g. APP/2024/XXXX, YCT/XX/XX/XXXXX, F/HD/22/XXXX)
2. **RRR**: Remita Retrieval Reference — a 12-digit number (e.g. 310234567890). Look for "RRR", "Remita", or a standalone 12-digit number near payment details.
3. **Student Name**: The full name of the student as printed on the receipt.

Respond in this EXACT JSON format (no markdown, no code fences):
{"is_authentic": true, "extracted_identifier": "YCT/FE/22/00123", "extracted_rrr": "310234567890", "extracted_name": "JOHN DOE", "rejection_reason": null}
OR
{"is_authentic": false, "extracted_identifier": null, "extracted_rrr": null, "extracted_name": null, "rejection_reason": "Brief reason"}

Rules:
- Be strict but fair — real scanned/photographed receipts may be slightly blurry
- If authentic but you cannot find a field, set that field to null
- RRR must be EXACTLY 12 digits if present
- NEVER fabricate any values""",

    "e_screening": """You are a document verification AI for a Nigerian polytechnic hostel management system.

Analyze this uploaded image and determine if it is a genuine **E-Screening receipt or confirmation**.

A legitimate e-screening document should have MOST of these features:
- Institutional branding (polytechnic name, logo, or header)
- Clear mention of "e-screening", "screening fee", or "screening confirmation"
- Payment details or confirmation status
- Student name, application number, or matriculation number
- Official formatting (not handwritten, not fabricated)

**EXTRACTION — extract ALL of these if visible**:
1. **Student Identifier**: Application Number or Matriculation Number (e.g. APP/2024/XXXX, YCT/XX/XX/XXXXX, F/HD/22/XXXX)
2. **RRR**: Remita Retrieval Reference — a 12-digit number (e.g. 310234567890). Look for "RRR", "Remita", or a standalone 12-digit number near payment details.
3. **Student Name**: The full name of the student as printed on the document.

Respond in this EXACT JSON format (no markdown, no code fences):
{"is_authentic": true, "extracted_identifier": "YCT/FE/22/00123", "extracted_rrr": "310234567890", "extracted_name": "JOHN DOE", "rejection_reason": null}
OR
{"is_authentic": false, "extracted_identifier": null, "extracted_rrr": null, "extracted_name": null, "rejection_reason": "Brief reason"}

Rules:
- Be strict but fair — real scanned/photographed receipts may be slightly blurry
- If authentic but you cannot find a field, set that field to null
- RRR must be EXACTLY 12 digits if present
- NEVER fabricate any values""",

    "school_fees": """You are a document verification AI for a Nigerian polytechnic hostel management system.

Analyze this uploaded image and determine if it is a genuine **School Fees payment receipt**.

A legitimate school fees receipt should have MOST of these features:
- Institutional branding (polytechnic name, logo, or header)
- Clear mention of "school fees", "tuition", or "semester fees"
- Payment amount and date
- Student name and matriculation number
- Session/semester information
- Official formatting (not handwritten, not fabricated)

**EXTRACTION — extract ALL of these if visible**:
1. **Student Identifier**: Matriculation Number (e.g. YCT/XX/XX/XXXXX, F/HD/22/XXXX)
2. **RRR**: Remita Retrieval Reference — a 12-digit number (e.g. 310234567890). Look for "RRR", "Remita", or a standalone 12-digit number near payment details.
3. **Student Name**: The full name of the student as printed on the receipt.

Respond in this EXACT JSON format (no markdown, no code fences):
{"is_authentic": true, "extracted_identifier": "YCT/FE/22/00123", "extracted_rrr": "310234567890", "extracted_name": "JOHN DOE", "rejection_reason": null}
OR
{"is_authentic": false, "extracted_identifier": null, "extracted_rrr": null, "extracted_name": null, "rejection_reason": "Brief reason"}

Rules:
- Be strict but fair — real scanned/photographed receipts may be slightly blurry
- If authentic but you cannot find a field, set that field to null
- RRR must be EXACTLY 12 digits if present
- NEVER fabricate any values""",
}


def verify_eligibility_document(image_path: str, document_type: str) -> dict:
    """
    Use Gemini Vision to verify an eligibility document and extract
    the student identifier, RRR, and student name.

    Returns:
        {
            "is_authentic": bool,
            "extracted_identifier": str|None,
            "extracted_rrr": str|None,
            "extracted_name": str|None,
            "rejection_reason": str|None,
        }
    """
    if document_type not in PROMPTS:
        return {
            "is_authentic": False,
            "extracted_identifier": None,
            "extracted_rrr": None,
            "extracted_name": None,
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

        # Validate RRR format if present (must be exactly 12 digits)
        extracted_rrr = result.get("extracted_rrr")
        if extracted_rrr and not re.match(r'^\d{12}$', str(extracted_rrr)):
            extracted_rrr = None

        return {
            "is_authentic": bool(result.get("is_authentic", False)),
            "extracted_identifier": result.get("extracted_identifier"),
            "extracted_rrr": extracted_rrr,
            "extracted_name": result.get("extracted_name"),
            "rejection_reason": result.get("rejection_reason"),
        }

    except (json.JSONDecodeError, KeyError) as e:
        print(f"Eligibility OCR parse error: {e} — raw: {text}")
        return {
            "is_authentic": False,
            "extracted_identifier": None,
            "extracted_rrr": None,
            "extracted_name": None,
            "rejection_reason": "AI could not process this document. Please upload a clearer image.",
        }
    except Exception as e:
        print(f"Eligibility OCR error: {e}")
        return {
            "is_authentic": False,
            "extracted_identifier": None,
            "extracted_rrr": None,
            "extracted_name": None,
            "rejection_reason": "Document processing failed. Please try again.",
        }
