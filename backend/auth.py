"""
Authentication utilities for password hashing and verification
Version: 2.0 - Fixed bcrypt 72-byte limit
"""

from passlib.context import CryptContext
from typing import Optional
from fastapi import Cookie, HTTPException, status

# Password hashing context with auto-truncation
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__ident="2b",  # Use bcrypt variant 2b
    truncate_error=True  # Auto-truncate passwords longer than max length
)


def hash_password(password: str) -> str:
    """Hash a password (truncates to 72 bytes for bcrypt compatibility)"""
    # Bcrypt has a max password length of 72 bytes
    # Encode and truncate at byte level, then decode safely
    password_bytes = password.encode('utf-8')[:72]
    # Decode, ignoring any incomplete multi-byte sequences at the end
    truncated_password = password_bytes.decode('utf-8', errors='ignore')
    print(f"[DEBUG] Original password length: {len(password)} chars, {len(password.encode('utf-8'))} bytes")
    print(f"[DEBUG] Truncated password length: {len(truncated_password)} chars, {len(truncated_password.encode('utf-8'))} bytes")
    return pwd_context.hash(truncated_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash (truncates to 72 bytes for bcrypt compatibility)"""
    # Bcrypt has a max password length of 72 bytes
    # Encode and truncate at byte level, then decode safely
    password_bytes = plain_password.encode('utf-8')[:72]
    # Decode, ignoring any incomplete multi-byte sequences at the end
    truncated_password = password_bytes.decode('utf-8', errors='ignore')
    return pwd_context.verify(truncated_password, hashed_password)


async def get_current_user_id(user_id: Optional[str] = Cookie(None)) -> int:
    """Dependency to get current user ID from cookie"""
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    try:
        return int(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user session"
        )
