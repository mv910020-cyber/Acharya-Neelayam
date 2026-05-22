# Authentication System - Quick Start Guide

## Before You Start

Ensure you have:
- Python 3.8+ installed
- Node.js 16+ installed
- PostgreSQL running locally or accessible
- Terminal/Command line access

## 🚀 Quick Setup (5 minutes)

### Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create virtual environment (Python)
python -m venv .venv

# 3. Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Create backend/.env (copy from backend/.env.example)
# The backend also auto-loads the repo root .env, but backend/.env takes priority
# Edit with your actual database URL and SECRET_KEY
# Generate SECRET_KEY: python -c "import secrets; print(secrets.token_hex(32))"

# 6. Start backend server
python main.py
# Server runs on http://localhost:8000
```

### Frontend Setup

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Create .env.local (if needed)
# VITE_API_URL=/api

# 4. Start dev server
npm run dev
# Frontend runs on http://localhost:5173
```

## 🧪 Testing the Authentication Flow

### 1. Open Application

Visit `http://localhost:5173` in your browser. You should see the **Login Page**.

### 2. Register New User

1. Click "Sign up here" link
2. Fill in registration form:
   - Email: `testuser@example.com`
   - Username: `testuser`
   - Full Name: `Test User` (optional)
   - Password: `password123`
   - Confirm Password: `password123`
3. Click "Create Account"
4. Should redirect to home page with user greeting

### 3. Verify Authentication

- Check header shows "Hello Test User" and "Logout" button
- Cart icon should be visible
- All main navigation links should work

### 4. Logout

1. Click "Logout" button in header
2. Should redirect to login page
3. All routes blocked except /login and /register

### 5. Login Again

1. Click "Login here" link or go to http://localhost:5173/login
2. Enter credentials:
   - Email: `testuser@example.com`
   - Password: `password123`
3. Click "Login"
4. Should redirect to home page

### 6. Test Session Persistence

1. Refresh the page (Ctrl+R or Cmd+R)
2. Should remain logged in
3. User greeting should still show
4. Close and reopen browser - should still be logged in

## 📝 Testing with API Tools

### Using cURL

**Register:**
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "apitest@example.com",
    "username": "apitest",
    "password": "password123",
    "full_name": "API Test"
  }'
```

**Copy the access_token from response**

**Login:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "apitest@example.com",
    "password": "password123"
  }'
```

**Get Current User (replace TOKEN with access_token):**
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/api/auth/me
```

### Using Postman

1. Import the API calls above as Postman requests
2. For authenticated requests, add to Headers:
   - Key: `Authorization`
   - Value: `Bearer <access_token_from_login>`

## 🔍 Debugging

### Backend Issues

**Check logs:**
```bash
# Logs appear in terminal where you ran: python main.py
# Look for errors like:
# - DatabaseError: database connection failed
# - KeyError: SECRET_KEY not found
```

**Database connection failing:**
```bash
# Verify PostgreSQL is running
# psql -U postgres -d postgres

# Check DATABASE_URL in .env
# Example: postgresql://postgres:password@localhost:5432/my_app_db

# Create database if missing:
# createdb my_app_db
```

**SECRET_KEY error:**
```bash
# Generate new key:
python -c "import secrets; print(secrets.token_hex(32))"

# Add to .env:
SECRET_KEY=<generated-key>
```

### Frontend Issues

**Check browser console:**
- Press F12 or Cmd+Option+I to open DevTools
- Check Console tab for error messages
- Check Network tab to verify API calls

**API connection failing:**
```
# Verify backend is running on http://localhost:8000
# Verify VITE_API_URL in .env.local (if set)
# Check CORS errors in browser console
```

**Login page blank:**
```
# Check console for React errors
# Clear browser cache: Ctrl+Shift+Delete
# Verify npm dependencies installed: npm install
# Restart dev server: npm run dev
```

## 📊 Database Inspection

### View Users Table

```bash
# Connect to database
psql -U postgres -d my_app_db

# View users
SELECT id, email, username, full_name, is_active, created_at FROM users;

# View specific user
SELECT * FROM users WHERE email = 'testuser@example.com';

# Check password hash (don't worry, it's encrypted)
SELECT username, hashed_password FROM users LIMIT 1;

# Exit
\q
```

## 🔐 Security Tips

**In Development:**
- Change SECRET_KEY to random value
- Don't commit .env file
- Use strong test passwords

**Before Production:**
- Generate strong SECRET_KEY: `python -c "import secrets; print(secrets.token_hex(32))"`
- Use environment variables for all secrets
- Enable HTTPS
- Set secure CORS origins
- Use strong database password
- Regular database backups
- Enable rate limiting on auth endpoints

## 📚 Important Files

**Backend:**
- `backend/main.py` - Main app initialization
- `backend/app/auth.py` - JWT and password logic
- `backend/app/routes_auth.py` - API endpoints
- `backend/requirements.txt` - Dependencies
- `.env` - Environment configuration (create from .env.example)

**Frontend:**
- `frontend/src/context/AuthContext.tsx` - Auth state management
- `frontend/src/components/LoginPage.tsx` - Login form
- `frontend/src/App.tsx` - Route protection
- `frontend/.env.local` - API URL configuration

**Documentation:**
- `docs/AUTHENTICATION.md` - Full technical documentation
- `docs/QUICKSTART.md` - This file

## ✅ Checklist for First Run

- [ ] Python and Node.js installed
- [ ] PostgreSQL database created
- [ ] Backend `requirements.txt` installed
- [ ] Backend `.env` file created with DATABASE_URL and SECRET_KEY
- [ ] Backend server running (http://localhost:8000)
- [ ] Frontend `npm install` completed
- [ ] Frontend dev server running (http://localhost:5173)
- [ ] Can see login page at http://localhost:5173
- [ ] Can register new user successfully
- [ ] Can login with registered credentials
- [ ] Session persists after page refresh
- [ ] Can logout and redirect to login page

## 🆘 Getting Help

1. Check `docs/AUTHENTICATION.md` for detailed documentation
2. Review error messages in browser console and server logs
3. Check database schema: `\dt users` in psql
4. Verify all files were created: `git status`
5. Review environment variables in `.env` and `.env.local`

## 🎉 Success!

If you've completed all steps and can:
1. Register a new account
2. Login with credentials
3. See protected pages (home, products, etc.)
4. See logout button in header
5. Logout and be redirected to login

**Congratulations! Authentication is working correctly! 🎊**

Next steps:
- Customize login/register page styling
- Add password reset functionality
- Implement email verification
- Add OAuth providers (Google, GitHub, etc.)
- Set up production deployment
