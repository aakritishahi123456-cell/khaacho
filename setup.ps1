# Khaacho Platform Setup Script for Windows
# Run this script to set up the project

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Khaacho Platform Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check npm
Write-Host "Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✓ npm installed: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Check if .env exists
Write-Host ""
Write-Host "Checking environment configuration..." -ForegroundColor Yellow
if (!(Test-Path .env)) {
    Write-Host "Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host "⚠ Please edit .env file with your database credentials" -ForegroundColor Yellow
    Write-Host "  - Update DATABASE_URL with your PostgreSQL password" -ForegroundColor Yellow
    Write-Host "  - Update JWT_SECRET with a random string" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Press Enter after updating .env file, or type 'skip' to continue anyway"
    if ($continue -eq 'skip') {
        Write-Host "Continuing without .env configuration..." -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ .env file exists" -ForegroundColor Green
}

# Generate Prisma client
Write-Host ""
Write-Host "Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Prisma client generated" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}

# Check PostgreSQL
Write-Host ""
Write-Host "Checking PostgreSQL..." -ForegroundColor Yellow
try {
    $psqlPath = Get-Command psql -ErrorAction Stop
    Write-Host "✓ PostgreSQL found: $($psqlPath.Source)" -ForegroundColor Green
    
    # Ask if user wants to create database
    Write-Host ""
    $createDb = Read-Host "Do you want to create the database now? (y/n)"
    if ($createDb -eq 'y') {
        Write-Host "Creating database 'khaacho'..." -ForegroundColor Yellow
        $username = Read-Host "Enter PostgreSQL username (default: postgres)"
        if ([string]::IsNullOrWhiteSpace($username)) {
            $username = "postgres"
        }
        
        psql -U $username -c "CREATE DATABASE khaacho;"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Database created" -ForegroundColor Green
        } else {
            Write-Host "⚠ Database might already exist or creation failed" -ForegroundColor Yellow
        }
        
        # Run migrations
        Write-Host ""
        $runMigrations = Read-Host "Do you want to run migrations now? (y/n)"
        if ($runMigrations -eq 'y') {
            Write-Host "Running Prisma migrations..." -ForegroundColor Yellow
            npx prisma migrate dev --name init
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Migrations completed" -ForegroundColor Green
            } else {
                Write-Host "✗ Migrations failed" -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "✗ PostgreSQL (psql) not found in PATH" -ForegroundColor Red
    Write-Host "  Please install PostgreSQL or add it to your PATH" -ForegroundColor Yellow
    Write-Host "  Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
}

# Check Redis
Write-Host ""
Write-Host "Checking Redis..." -ForegroundColor Yellow
try {
    $redisPath = Get-Command redis-server -ErrorAction Stop
    Write-Host "✓ Redis found: $($redisPath.Source)" -ForegroundColor Green
} catch {
    Write-Host "⚠ Redis not found" -ForegroundColor Yellow
    Write-Host "  Redis is optional. The system will use in-memory fallback." -ForegroundColor Yellow
    Write-Host "  To install Redis:" -ForegroundColor Yellow
    Write-Host "  - Option 1: Use WSL: wsl --install, then sudo apt-get install redis-server" -ForegroundColor Yellow
    Write-Host "  - Option 2: Download Memurai from https://www.memurai.com/" -ForegroundColor Yellow
    Write-Host "  - Option 3: Disable in .env: ENABLE_BACKGROUND_JOBS=false" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Setup Summary" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Ensure .env file is configured with your database credentials" -ForegroundColor White
Write-Host "2. Create database if not done: psql -U postgres -c 'CREATE DATABASE khaacho;'" -ForegroundColor White
Write-Host "3. Run migrations: npx prisma migrate dev --name init" -ForegroundColor White
Write-Host "4. Seed database: npm run db:seed" -ForegroundColor White
Write-Host "5. Start server: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "For detailed instructions, see WINDOWS_SETUP.md" -ForegroundColor Yellow
Write-Host ""
Write-Host "Admin panel will be available at: http://localhost:3000/admin" -ForegroundColor Cyan
Write-Host ""
