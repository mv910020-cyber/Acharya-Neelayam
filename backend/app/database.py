"""
Database module for managing PostgreSQL connections and operations.
Handles user data persistence and database initialization.
"""

import logging
from contextlib import contextmanager
from typing import Optional, Dict, Iterator
from datetime import datetime, timezone

try:
    import psycopg
except ImportError:
    psycopg = None

from .config import get_database_url

logger = logging.getLogger(__name__)
IN_MEMORY_USERS: Dict[int, Dict] = {}
NEXT_IN_MEMORY_USER_ID = 1
AUTH_STORAGE_MODE = "memory"
AUTH_STORAGE_REASON = "PostgreSQL not configured"


def _summarize_exception(exc: Exception) -> str:
    return str(exc).splitlines()[0].strip()


def set_auth_storage_mode(mode: str, reason: str) -> None:
    global AUTH_STORAGE_MODE, AUTH_STORAGE_REASON
    if AUTH_STORAGE_MODE == mode and AUTH_STORAGE_REASON == reason:
        return

    AUTH_STORAGE_MODE = mode
    AUTH_STORAGE_REASON = reason
    if mode == "memory":
        logger.warning("Authentication storage fallback enabled: %s", reason)
    else:
        logger.info("Authentication storage ready: %s", reason)


def get_auth_storage_mode() -> str:
    return AUTH_STORAGE_MODE


def get_auth_storage_reason() -> str:
    return AUTH_STORAGE_REASON


def _make_memory_user(
    user_id: int,
    email: str,
    username: str,
    hashed_password: str,
    full_name: Optional[str],
) -> Dict:
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "id": user_id,
        "email": email,
        "username": username,
        "hashed_password": hashed_password,
        "full_name": full_name,
        "is_active": True,
        "created_at": timestamp,
    }


def _create_user_in_memory(
    email: str,
    username: str,
    hashed_password: str,
    full_name: Optional[str] = None,
) -> Dict:
    global NEXT_IN_MEMORY_USER_ID

    if any(user["email"] == email for user in IN_MEMORY_USERS.values()):
        raise ValueError(f"Email {email} already registered")
    if any(user["username"] == username for user in IN_MEMORY_USERS.values()):
        raise ValueError(f"Username {username} already taken")

    user = _make_memory_user(
        user_id=NEXT_IN_MEMORY_USER_ID,
        email=email,
        username=username,
        hashed_password=hashed_password,
        full_name=full_name,
    )
    IN_MEMORY_USERS[NEXT_IN_MEMORY_USER_ID] = user
    NEXT_IN_MEMORY_USER_ID += 1
    return {
        "id": user["id"],
        "email": user["email"],
        "username": user["username"],
        "full_name": user["full_name"],
        "created_at": user["created_at"],
    }


def _get_memory_user_by_email(email: str) -> Optional[Dict]:
    for user in IN_MEMORY_USERS.values():
        if user["email"] == email:
            return user.copy()
    return None


def _get_memory_user_by_username(username: str) -> Optional[Dict]:
    for user in IN_MEMORY_USERS.values():
        if user["username"] == username:
            return user.copy()
    return None


def _get_memory_user_by_id(user_id: int) -> Optional[Dict]:
    user = IN_MEMORY_USERS.get(user_id)
    return user.copy() if user else None


@contextmanager
def get_db_connection():
    """
    Context manager for PostgreSQL database connections.
    Ensures proper connection handling and cleanup.
    """
    if not psycopg:
        set_auth_storage_mode(
            "memory",
            "psycopg is not installed. Run `pip install -r backend/requirements.txt`.",
        )
        raise RuntimeError("psycopg is not installed. Run `pip install -r backend/requirements.txt`.")
    
    database_url = get_database_url()
    if not database_url:
        set_auth_storage_mode("memory", "DATABASE_URL is not set")
        raise RuntimeError(
            "DATABASE_URL is not set. Add it to backend/.env or the repo root .env."
        )

    try:
        conn = psycopg.connect(database_url)
    except Exception as exc:
        set_auth_storage_mode(
            "memory",
            f"Unable to connect to PostgreSQL: {_summarize_exception(exc)}",
        )
        raise RuntimeError("Unable to connect to the authentication database") from exc

    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        conn.close()


def initialize_database():
    """
    Initialize database schema for users and authentication.
    Creates users table if it doesn't exist.
    """
    if not get_database_url() or not psycopg:
        set_auth_storage_mode("memory", "DATABASE_URL not set or psycopg not installed")
        return False
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Create users table with all necessary fields
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        username VARCHAR(100) UNIQUE NOT NULL,
                        hashed_password VARCHAR(255) NOT NULL,
                        full_name VARCHAR(255),
                        is_active BOOLEAN DEFAULT true,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create index on email for faster lookups
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
                """)
                
                # Create index on username for faster lookups
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
                """)
                
                set_auth_storage_mode("postgres", "PostgreSQL connection established")
    except Exception as e:
        if AUTH_STORAGE_MODE != "memory":
            set_auth_storage_mode(
                "memory",
                f"Database initialization failed: {_summarize_exception(e)}",
            )
        return False

    return True


def create_user(email: str, username: str, hashed_password: str, full_name: Optional[str] = None) -> Dict:
    """
    Create a new user in the database.
    
    Args:
        email: User's email address
        username: Unique username
        hashed_password: Bcrypt hashed password
        full_name: User's full name (optional)
    
    Returns:
        Dictionary containing created user data
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO users (email, username, hashed_password, full_name)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, email, username, full_name, created_at
                """, (email, username, hashed_password, full_name))
                
                result = cur.fetchone()
                if result:
                    return {
                        "id": result[0],
                        "email": result[1],
                        "username": result[2],
                        "full_name": result[3],
                        "created_at": str(result[4])
                    }
    except RuntimeError:
        return _create_user_in_memory(email, username, hashed_password, full_name)
    except Exception as e:
        if psycopg is not None and isinstance(e, psycopg.IntegrityError):
            if "email" in str(e):
                raise ValueError(f"Email {email} already registered")
            if "username" in str(e):
                raise ValueError(f"Username {username} already taken")
            raise ValueError("User creation failed")

        logger.error(f"Error creating user: {e}")
        raise


def get_user_by_email(email: str) -> Optional[Dict]:
    """
    Retrieve user by email address.
    
    Args:
        email: User's email address
    
    Returns:
        User dictionary if found, None otherwise
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, email, username, hashed_password, full_name, is_active, created_at
                    FROM users
                    WHERE email = %s
                """, (email,))
                
                result = cur.fetchone()
                if result:
                    return {
                        "id": result[0],
                        "email": result[1],
                        "username": result[2],
                        "hashed_password": result[3],
                        "full_name": result[4],
                        "is_active": result[5],
                        "created_at": str(result[6])
                    }
    except RuntimeError:
        return _get_memory_user_by_email(email)
    except Exception as e:
        logger.error(f"Error retrieving user by email: {e}")
        raise
    
    return None


def get_user_by_username(username: str) -> Optional[Dict]:
    """
    Retrieve user by username.
    
    Args:
        username: User's username
    
    Returns:
        User dictionary if found, None otherwise
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, email, username, hashed_password, full_name, is_active, created_at
                    FROM users
                    WHERE username = %s
                """, (username,))
                
                result = cur.fetchone()
                if result:
                    return {
                        "id": result[0],
                        "email": result[1],
                        "username": result[2],
                        "hashed_password": result[3],
                        "full_name": result[4],
                        "is_active": result[5],
                        "created_at": str(result[6])
                    }
    except RuntimeError:
        return _get_memory_user_by_username(username)
    except Exception as e:
        logger.error(f"Error retrieving user by username: {e}")
        raise
    
    return None


def get_user_by_id(user_id: int) -> Optional[Dict]:
    """
    Retrieve user by ID.
    
    Args:
        user_id: User's database ID
    
    Returns:
        User dictionary if found, None otherwise
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, email, username, full_name, is_active, created_at
                    FROM users
                    WHERE id = %s
                """, (user_id,))
                
                result = cur.fetchone()
                if result:
                    return {
                        "id": result[0],
                        "email": result[1],
                        "username": result[2],
                        "full_name": result[3],
                        "is_active": result[4],
                        "created_at": str(result[5])
                    }
    except RuntimeError:
        return _get_memory_user_by_id(user_id)
    except Exception as e:
        logger.error(f"Error retrieving user by ID: {e}")
        raise
    
    return None
