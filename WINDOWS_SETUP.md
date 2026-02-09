# Windows Setup Guide for Khaacho Platform

## Prerequisites Installation

### 1. Install Node.js and npm
Already installed ✓

### 2. Install PostgreSQL

**Download:**
- Go to https://www.postgresql.org/download/windows/
- Download PostgreSQL installer (version 15 or higher)
- Run installer and remember your password

**Add to PATH:**
```powershell
# Add PostgreSQL to PATH (replace version number if different)
$env:Path += ";C:\Program Files\PostgreSQL\15\bin"
# Make it permanent
[Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::User)
```

**Verify:**
```powershell
psql --version
```

### 3. Install Redis for Windows

**Option 1: Using WSL (Recommended)**
```powershell
# Install WSL if not already installed
wsl --install

# In WSL terminal:
sudo apt-get update
sudo apt-get install redis-server
redis-server --daemonize yes
```

**Option 2: Memurai (Redis alternative for Windows)**
- Download from https://www.memurai.com/
- Install and start service

**Option 3: Skip Redis (Use in-memory fallback)**
- The system will work without Redis
- Background jobs will use in-memory queue
- Set in .env: `ENABLE_BACKGROUND_JOBS=false`

## Project Setup

### 1. Install Dependencies
```powershell
npm install
```

### 2. Install Prisma CLI Globally (Optional)
```powershell
npm install -g prisma
```

Or use npx:
```powershell
npx prisma --version
```

### 3. Create Database
```powershell
# Connect to PostgreSQL (you'll be prompted for password)
psql -U postgres

# In psql prompt:
CREATE DATABASE khaacho;
\q
```

### 4. Configure Environment
```powershell
# Copy example env file
Copy-Item .env.example .env

# Edit .env file with your settings
notepad .env
```

**Update these values in .env:**
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/khaacho?schema=public"
JWT_SECRET=your-random-secret-key-here
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 5. Run Migrations

**Method 1: Using Prisma (Recommended)**
```powershell
# Generate Prisma client
npx prisma generate

# Run Prisma migrations
npx prisma migrate dev --name init
```

**Method 2: Run SQL files directly**
```powershell
# Run each migration file
Get-Content prisma/migrations/001_initial_schema.sql | & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d khaacho

Get-Content prisma/migrations/002_performance_views.sql | & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d khaacho

Get-Content prisma/migrations/003_security_policies.sql | & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d khaacho

Get-Content prisma/migrations/004_order_status_log.sql | & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d khaacho

Get-Content prisma/migrations/005_performance_indexes.sql | & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d khaacho

Get-Content prisma/migrations/006_financial_metrics.sql | & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d khaacho
```

**Method 3: Using pgAdmin (GUI)**
1. Open pgAdmin
2. Connect to your PostgreSQL server
3. Right-click on khaacho database → Query Tool
4. Open each migration file and execute

### 6. Seed Database
```powershell
npm run db:seed
```

### 7. Start Development Server
```powershell
npm run dev
```

## Troubleshooting

### Issue: 'psql' is not recognized

**Solution 1: Add to PATH**
```powershell
# Find PostgreSQL installation
Get-ChildItem "C:\Program Files\PostgreSQL" -Recurse -Filter psql.exe

# Add to PATH (replace with your version)
$env:Path += ";C:\Program Files\PostgreSQL\15\bin"
```

**Solution 2: Use full path**
```powershell
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d khaacho
```

**Solution 3: Use pgAdmin GUI**
- Open pgAdmin
- Use Query Tool to run SQL files

### Issue: 'prisma' is not recognized

**Solution 1: Use npx**
```powershell
npx prisma generate
npx prisma migrate dev
npx prisma studio
```

**Solution 2: Install globally**
```powershell
npm install -g prisma
```

**Solution 3: Use npm scripts**
```powershell
npm run db:generate
npm run db:migrate
npm run db:studio
```

### Issue: Redis not available

**Solution: Disable Redis features**
```env
# In .env file
ENABLE_BACKGROUND_JOBS=false
ASYNC_NOTIFICATIONS=false
```

The system will use in-memory fallback for queues.

### Issue: Port already in use

**Find process using port:**
```powershell
netstat -ano | findstr :3000
```

**Kill process:**
```powershell
taskkill /PID <PID> /F
```

### Issue: Database connection failed

**Check PostgreSQL is running:**
```powershell
Get-Service -Name postgresql*
```

**Start PostgreSQL:**
```powershell
Start-Service postgresql-x64-15
```

**Test connection:**
```powershell
psql -U postgres -d khaacho -c "SELECT version();"
```

## Quick Start Script

Create `setup.ps1`:
```powershell
# Khaacho Platform Setup Script

Write-Host "Installing dependencies..." -ForegroundColor Green
npm install

Write-Host "Generating Prisma client..." -ForegroundColor Green
npx prisma generate

Write-Host "Creating database..." -ForegroundColor Green
$env:PGPASSWORD = Read-Host "Enter PostgreSQL password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($env:PGPASSWORD)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
$env:PGPASSWORD = $PlainPassword

& psql -U postgres -c "CREATE DATABASE khaacho;"

Write-Host "Running migrations..." -ForegroundColor Green
npx prisma migrate dev --name init

Write-Host "Seeding database..." -ForegroundColor Green
npm run db:seed

Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "Run 'npm run dev' to start the server" -ForegroundColor Yellow
```

Run it:
```powershell
.\setup.ps1
```

## Development Workflow

### Daily Development
```powershell
# Start PostgreSQL (if not running)
Start-Service postgresql-x64-15

# Start Redis (if using WSL)
wsl redis-server --daemonize yes

# Start development server
npm run dev

# In another terminal, start workers (optional)
node src/workers/whatsapp.worker.js
node src/workers/order.worker.js
```

### Database Management
```powershell
# View database in browser
npm run db:studio

# Create new migration
npx prisma migrate dev --name migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View database schema
npx prisma db pull
```

### Testing
```powershell
# Test API health
curl http://localhost:3000/api/v1/health

# Test with Postman or Insomnia
# Import API_DOCUMENTATION.md for endpoints
```

## Production Deployment

See DEPLOYMENT.md for Render deployment instructions.

## Additional Tools

### Recommended VS Code Extensions
- Prisma
- PostgreSQL
- REST Client
- ESLint
- Prettier

### Database GUI Tools
- pgAdmin (included with PostgreSQL)
- DBeaver (free, cross-platform)
- TablePlus (paid, but nice UI)

## Getting Help

If you encounter issues:
1. Check logs in `logs/` directory
2. Review error messages carefully
3. Check DATABASE_SCHEMA.md for schema details
4. Review TESTING_GUIDE.md for testing procedures
