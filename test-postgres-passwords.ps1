# Test common PostgreSQL passwords
$passwords = @('pkdon123', 'postgres', 'admin', 'password', 'root', '123456', '')

Write-Host "Testing PostgreSQL passwords..." -ForegroundColor Cyan
Write-Host ""

foreach ($pwd in $passwords) {
    if ($pwd -eq '') {
        Write-Host "Testing with empty password..." -ForegroundColor Gray
        $env:PGPASSWORD = ''
    } else {
        Write-Host "Testing password: $pwd" -ForegroundColor Gray
        $env:PGPASSWORD = $pwd
    }
    
    $result = & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "SELECT 1;" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS! Password is: $pwd" -ForegroundColor Green
        Write-Host ""
        Write-Host "Update your .env file with:" -ForegroundColor Yellow
        Write-Host "DATABASE_URL=`"postgresql://postgres:$pwd@localhost:5432/khaacho?schema=public`"" -ForegroundColor White
        exit 0
    }
}

Write-Host ""
Write-Host "None of the common passwords worked." -ForegroundColor Red
Write-Host ""
Write-Host "Please use pgAdmin (now opening) to:" -ForegroundColor Yellow
Write-Host "1. Connect to PostgreSQL server" -ForegroundColor White
Write-Host "2. Right-click on PostgreSQL 18 server" -ForegroundColor White
Write-Host "3. Go to Properties > Connection" -ForegroundColor White
Write-Host "4. Set password to: pkdon123" -ForegroundColor White
Write-Host "5. Save and reconnect" -ForegroundColor White
Write-Host ""
