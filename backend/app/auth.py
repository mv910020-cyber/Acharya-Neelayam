"""
Authentication module for JWT token generation, password hashing, and token validation.
Implements secure authentication using bcrypt for passwords and JWT for tokens.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict

import bcrypt
import jwt
from passlib.hash import pbkdf2_sha256

from .config import get_secret_key

logger = logging.getLogger(__name__)

# Security configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7


class AuthService:
    """
    Service class for authentication operations including password hashing and token management.
    """
    
    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hash a plain password using bcrypt.
        
        Args:
            password: Plain text password
        
        Returns:
            Bcrypt hashed password
        """
        return pbkdf2_sha256.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        Verify a plain password against its bcrypt hash.
        
        Args:
            plain_password: Plain text password to verify
            hashed_password: Bcrypt hashed password to compare against
        
        Returns:
            True if password matches, False otherwise
        """
        try:
            if hashed_password.startswith("$pbkdf2-sha256$"):
                return pbkdf2_sha256.verify(plain_password, hashed_password)

            if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
                return bcrypt.checkpw(
                    plain_password.encode("utf-8"),
                    hashed_password.encode("utf-8"),
                )
        except ValueError:
            logger.warning("Password verification failed because the stored hash is invalid")
            return False
        except Exception as exc:
            logger.warning("Password verification failed: %s", exc)
            return False

        logger.warning("Unsupported password hash format encountered")
        return False
    
    @staticmethod
    def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
        """
        Create a JWT access token.
        
        Args:
            data: Dictionary containing token claims (e.g., user_id, email)
            expires_delta: Optional custom expiration time
        
        Returns:
            Encoded JWT token string
        """
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire})
        
        try:
            encoded_jwt = jwt.encode(to_encode, get_secret_key(), algorithm=ALGORITHM)
            return encoded_jwt
        except Exception as e:
            logger.error(f"Error creating access token: {e}")
            raise
    
    @staticmethod
    def create_refresh_token(data: Dict) -> str:
        """
        Create a JWT refresh token with longer expiration.
        
        Args:
            data: Dictionary containing token claims
        
        Returns:
            Encoded JWT refresh token string
        """
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire, "type": "refresh"})
        
        try:
            encoded_jwt = jwt.encode(to_encode, get_secret_key(), algorithm=ALGORITHM)
            return encoded_jwt
        except Exception as e:
            logger.error(f"Error creating refresh token: {e}")
            raise
    
    @staticmethod
    def verify_token(token: str) -> Optional[Dict]:
        """
        Verify and decode a JWT token.
        
        Args:
            token: JWT token string to verify
        
        Returns:
            Decoded token claims if valid, None if invalid or expired
        """
        try:
            payload = jwt.decode(token, get_secret_key(), algorithms=[ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None
        except Exception as e:
            logger.error(f"Error verifying token: {e}")
            return None
    
    @staticmethod
    def extract_user_id_from_token(token: str) -> Optional[int]:
        """
        Extract user ID from a valid JWT token.
        
        Args:
            token: JWT token string
        
        Returns:
            User ID if token is valid, None otherwise
        """
        payload = AuthService.verify_token(token)
        if payload and "user_id" in payload:
            return payload.get("user_id")
        return None
