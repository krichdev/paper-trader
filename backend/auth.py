"""
Authentication utilities for password hashing and verification
"""

from passlib.context import CryptContext
from typing import Optional
from fastapi import Cookie, HTTPException, status

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password (truncates to 72 characters for bcrypt compatibility)"""
    # Bcrypt has a max password length of 72 bytes - truncate string to be safe
    return pwd_context.hash(password[:72])


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash (truncates to 72 characters for bcrypt compatibility)"""
    # Bcrypt has a max password length of 72 bytes - truncate string to be safe
    return pwd_context.verify(plain_password[:72], hashed_password)


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
