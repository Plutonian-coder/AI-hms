import os
import resend
import logging

# Set the API key.
resend.api_key = os.getenv("RESEND_API_KEY", "re_95mKVxjX_JG846AxTWjYkyYXmfutEj7mH")

SENDER_EMAIL = "onboarding@resend.dev"

def send_registration_email(to_email: str, first_name: str, matric_number: str):
    """
    Sends a beautifully formatted HTML welcome email to a newly registered student.
    """
    try:
        params = {
            "from": f"HMS Portal <{SENDER_EMAIL}>",
            "to": [to_email],  # <--- This uses the exact email the student typed in!
            "subject": "Welcome to the HMS Portal - Registration Successful",
            "html": f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                <div style="background-color: #0f3d24; padding: 30px 20px; text-align: center;">
                    <h2 style="color: #ecfccb; margin: 0; font-size: 24px; font-weight: 900; tracking: tight;">HMS PORTAL</h2>
                </div>
                <div style="padding: 30px 20px; color: #374151; line-height: 1.6;">
                    <h3 style="color: #111827; margin-top: 0;">Registration Successful</h3>
                    <p>Dear {first_name},</p>
                    <p>Your account has been successfully created on the Hostel Management System for the current academic session.</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0f3d24;">
                        <p style="margin: 0;"><strong>Matriculation Number:</strong> {matric_number}</p>
                    </div>
                    <p>You can now log in to your dashboard to view your itemised fee breakdown and proceed with your hostel application.</p>
                    <div style="text-align: center; margin: 35px 0;">
                        <a href="https://ai-hms-nine.vercel.app/login" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">Log In to Your Dashboard</a>
                    </div>
                    <p style="font-size: 14px; color: #6b7280;">If you experience any issues, please reach out to the Student Affairs Unit.</p>
                </div>
            </div>
            """
        }
        
        response = resend.Emails.send(params)
        logging.info(f"Registration email sent to {to_email}. Resend ID: {response.get('id')}")
        return response
    except Exception as e:
        logging.error(f"Failed to send email to {to_email}: {str(e)}")