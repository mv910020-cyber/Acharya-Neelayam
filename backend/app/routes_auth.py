"""
Authentication routes for user registration, login, token verification, and logout.
Implements REST endpoints for authentication operations.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends, Header

from .auth import AuthService
from .database import create_user, get_user_by_email, get_user_by_id
from .models import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserResponse,
    TokenVerifyRequest,
    TokenVerifyResponse,
)

logger = logging.getLogger(__name__)

# Create API router for authentication endpoints
auth_router = APIRouter(prefix="/api/auth", tags=["authentication"])


def raise_auth_storage_unavailable() -> None:
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Authentication storage is unavailable. Configure DATABASE_URL and ensure PostgreSQL is reachable.",
    )


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Dependency to get current authenticated user from JWT token.
    
    Args:
        authorization: Authorization header containing "Bearer <token>"
    
    Returns:
        User information dictionary
    
    Raises:
        HTTPException: If token is invalid or user not found
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise ValueError("Invalid authentication scheme")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify token
    payload = AuthService.verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not contain user ID",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    try:
        user = get_user_by_id(user_id)
    except RuntimeError:
        raise_auth_storage_unavailable()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    
    return user


@auth_router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    responses={
        400: {"description": "Invalid input or user already exists"},
        500: {"description": "Server error during registration"},
    }
)
async def register(request: UserRegisterRequest) -> TokenResponse:
    """
    Register a new user account.
    
    - **email**: Must be a valid email address and unique
    - **username**: Must be 3-100 characters and unique
    - **password**: Must be at least 8 characters
    - **full_name**: Optional full name
    
    Returns JWT access and refresh tokens along with user information.
    """
    try:
        # Check if user already exists
        existing_user = get_user_by_email(request.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        
        # Hash password
        hashed_password = AuthService.hash_password(request.password)
        
        # Create user in database
        user = create_user(
            email=request.email,
            username=request.username,
            hashed_password=hashed_password,
            full_name=request.full_name,
        )
        
        # Create tokens
        access_token = AuthService.create_access_token(
            data={"user_id": user["id"], "email": user["email"]}
        )
        refresh_token = AuthService.create_refresh_token(
            data={"user_id": user["id"], "email": user["email"]}
        )
        
        user_response = UserResponse(
            id=user["id"],
            email=user["email"],
            username=user["username"],
            full_name=user["full_name"],
            is_active=True,
        )
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=user_response,
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except RuntimeError:
        raise_auth_storage_unavailable()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed",
        )


@auth_router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login user",
    responses={
        401: {"description": "Invalid email or password"},
        500: {"description": "Server error during login"},
    }
)
async def login(request: UserLoginRequest) -> TokenResponse:
    """
    Authenticate a user and return JWT tokens.
    
    - **email**: User's registered email
    - **password**: User's password
    
    Returns JWT access and refresh tokens along with user information.
    """
    try:
        # Get user by email
        user = get_user_by_email(request.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        
        # Verify password
        if not AuthService.verify_password(request.password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        
        # Check if user is active
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive",
            )
        
        # Create tokens
        access_token = AuthService.create_access_token(
            data={"user_id": user["id"], "email": user["email"]}
        )
        refresh_token = AuthService.create_refresh_token(
            data={"user_id": user["id"], "email": user["email"]}
        )
        
        user_response = UserResponse(
            id=user["id"],
            email=user["email"],
            username=user["username"],
            full_name=user["full_name"],
            is_active=user.get("is_active", True),
        )
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=user_response,
        )
    
    except HTTPException:
        raise
    except RuntimeError:
        raise_auth_storage_unavailable()
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed",
        )


@auth_router.post(
    "/verify-token",
    response_model=TokenVerifyResponse,
    summary="Verify JWT token",
)
async def verify_token(request: TokenVerifyRequest) -> TokenVerifyResponse:
    """
    Verify the validity of a JWT token.
    
    - **token**: JWT token to verify
    
    Returns whether the token is valid and user information if valid.
    """
    payload = AuthService.verify_token(request.token)
    
    if not payload:
        return TokenVerifyResponse(valid=False)
    
    user_id = payload.get("user_id")
    expires_at = payload.get("exp")
    
    return TokenVerifyResponse(
        valid=True,
        user_id=user_id,
        expires_at=str(expires_at) if expires_at else None,
    )


@auth_router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
)
async def get_current_user_info(current_user: dict = Depends(get_current_user)) -> UserResponse:
    """
    Get information about the currently authenticated user.
    
    Requires valid JWT token in Authorization header.
    """
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        username=current_user["username"],
        full_name=current_user.get("full_name"),
        is_active=current_user.get("is_active", True),
    )


@auth_router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout user",
)
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout the current user.
    
    Note: In JWT-based authentication, logout is typically handled on the client side
    by removing the token. This endpoint serves as a confirmation point and can be used
    for server-side token blacklisting if implemented.
    
    Requires valid JWT token in Authorization header.
    """
    logger.info(f"User {current_user['email']} logged out")
    # In a production system, you might want to:
    # 1. Add token to a blacklist
    # 2. Log the logout event
    # 3. Clear any server-side session data
    return None
