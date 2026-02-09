# Khaacho Platform - Complete Setup Script
Write-Host "=== Khaacho Platform Setup ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Node.js
Write-Host "Step 1: Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version
Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
Write-Host ""

# Step 2: Check PostgreSQL
Write-Host "Step 2: Checking PostgreSQL..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -eq "Running") {
    Write-Host "PostgreSQL is running" -ForegroundColor Green
} else {
    Write-Host "PostgreSQL is not running" -ForegroundColor Red
    Write-Host "Please start PostgreSQL service" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 3: Test PostgreSQL Connection
Write-Host "Step 3: Testing PostgreSQL connection..." -ForegroundColor Yellow
Write-Host "Attempting to connect with password: pkdon123" -ForegroundColor Gray

$env:PGPASSWORD = 'pkdon123'
$testConnection = & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "SELECT 1;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "PostgreSQL connection successful" -ForegroundColor Green
    
    # Check if database exists
    Write-Host "Checking if khaacho database exists..." -ForegroundColor Gray
    $dbCheck = & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -t -c "SELECT 1 FROM pg_database WHERE datname='khaacho';" 2>&1
    
    if ($dbCheck -match "1") {
        Write-Host "Database khaacho already exists" -ForegroundColor Green
    } else {
        Write-Host "Creating database khaacho..." -ForegroundColor Gray
        & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE khaacho;" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Database khaacho created successfully" -ForegroundColor Green
        } else {
            Write-Host "Failed to create database" -ForegroundColor Red
        }
    }
} else {
    Write-Host "PostgreSQL connection failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "TROUBLESHOOTING:" -ForegroundColor Yellow
    Write-Host "1. Open pgAdmin 4" -ForegroundColor White
    Write-Host "2. Try to connect to PostgreSQL" -ForegroundColor White
    Write-Host "3. If password is different, update .env file with correct password" -ForegroundColor White
    Write-Host "4. Or reset PostgreSQL password using pgAdmin" -ForegroundColor White
    Write-Host ""
    Write-Host "Current DATABASE_URL in .env:" -ForegroundColor Yellow
    Write-Host "postgresql://postgres:pkdon123@localhost:5432/khaacho?schema=public" -ForegroundColor White
    Write-Host ""
    exit 1
}
Write-Host ""

# Step 4: Check Redis/Docker
Write-Host "Step 4: Checking Redis..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Docker is running" -ForegroundColor Green
    
    # Check if Redis container exists
    $redisContainer = docker ps -a --filter "name=redis" --format "{{.Names}}" 2>&1
    if ($redisContainer -match "redis") {
        $redisStatus = docker ps --filter "name=redis" --format "{{.Status}}" 2>&1
        if ($redisStatus) {
            Write-Host "Redis container is running" -ForegroundColor Green
        } else {
            Write-Host "Starting Redis container..." -ForegroundColor Gray
            docker start redis
            Write-Host "Redis container started" -ForegroundColor Green
        }
    } else {
        Write-Host "Creating Redis container..." -ForegroundColor Gray
        docker run -d --name redis -p 6379:6379 redis:latest
        Write-Host "Redis container created and started" -ForegroundColor Green
    }
} else {
    Write-Host "Docker is not running" -ForegroundColor Red
    Write-Host ""
    Write-Host "OPTIONS:" -ForegroundColor Yellow
    Write-Host "1. Start Docker Desktop (Recommended)" -ForegroundColor White
    Write-Host "   Then run this script again" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Install Redis for Windows manually" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Disable background jobs in .env" -ForegroundColor White
    Write-Host "   Set ENABLE_BACKGROUND_JOBS=false" -ForegroundColor White
    Write-Host ""
    
    $response = Read-Host "Do you want to continue without Redis? (y/n)"
    if ($response -ne "y") {
        exit 1
    }
}
Write-Host ""

# Step 5: Run Prisma Migrations
Write-Host "Step 5: Running database migrations..." -ForegroundColor Yellow
npm run db:migrate:deploy
if ($LASTEXITCODE -eq 0) {
    Write-Host "Database migrations completed" -ForegroundColor Green
} else {
    Write-Host "Database migrations failed" -ForegroundColor Red
    Write-Host "Check the error above and fix before continuing" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 6: Seed Database
Write-Host "Step 6: Seeding database..." -ForegroundColor Yellow
$seedResponse = Read-Host "Do you want to seed the database with sample data? (y/n)"
if ($seedResponse -eq "y") {
    npm run db:seed
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Database seeded successfully" -ForegroundColor Green
    } else {
        Write-Host "Database seeding failed" -ForegroundColor Red
    }
}
Write-Host ""

# Step 7: Summary
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update WhatsApp API credentials in .env (optional)" -ForegroundColor White
Write-Host "2. Update JWT_SECRET in .env to a secure random string" -ForegroundColor White
Write-Host "3. Start the development server with: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "4. Access the application:" -ForegroundColor White
Write-Host "   API: http://localhost:3000/api/v1" -ForegroundColor Green
Write-Host "   Admin Panel: http://localhost:3000/admin" -ForegroundColor Green
Write-Host ""
Write-Host "Default admin credentials (if seeded):" -ForegroundColor White
Write-Host "   Phone: +9779800000000" -ForegroundColor Green
Write-Host "   Password: admin123" -ForegroundColor Green
Write-Host ""
