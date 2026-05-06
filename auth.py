from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from database import SessionLocal, Doctor
from datetime import datetime, timedelta
import pyotp
import qrcode
from io import BytesIO
import base64

SECRET_KEY = "osseoai-secret-change-in-production"
ALGORITHM  = "HS256"

pwd_ctx = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
oauth2  = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def hash_password(pw):      return pwd_ctx.hash(pw)
def verify_password(pw, h): return pwd_ctx.verify(pw, h)

# ═══════════════════════════════════════════════════════════
# 2FA - TOTP Functions
# ═══════════════════════════════════════════════════════════
def generate_2fa_secret():
    """Generate a new TOTP secret (base32 encoded)"""
    return pyotp.random_base32()

def get_totp(secret: str):
    """Get TOTP object from secret"""
    return pyotp.TOTP(secret)

def verify_totp(secret: str, token: str):
    """Verify a TOTP token against a secret"""
    totp = get_totp(secret)
    return totp.verify(token, valid_window=1)  # valid_window=1 allows 30 sec drift

def generate_qr_code(secret: str, email: str):
    """Generate QR code for 2FA setup"""
    totp = get_totp(secret)
    uri = totp.provisioning_uri(
        name=email,
        issuer_name='OsseoAI'
    )
    qr = qrcode.QRCode()
    qr.add_data(uri)
    qr.make()
    
    img = qr.make_image(fill_color="black", back_color="white")
    buf = BytesIO()
    img.save(buf, format='PNG')
    img_str = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

def create_token(doctor_id: int):
    payload = {
        "sub": str(doctor_id),
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_2fa_token(temp_token: str, totp_code: str):
    """Verify 2FA temp token and TOTP code, return full access token"""
    try:
        payload = jwt.decode(temp_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "2fa_temp":
            raise HTTPException(401, "Invalid token type")
        doc_id = int(payload["sub"])
    except (JWTError, KeyError):
        raise HTTPException(401, "Invalid or expired 2FA token")
    
    db = SessionLocal()
    doc = db.query(Doctor).filter(Doctor.id == doc_id).first()
    db.close()
    
    if not doc or not doc.two_factor_enabled or not doc.two_factor_secret:
        raise HTTPException(401, "2FA not enabled for this account")
    
    if not verify_totp(doc.two_factor_secret, totp_code):
        raise HTTPException(401, "Invalid 2FA code")
    
    return {
        "access_token": create_token(doc.id),
        "token_type": "bearer",
        **_doctor_to_dict(doc),
    }


def get_current_doctor(token: str = Depends(oauth2)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        doc_id  = int(payload["sub"])
    except (JWTError, KeyError):
        raise HTTPException(401, "Invalid token")
    db  = SessionLocal()
    doc = db.query(Doctor).filter(Doctor.id == doc_id).first()
    db.close()
    if not doc:
        raise HTTPException(401, "Doctor not found")
    return doc

def _doctor_to_dict(doc: Doctor):
    """Consistent dict shape that the frontend always expects."""
    return {
        "id":                    doc.id,
        "email":                 doc.email,
        "name":                  doc.full_name,   # frontend useAuth reads .name
        "full_name":             doc.full_name,
        "specialty":             doc.specialty,
        "hospital":              doc.hospital,
        "license_no":            doc.license_no,
        "role":                  doc.role,        # "doctor" | "admin"
        "approved":              doc.approved,
        "two_factor_enabled":    doc.two_factor_enabled,
    }

def login_user(email: str, password: str):
    db  = SessionLocal()
    doc = db.query(Doctor).filter(Doctor.email == email).first()
    db.close()
    if not doc or not verify_password(password, doc.password):
        raise HTTPException(401, "Wrong email or password")
    
    # If 2FA is enabled, return temp token for 2FA verification
    if doc.two_factor_enabled:
        temp_token = jwt.encode(
            {
                "sub": str(doc.id),
                "type": "2fa_temp",
                "exp": datetime.utcnow() + timedelta(minutes=5)
            },
            SECRET_KEY,
            algorithm=ALGORITHM
        )
        return {
            "requires_2fa": True,
            "temp_token": temp_token,
        }
    
    # 2FA not enabled, return normal token
    return {
        "access_token": create_token(doc.id),
        "token_type":   "bearer",
        **_doctor_to_dict(doc),
    }

def register_user(email: str, password: str, full_name: str,
                  specialty: str = "", hospital: str = "", license_no: str = ""):
    db = SessionLocal()
    if db.query(Doctor).filter(Doctor.email == email).first():
        db.close()
        raise HTTPException(400, "Email already registered")

    # First registered user becomes admin and is auto-approved
    is_first = db.query(Doctor).count() == 0
    doc = Doctor(
        email      = email,
        password   = hash_password(password),
        full_name  = full_name,
        specialty  = specialty,
        hospital   = hospital,
        license_no = license_no,
        role       = "admin" if is_first else "doctor",
        approved   = True if is_first else False,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    db.close()
    return {
        "access_token": create_token(doc.id),
        "token_type":   "bearer",
        **_doctor_to_dict(doc),
    }
