import bcrypt

MIN_PASSWORD_LENGTH = 8


def hash_password(password: str) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def hash_pin(pin: str) -> str:
    """Hash a 4-digit PIN. Length is validated upstream by Pydantic."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pin.encode(), salt).decode()


def verify_pin(plain: str, hashed: str) -> bool:
    """Verify a PIN against its hash."""
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False
