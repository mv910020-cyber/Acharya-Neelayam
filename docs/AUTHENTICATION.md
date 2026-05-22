# Authentication System Documentation

## Overview

This document describes the comprehensive authentication system implemented for the Aachara Nilayam application. The system provides secure user registration, login, and session management using JWT tokens and bcrypt password hashing.

## Architecture

### Technology Stack

**Backend:**
- FastAPI (Python web framework)
- PostgreSQL (User data persistence)
- JWT (JSON Web Tokens for stateless authentication)
- Bcrypt (Password hashing)
- Python-jose (JWT encoding/decoding)
- Passlib (Password hashing library)

**Frontend:**
- React (UI framework)
- TypeScript (Type safety)
- React Router (Navigation and route protection)
- Axios (HTTP client)
- Context API (State management)

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**Indexes:**
- `idx_users_email` - Fast lookup by email
- `idx_users_username` - Fast lookup by username

## Backend Implementation

### Directory Structure

```
backend/app/
├── __init__.py
├── main.py              # Main FastAPI application
├── auth.py              # Authentication service (password hashing, JWT)
├── database.py          # Database operations for users
├── models.py            # Pydantic models for validation
└── routes_auth.py       # Authentication endpoints
```

### Key Modules

#### 1. `auth.py` - Authentication Service

Provides JWT token generation, password hashing, and token verification.

**Key Functions:**
- `hash_password(password)` - Hash password using bcrypt
- `verify_password(plain, hashed)` - Verify password against hash
- `create_access_token(data)` - Generate JWT access token (30 min expiry)
- `create_refresh_token(data)` - Generate refresh token (7 day expiry)
- `verify_token(token)` - Verify and decode JWT token
- `extract_user_id_from_token(token)` - Extract user ID from token

**Configuration:**
```python
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
```

#### 2. `database.py` - Database Operations

Manages PostgreSQL connections and user CRUD operations.

**Key Functions:**
- `initialize_database()` - Create users table and indexes on startup
- `create_user(email, username, hashed_password, full_name)` - Add new user
- `get_user_by_email(email)` - Retrieve user by email
- `get_user_by_username(username)` - Retrieve user by username
- `get_user_by_id(user_id)` - Retrieve user by ID

**Error Handling:**
- Unique constraint violations return meaningful error messages
- All database errors are logged and handled gracefully

#### 3. `models.py` - Pydantic Models

Validates all request/response data with type safety.

**Request Models:**
- `UserRegisterRequest` - Registration form validation
- `UserLoginRequest` - Login form validation
- `TokenVerifyRequest` - Token verification request
- `ChangePasswordRequest` - Password change request

**Response Models:**
- `TokenResponse` - Returns access/refresh tokens and user info
- `UserResponse` - Returns safe user data (no passwords)
- `TokenVerifyResponse` - Token validity and expiration info

#### 4. `routes_auth.py` - Authentication Endpoints

REST API endpoints for authentication operations.

**Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create new user account |
| `/api/auth/login` | POST | Authenticate user and get tokens |
| `/api/auth/logout` | POST | Logout user (server-side cleanup) |
| `/api/auth/verify-token` | POST | Verify JWT token validity |
| `/api/auth/me` | GET | Get current authenticated user info |

**Request/Response Examples:**

**Register:**
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "username",
    "password": "secure_password_8+chars",
    "full_name": "Full Name"
  }'
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "username",
    "full_name": "Full Name",
    "is_active": true
  }
}
```

**Login:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure_password_8+chars"
  }'
```

### Security Features

1. **Password Security**
   - Bcrypt hashing with salt (automatic)
   - Passwords never stored in plain text
   - Password verification uses constant-time comparison

2. **JWT Tokens**
   - Signed with SECRET_KEY
   - Include expiration time (exp claim)
   - Include user ID and email as claims
   - Access tokens expire after 30 minutes
   - Refresh tokens expire after 7 days

3. **Database Security**
   - Parameterized queries prevent SQL injection
   - Unique constraints on email and username
   - Indexed email and username for fast lookups
   - User inactive status can disable access

4. **API Security**
   - CORS middleware restricts origins
   - Authorization header validation
   - Bearer token scheme enforcement
   - HTTP-only cookie support (optional)

## Frontend Implementation

### Directory Structure

```
frontend/src/
├── context/
│   └── AuthContext.tsx      # Authentication state and API client
├── components/
│   ├── LoginPage.tsx        # Login form component
│   ├── LoginPage.css        # Shared auth page styles
│   └── RegisterPage.tsx     # Registration form component
├── App.tsx                  # Main app with route protection
└── auth-styles.css          # Header auth styles
```

### Key Components

#### 1. `AuthContext.tsx` - Authentication Context

Provides global authentication state and API integration.

**Context Value:**
```typescript
interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email, password) => Promise<void>;
  register: (email, username, password, fullName) => Promise<void>;
  logout: () => Promise<void>;
  verifyToken: () => Promise<boolean>;
}
```

**Features:**
- Automatic token persistence in localStorage
- Token restoration on app reload
- Automatic API client creation with auth headers
- Global error handling
- Loading state management

**Usage:**
```typescript
const { user, login, logout, isAuthenticated } = useAuth();
```

#### 2. `LoginPage.tsx` - Login Component

User login form with email and password.

**Features:**
- Email and password validation
- Password visibility toggle
- Error message display
- Loading state during submission
- Redirect to home on success
- Link to registration page

**Form Fields:**
- Email (required, valid format)
- Password (required, 8+ characters)
- Show/hide password toggle

#### 3. `RegisterPage.tsx` - Registration Component

New user account creation form.

**Features:**
- Comprehensive form validation
- Email uniqueness check
- Username availability check
- Password confirmation matching
- Full name optional field
- Password visibility toggles
- Automatic login after registration
- Form error display

**Form Fields:**
- Email (required, unique, valid format)
- Username (required, 3-100 chars, unique)
- Full Name (optional)
- Password (required, 8+ chars)
- Confirm Password (must match)

#### 4. `App.tsx` - Route Protection

Main app component with authentication routing.

**Route Logic:**
- If not authenticated: show only /login and /register routes
- If authenticated: show main app with all routes
- Cart only visible when authenticated
- Header shows user greeting and logout button when authenticated
- Automatic redirect to login on logout

**Header Changes:**
- **Unauthenticated:** Show Login and Sign Up buttons
- **Authenticated:** Show user greeting and Logout button

### Token Management

**Storage:**
- Access token stored in localStorage
- Refresh token stored in localStorage
- Tokens cleared on logout

**Automatic Restoration:**
- AuthProvider checks localStorage on mount
- Validates token with backend
- Restores user session if token is valid
- Falls back to login page if token invalid/expired

**API Integration:**
- All API requests include Authorization header
- Format: `Authorization: Bearer <token>`
- Automatic header addition via Axios interceptor
- Token refresh on 401 responses (optional enhancement)

## Setup and Configuration

### Backend Setup

1. **Install Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and secret key
   ```

3. **Generate Secret Key**
   ```bash
   # Generate a secure random key
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

4. **Create Database**
   ```sql
   CREATE DATABASE my_app_db;
   -- Tables are created automatically on first run
   ```

5. **Run Server**
   ```bash
   python main.py
   # Or with uvicorn
   uvicorn app.main:app --reload
   ```

### Frontend Setup

1. **Configure Environment**
   ```bash
   cd frontend
   cp .env.example .env.local
   # Edit .env.local if backend is not on localhost:8000
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Dev Server**
   ```bash
   npm run dev
   ```

### Docker Deployment

Update `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/my_app
      - SECRET_KEY=<generate-secure-key>
      - CORS_ORIGINS=["http://frontend:5173"]
  
  frontend:
    environment:
      - VITE_API_URL=http://backend:8000
```

## API Testing

### Using cURL

**Register:**
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123",
    "full_name": "Test User"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Get Current User (with token):**
```bash
curl -H "Authorization: Bearer TOKEN_HERE" \
  http://localhost:8000/api/auth/me
```

### Using Postman

1. Create POST request to `http://localhost:8000/api/auth/register`
2. Set Body type to JSON
3. Add registration data
4. Send request and copy access_token from response
5. For authenticated requests, add header:
   - Key: `Authorization`
   - Value: `Bearer <access_token>`

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 400 Bad Request | Invalid input data | Check form validation, email format, password length |
| 400 Email already registered | Email exists | Use different email or login |
| 400 Username already taken | Username exists | Choose different username |
| 401 Unauthorized | Invalid credentials | Check email/password |
| 401 Invalid token | Token expired or malformed | Login again |
| 422 Validation Error | Missing/invalid fields | Check required fields |
| 500 Internal Server Error | Database issue | Check server logs and database connection |

### Logging

Backend logs are output to console:
```
[logging] Database error: connection failed
[logging] Registration error: Email already exists
```

Frontend errors are caught and displayed to users with actionable messages.

## Future Enhancements

### Short Term
- [ ] Token refresh endpoint for extending sessions
- [ ] Password reset via email
- [ ] Email verification on registration
- [ ] Rate limiting on auth endpoints
- [ ] Account deactivation

### Medium Term
- [ ] OAuth 2.0 integration (Google, GitHub)
- [ ] Two-factor authentication (2FA)
- [ ] Session management UI
- [ ] User profile editing
- [ ] Password change endpoint

### Long Term
- [ ] Social login providers
- [ ] Biometric authentication
- [ ] Role-based access control (RBAC)
- [ ] Permission system
- [ ] Audit logging

## Security Checklist

- [x] Passwords hashed with bcrypt
- [x] JWT tokens for stateless auth
- [x] Access token expiration (30 min)
- [x] Token signing with secret key
- [x] SQL injection prevention (parameterized queries)
- [x] Unique email and username constraints
- [x] Authorization header validation
- [x] CORS protection
- [x] Error messages don't leak info
- [x] Inactive user status check
- [ ] HTTPS in production
- [ ] Rate limiting per IP
- [ ] Database encryption at rest
- [ ] Log authentication events
- [ ] Regular security audits

## Maintenance Guide

### Adding New Authenticated Routes

1. **Backend:** Use `get_current_user` dependency in route
   ```python
   @app.get("/api/protected")
   async def protected_route(current_user: dict = Depends(get_current_user)):
       return {"message": f"Hello {current_user['email']}"}
   ```

2. **Frontend:** Routes automatically protected by AppShell logic
   - All routes except /login and /register require authentication
   - User is redirected to login if not authenticated

### Modifying Token Expiration

1. **Backend:** Update `auth.py`
   ```python
   ACCESS_TOKEN_EXPIRE_MINUTES = 60  # Change from 30
   REFRESH_TOKEN_EXPIRE_DAYS = 14    # Change from 7
   ```

2. Frontend doesn't need changes - uses backend timing

### Database Backup

```bash
# Backup users table
pg_dump -U username -d my_app_db -t users > users_backup.sql

# Restore
psql -U username -d my_app_db < users_backup.sql
```

## Support and Troubleshooting

### Frontend Issues

**Blank login page:**
- Check browser console for errors
- Verify VITE_API_URL is set correctly
- Check CORS configuration on backend

**Login fails with "Invalid credentials":**
- Verify correct email and password
- Check if user exists in database
- Check server logs for errors

**Token expired, forced logout:**
- This is expected after 30 minutes
- User must login again
- This is a security feature

### Backend Issues

**Database connection error:**
- Check DATABASE_URL environment variable
- Verify PostgreSQL is running
- Check database credentials

**CORS errors:**
- Check CORS_ORIGINS environment variable
- Ensure frontend URL is included
- Verify frontend is making requests to correct API URL

**JWT decode errors:**
- Verify SECRET_KEY is set and consistent
- Check token hasn't been modified
- Check server time is synchronized

## File Locations Reference

```
backend/
├── app/
│   ├── auth.py              # JWT & bcrypt logic
│   ├── database.py          # User CRUD & DB schema
│   ├── models.py            # Request/response validation
│   ├── routes_auth.py       # API endpoints
│   └── main.py              # App initialization
├── requirements.txt         # Dependencies

frontend/
├── src/
│   ├── context/
│   │   └── AuthContext.tsx  # Global auth state
│   ├── components/
│   │   ├── LoginPage.tsx
│   │   ├── LoginPage.css
│   │   └── RegisterPage.tsx
│   ├── App.tsx              # Route protection
│   └── auth-styles.css      # Header styles
└── .env.example             # Config template
```

## Questions or Issues?

Check the logs, verify configuration, and review this documentation for solutions.
