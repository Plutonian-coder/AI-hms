import re

with open("c:\\Users\\HomePC\\.gemini\\antigravity\\scratch\\AI-hms\\backend\\services\\email.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace _wrap_html
new_wrap = '''def _wrap_html(title, body_html):
    """Wraps email body in a branded HMS HTML template matching the Headspace aesthetic."""
    return f"""
    <div style="background-color: #f8f8f8; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            
            <!-- Logo Area -->
            <div style="margin-bottom: 30px;">
                <span style="display: inline-block; width: 24px; height: 24px; background-color: #f97316; border-radius: 50%; vertical-align: middle; margin-right: 8px;"></span>
                <span style="color: #111827; font-size: 22px; font-weight: 800; vertical-align: middle; letter-spacing: -0.5px;">hms portal</span>
            </div>

            <!-- Dynamic Content (Hero, Heading, Body, Button) -->
            {body_html}

            <!-- Footer Area -->
            <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #f3f4f6;">
                <p style="font-size: 12px; color: #6b7280; line-height: 1.6; margin: 0 0 20px 0;">
                    If you have any questions, please visit our <a href="{HMS_APP_URL}/faqs" style="color: #f97316; text-decoration: none; font-weight: bold;">FAQs</a> or email us at <a href="mailto:support@hms.com" style="color: #f97316; text-decoration: none; font-weight: bold;">support@hms.com</a>. Our team can answer questions about your account or help you with your hostel allocation.
                </p>
                <p style="font-size: 11px; color: #9ca3af; margin: 0;">
                    You have received this email as a registered user of HMS®<br>
                    Hostel Management System, Student Affairs Unit.<br>
                    © 2026 HMS Inc. All rights reserved.
                </p>
            </div>
        </div>
    </div>
    """
'''

content = re.sub(
    r'def _wrap_html\(title, body_html\):.*?return f"""(.*?)"""\n',
    new_wrap,
    content,
    flags=re.DOTALL
)

# 2. Refactor individual emails to use centered, clean aesthetic
# Registration Email
reg_body_old = r'''    body = f"""
        <h3 style="color: #111827; margin-top: 0;">Registration Successful</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS. Your account has been successfully created on the Hostel Management System for the current academic session.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0f3d24;">
            <p style="margin: 0;"><strong>Matriculation Number:</strong> {matric_number}</p>
        </div>
        <p>You can now log in to your dashboard to begin your hostel application.</p>
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/login" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">Log In to Your Dashboard</a>
        </div>
        <p style="font-size: 14px; color: #6b7280;">If you experience any issues, please reach out to the Student Affairs Unit.</p>
    """'''

reg_body_new = '''    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Registration<br>Successful</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            You're so close to starting your HMS journey, <strong>{first_name}</strong>. Your account has been created for the current academic session with matric number <strong>{matric_number}</strong>.
        </p>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 35px 0;">
            To finish setting up, just click the button below to log in and begin your hostel application.
        </p>
        <a href="{HMS_APP_URL}/login" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">Log in to my dashboard</a>
    """'''
content = content.replace(reg_body_old, reg_body_new)


# Application Submitted Email
app_sub_old = r'''    if has_special_needs:
        status_msg = """
            <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #92400E;">
                <p style="margin: 0; color: #92400E; font-weight: 600;">Your medical documentation is now under administrative review. You will be notified within 3–5 working days.</p>
            </div>
        """
    else:
        status_msg = """
            <div style="background-color: #DCFCE7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #166534;">
                <p style="margin: 0; color: #166534; font-weight: 600;">Your application is cleared and ready for the allocation process. You may now proceed to the compatibility quiz.</p>
            </div>
        """

    body = f"""
        <h3 style="color: #111827; margin-top: 0;">Application Received</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS. Your hostel application has been received successfully.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0f3d24;">
            <p style="margin: 0;"><strong>Matric Number:</strong> {matric_number}</p>
        </div>
        {status_msg}
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">View Your Dashboard</a>
        </div>
    """'''

app_sub_new = '''    if has_special_needs:
        status_msg = """
            <p style="color: #92400E; background-color: #FEF3C7; padding: 16px; border-radius: 12px; font-size: 15px; line-height: 1.5; margin: 0 0 35px 0;">
                <strong>Note:</strong> Your medical documentation is now under administrative review. You will be notified within 3–5 working days.
            </p>
        """
    else:
        status_msg = """
            <p style="color: #166534; background-color: #DCFCE7; padding: 16px; border-radius: 12px; font-size: 15px; line-height: 1.5; margin: 0 0 35px 0;">
                <strong>Cleared!</strong> Your application is ready for the allocation process. You may now proceed to the compatibility quiz.
            </p>
        """

    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Application<br>Received</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Great news, <strong>{first_name}</strong>. Your hostel application has been received successfully and is safely in our system.
        </p>
        {status_msg}
        <a href="{HMS_APP_URL}/" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">View my dashboard</a>
    """'''
content = content.replace(app_sub_old, app_sub_new)


# Medical Review Email
med_rev_old = r'''    if status == "approved":
        subject = "HMS — Medical Documentation Approved ✓"
        status_block = """
            <div style="background-color: #DCFCE7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #166534;">
                <p style="margin: 0; color: #166534; font-weight: 600;">Great news! Your medical documentation has been approved. You are now cleared for hostel allocation.</p>
            </div>
        """
    else:
        notes_html = f'<p style="margin: 8px 0 0 0; color: #92400E;"><strong>Admin notes:</strong> {notes}</p>' if notes else ""
        attempts_html = f'<p style="margin: 4px 0 0 0; color: #92400E; font-size: 13px;">You have <strong>{attempts_remaining}</strong> re-upload attempt(s) remaining.</p>' if attempts_remaining > 0 else '<p style="margin: 4px 0 0 0; color: #991B1B; font-size: 13px; font-weight: 600;">You have exhausted all upload attempts. Please contact the Student Affairs Unit.</p>'
        subject = "HMS — Medical Documentation Review Update"
        status_block = f"""
            <div style="background-color: #FEE2E2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #991B1B;">
                <p style="margin: 0; color: #991B1B; font-weight: 600;">Unfortunately, your documentation could not be verified.</p>
                {notes_html}
                {attempts_html}
            </div>
        """

    body = f"""
        <h3 style="color: #111827; margin-top: 0;">Medical Review Update</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS with an update on your medical documentation review.</p>
        {status_block}
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/apply" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">View Application Status</a>
        </div>
    """'''

med_rev_new = '''    if status == "approved":
        subject = "HMS — Medical Documentation Approved ✓"
        status_block = """
            <p style="color: #166534; background-color: #DCFCE7; padding: 16px; border-radius: 12px; font-size: 15px; line-height: 1.5; margin: 0 0 35px 0;">
                <strong>Approved!</strong> Your medical documentation is verified and you are now cleared for hostel allocation.
            </p>
        """
        title = "Review<br>Approved"
    else:
        notes_html = f'<p style="margin: 10px 0 0 0; color: #991B1B;"><strong>Note:</strong> {notes}</p>' if notes else ""
        attempts_html = f'<p style="margin: 10px 0 0 0; color: #991B1B; font-size: 14px;">You have <strong>{attempts_remaining}</strong> attempt(s) remaining.</p>' if attempts_remaining > 0 else '<p style="margin: 10px 0 0 0; color: #991B1B; font-weight: bold;">You have exhausted all attempts. Please contact Admin.</p>'
        subject = "HMS — Medical Documentation Review Update"
        status_block = f"""
            <div style="color: #991B1B; background-color: #FEE2E2; padding: 16px; border-radius: 12px; font-size: 15px; line-height: 1.5; margin: 0 0 35px 0; text-align: left;">
                <strong>Action required:</strong> Unfortunately, your documentation could not be verified.
                {notes_html}
                {attempts_html}
            </div>
        """
        title = "Review<br>Update"

    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">{title}</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Hi <strong>{first_name}</strong>, we have an update regarding your recent medical documentation submission.
        </p>
        {status_block}
        <a href="{HMS_APP_URL}/apply" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">Check my status</a>
    """'''
content = content.replace(med_rev_old, med_rev_new)

# Allocation Success
alloc_old = r'''    body = f"""
        <h3 style="color: #111827; margin-top: 0;">Bed Space Secured! 🎉</h3>
        <p>Dear {first_name},</p>
        <p>Congratulations! A bed space has been secured for you.</p>
        <div style="background-color: #DCFCE7; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #BBF7D0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Hostel</td><td style="padding: 6px 0; text-align: right; font-weight: 700; color: #111827;">{hostel}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Room</td><td style="padding: 6px 0; text-align: right; font-weight: 700; color: #111827;">{room}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Bed</td><td style="padding: 6px 0; text-align: right; font-weight: 700; color: #111827;">Bed {bed}</td></tr>
            </table>
        </div>
        <p>Please log in to view your invoice and complete payment.</p>
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/payment" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">View Invoice &amp; Pay</a>
        </div>
    """'''

alloc_new = '''    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Bed Space<br>Secured! 🎉</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Congratulations, <strong>{first_name}</strong>! We've successfully reserved a spot just for you.
        </p>
        <div style="background-color: #f9f9f9; padding: 24px; border-radius: 16px; margin: 0 0 35px 0;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Your Placement</p>
            <p style="margin: 0; font-size: 20px; font-weight: 800; color: #111827;">{hostel}</p>
            <p style="margin: 5px 0 0 0; font-size: 16px; color: #4b5563;">{room} • Bed {bed}</p>
        </div>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 35px 0;">
            The final step is to log in, view your invoice, and complete your payment to finalize the reservation.
        </p>
        <a href="{HMS_APP_URL}/payment" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">View my invoice</a>
    """'''
content = content.replace(alloc_old, alloc_new)


# Invoice
inv_old = r'''    body = f"""
        <h3 style="color: #111827; margin-top: 0;">Invoice Ready</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS. Your hostel accommodation invoice is now ready.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Total Amount</p>
            <p style="margin: 4px 0 0 0; font-size: 32px; font-weight: 900; color: #0f3d24;">₦{total_naira:,.2f}</p>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">Reference: {hms_ref}</p>
        </div>
        <p>Please log in to review the itemized breakdown and complete payment.</p>
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/payment" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">Review &amp; Pay</a>
        </div>
    """'''

inv_new = '''    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Invoice<br>Ready</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Hi <strong>{first_name}</strong>, your hostel accommodation invoice has been generated.
        </p>
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 16px; margin: 0 0 35px 0;">
            <p style="margin: 0 0 5px 0; font-size: 14px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Total Due</p>
            <p style="margin: 0; font-size: 40px; font-weight: 900; color: #111827; letter-spacing: -1px;">₦{total_naira:,.2f}</p>
            <p style="margin: 10px 0 0 0; font-size: 13px; color: #6b7280;">Ref: {hms_ref}</p>
        </div>
        <a href="{HMS_APP_URL}/payment" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">Pay my invoice</a>
    """'''
content = content.replace(inv_old, inv_new)

# Password Reset
pwd_old = r'''    body = f"""
        <h3 style="color: #111827; margin-top: 0;">Password Reset Request</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS. We received a request to reset your password on the Hostel Management System.</p>
        <p>Click the button below to set a new password. This link will <strong>expire in 15 minutes</strong>.</p>
        <div style="text-align: center; margin: 35px 0;">
            <a href="{reset_url}" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">Reset My Password</a>
        </div>
        <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #92400E;">
            <p style="margin: 0; color: #92400E; font-weight: 600; font-size: 13px;">If you did not request this reset, please ignore this email. Your password will remain unchanged.</p>
        </div>
        <p style="font-size: 13px; color: #6b7280;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="font-size: 12px; color: #9ca3af; word-break: break-all;">{reset_url}</p>
    """'''

pwd_new = '''    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Reset your<br>password</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 35px 0;">
            Hi <strong>{first_name}</strong>, we received a request to reset the password for your HMS account. Click the button below to create a new one. This link will expire in 15 minutes.
        </p>
        <a href="{reset_url}" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px; margin-bottom: 35px;">Reset my password</a>
        <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin: 0;">
            If you didn't ask to reset your password, you can safely ignore this email.
        </p>
    """'''
content = content.replace(pwd_old, pwd_new)

# Status Change
stat_old = r'''    body = f"""
        <h3 style="color: #111827; margin-top: 0;">Application Status Updated</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS. Your hostel application status has been updated by an administrator.</p>
        <div style="background-color: #EFF6FF; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #BFDBFE;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Previous Status</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #6b7280;">{old_label}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #1D4ED8; font-size: 13px; font-weight: 600;">New Status</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #1D4ED8;">{new_label}</td>
                </tr>
            </table>
        </div>
        {note_html}
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">View Your Dashboard</a>
        </div>
    """'''

stat_new = '''    note_html = ""
    if admin_note:
        note_html = f"""
            <div style="background-color: #f9f9f9; padding: 16px; border-radius: 12px; margin: 0 0 35px 0; text-align: left;">
                <p style="margin: 0; font-size: 14px; color: #4b5563;"><strong>Note:</strong> {admin_note}</p>
            </div>
        """

    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Status<br>Updated</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Hi <strong>{first_name}</strong>, your application status has been changed from <em>{old_label}</em> to <strong>{new_label}</strong>.
        </p>
        {note_html}
        <a href="{HMS_APP_URL}/" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">View my dashboard</a>
    """'''
content = content.replace(r'''    note_html = ""
    if admin_note:
        note_html = f"""
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #6b7280;">
                <p style="margin: 0; font-size: 13px; color: #374151;"><strong>Admin Note:</strong> {admin_note}</p>
            </div>
        """

''' + stat_old, stat_new)

# Allocation Revoked
rev_old = r'''    body = f"""
        <h3 style="color: #111827; margin-top: 0;">Allocation Revoked</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS. We regret to inform you that your hostel bed allocation has been revoked.</p>
        <div style="background-color: #FEE2E2; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #FECACA;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Hostel</td><td style="padding: 6px 0; text-align: right; font-weight: 700; color: #111827;">{hostel}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Room / Bed</td><td style="padding: 6px 0; text-align: right; font-weight: 700; color: #111827;">{room} / Bed {bed}</td></tr>
                <tr><td style="padding: 6px 0; color: #991B1B; font-size: 13px; font-weight: 600;">Reason</td><td style="padding: 6px 0; text-align: right; font-weight: 700; color: #991B1B;">{reason_label}</td></tr>
            </table>
        </div>
        {notes_html}
        <p style="font-size: 14px; color: #6b7280;">If you believe this is an error, please contact the Student Affairs Unit immediately.</p>
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">View Your Dashboard</a>
        </div>
    """'''

rev_new = '''    notes_html = ""
    if notes:
        notes_html = f"""
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #991B1B;"><strong>Details:</strong> {notes}</p>
        """

    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Allocation<br>Revoked</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Hi <strong>{first_name}</strong>, we regret to inform you that your hostel bed allocation has been revoked.
        </p>
        <div style="background-color: #FEE2E2; padding: 24px; border-radius: 16px; margin: 0 0 35px 0; text-align: left;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #991B1B; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">{reason_label}</p>
            <p style="margin: 0; font-size: 16px; font-weight: 800; color: #991B1B;">{hostel}</p>
            <p style="margin: 5px 0 0 0; font-size: 15px; color: #991B1B;">{room} • Bed {bed}</p>
            {notes_html}
        </div>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 35px 0;">
            If you believe this is an error, please reach out to the Student Affairs Unit immediately.
        </p>
        <a href="{HMS_APP_URL}/" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">View my dashboard</a>
    """'''
content = content.replace(r'''    notes_html = ""
    if notes:
        notes_html = f"""
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #6b7280;">
                <p style="margin: 0; font-size: 13px; color: #374151;"><strong>Details:</strong> {notes}</p>
            </div>
        """

''' + rev_old, rev_new)


with open("c:\\Users\\HomePC\\.gemini\\antigravity\\scratch\\AI-hms\\backend\\services\\email.py", "w", encoding="utf-8") as f:
    f.write(content)
