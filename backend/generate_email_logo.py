from PIL import Image
import io

img = Image.open(r'c:\Users\HomePC\.gemini\antigravity\scratch\AI-hms\frontend\public\fuoye-logo.png')
img = img.resize((64, 64), Image.LANCZOS)
img.save(r'c:\Users\HomePC\.gemini\antigravity\scratch\AI-hms\backend\fuoye_logo_email.png', format='PNG', optimize=True)
print("Saved fuoye_logo_email.png")
