# Quick Fix Guide

## Current Issues

### 1. PostgreSQL Password Authentication Failed

**Problem:** The password `pkdon123` is not working for the `postgres` user.

**Solutions:**

#### Option A: Find the Correct Password
1. Open **pgAdmin 4** (should be installed with PostgreSQL)
2. Try to connect to the PostgreSQL server
3. If it asks for a password, try these common ones:
   - `pkdon123`
   - `postgres`
   - `admin`
   - (blank/empty)
4. Once you find the correct password, update `.env` file:
   ```
   DATABASE_URL="postgresql://postgres:CORRECT_PASSWORD@localhost:5432/khaacho?schema=public"
   ```

#### Option B: Reset PostgreSQL Password
1. Open **pgAdmin 4**
2. Right-click on **PostgreSQL 18** server
3. Go to **Properties** → **Connection**
4. Set a new password: `pkdon123`
5. Save and reconnect

#### Option C: Create Database Manually
1. Open **pgAdmin 4**
2. Connect to PostgreSQL server
3. Right-click on **Databases**
4. Select **Create** → **Database**
5. Name it: `khaacho`
6. Click **Save**

### 2. Redis Not Running

**Problem:** Redis is required for background jobs but not installed/running.

**Solutions:**

#### Option A: Use Docker (Recommended)
1. Start **Docker Desktop**
2. Wait for it to fully start (check system tray icon)
3. Run in PowerShell:
   ```powershell
   docker run -d --name redis -p 6379:6379 redis:latest
   ```

#### Option B: Install Redis for Windows
1. Download from: https://github.com/microsoftarchive/redis/releases
2. Install and start the Redis service

#### Option C: Disable Background Jobs (Temporary)
1. Edit `.env` file
2. Change:
   ```
   ENABLE_BACKGROUND_JOBS=false
   WHATSAPP_ASYNC=false
   ASYNC_NOTIFICATIONS=false
   ```

## Step-by-Step Manual Setup

### 1. Fix PostgreSQL Connection
```powershell
# Test connection (replace PASSWORD with correct one)
$env:PGPASSWORD='PASSWORD'
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "SELECT 1;"
```

### 2. Create Database
```powershell
# Once connection works
$env:PGPASSWORD='PASSWORD'
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE khaacho;"
```

### 3. Update .env File
```env
DATABASE_URL="postgresql://postgres:CORRECT_PASSWORD@localhost:5432/khaacho?schema=public"
```

### 4. Start Redis
```powershell
# Start Docker Desktop first, then:
docker run -d --name redis -p 6379:6379 redis:latest
```

### 5. Run Migrations
```powershell
npm run db:migrate:deploy
```

### 6. Seed Database (Optional)
```powershell
npm run db:seed
```

### 7. Start Application
```powershell
npm run dev
```

## Verification Commands

```powershell
# Check PostgreSQL is running
Get-Service postgresql-x64-18

# Check Docker is running
docker ps

# Check Redis container
docker ps --filter "name=redis"

# Test database connection
npm run db:generate

# Check if migrations are needed
npm run db:migrate:deploy
```

## Common Errors

### "password authentication failed"
→ Wrong password in DATABASE_URL. Check pgAdmin or reset password.

### "Cannot connect to Docker daemon"
→ Docker Desktop is not running. Start it from Start Menu.

### "Redis connection failed"
→ Redis container not running. Start Docker and run Redis container.

### "Prisma schema validation error"
→ Already fixed! The schema has been updated.

## Need Help?

1. Check PostgreSQL password in pgAdmin
2. Make sure Docker Desktop is running
3. Update .env with correct credentials
4. Run the automated setup script:
   ```powershell
   .\setup-complete.ps1
   ```
