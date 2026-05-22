"""
Pydantic models for authentication request/response validation.
Ensures type safety and data validation for all authentication operations.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UserRegisterRequest(BaseModel):
    """Request model for user registration."""
    email: EmailStr = Field(..., description="User's email address")
    username: str = Field(..., min_length=3, max_length=100, description="Unique username")
    password: str = Field(..., min_length=8, description="Password (minimum 8 characters)")
    full_name: Optional[str] = Field(None, max_length=255, description="User's full name")


class UserLoginRequest(BaseModel):
    """Request model for user login."""
    email: str = Field(..., description="User's email address")
    password: str = Field(..., description="User's password")


class TokenResponse(BaseModel):
    """Response model containing authentication tokens."""
    access_token: str = Field(..., description="JWT access token")
    refresh_token: Optional[str] = Field(None, description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    user: "UserResponse" = Field(..., description="User information")


class UserResponse(BaseModel):
    """Response model containing user information (safe data)."""
    id: int = Field(..., description="User ID")
    email: str = Field(..., description="User's email")
    username: str = Field(..., description="User's username")
    full_name: Optional[str] = Field(None, description="User's full name")
    is_active: bool = Field(default=True, description="Whether user is active")


class TokenVerifyRequest(BaseModel):
    """Request model for token verification."""
    token: str = Field(..., description="JWT token to verify")


class TokenVerifyResponse(BaseModel):
    """Response model for token verification."""
    valid: bool = Field(..., description="Whether token is valid")
    user_id: Optional[int] = Field(None, description="User ID from token")
    expires_at: Optional[str] = Field(None, description="Token expiration timestamp")


class ChangePasswordRequest(BaseModel):
    """Request model for changing user password."""
    current_password: str = Field(..., description="User's current password")
    new_password: str = Field(..., min_length=8, description="New password")
