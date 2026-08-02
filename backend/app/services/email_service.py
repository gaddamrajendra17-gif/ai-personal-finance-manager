import os
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional
from app.core.config import settings

MOCK_EMAIL_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "mock_emails.json"))

def save_mock_email(to_email: str, subject: str, html_body: str):
    """Save email locally in development mode."""
    emails = []
    if os.path.exists(MOCK_EMAIL_FILE):
        try:
            with open(MOCK_EMAIL_FILE, "r", encoding="utf-8") as f:
                emails = json.load(f)
        except Exception:
            pass

    new_email = {
        "id": str(len(emails) + 1),
        "to": to_email,
        "subject": subject,
        "body": html_body,
        "sent_at": datetime.utcnow().isoformat()
    }
    emails.insert(0, new_email)  # Show newest first

    try:
        with open(MOCK_EMAIL_FILE, "w", encoding="utf-8") as f:
            json.dump(emails, f, indent=2)
        print(f"[Email Simulator] Sent email to {to_email}. Saved in mock_emails.json")
    except Exception as e:
        print(f"[Email Simulator] Error saving email: {e}")

def get_mock_emails():
    """Retrieve simulated inbox."""
    if not os.path.exists(MOCK_EMAIL_FILE):
        return []
    try:
        with open(MOCK_EMAIL_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def clear_mock_emails():
    """Clear all simulated emails."""
    try:
        if os.path.exists(MOCK_EMAIL_FILE):
            os.remove(MOCK_EMAIL_FILE)
            print("[Email Simulator] Simulated inbox cleared.")
    except Exception as e:
        print(f"[Email Simulator] Error clearing: {e}")

def send_email_reminder(to_email: str, subject: str, html_content: str):
    """
    Send an email via SMTP if configured, otherwise fall back to Simulated Sandbox.
    """
    smtp_host = getattr(settings, "SMTP_HOST", None)
    smtp_port = getattr(settings, "SMTP_PORT", 587)
    smtp_user = getattr(settings, "SMTP_USER", None)
    smtp_password = getattr(settings, "SMTP_PASSWORD", None)
    smtp_from = getattr(settings, "SMTP_FROM", "noreply@pfm-ai.com")

    # If no SMTP configured, use simulation mode
    if not smtp_host or smtp_host == "smtp.example.com":
        save_mock_email(to_email, subject, html_content)
        return True

    # Real SMTP delivery
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_from
        msg["To"] = to_email

        part = MIMEText(html_content, "html")
        msg.attach(part)

        # Connection setup
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.ehlo()
        server.starttls()
        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)

        server.sendmail(smtp_from, to_email, msg.as_string())
        server.quit()
        print(f"Successfully sent email to {to_email}")
        return True
    except Exception as e:
        print(f"Failed to send email via SMTP: {e}. Falling back to simulator.")
        save_mock_email(to_email, f"[SMTP Fallback] {subject}", html_content)
        return False
