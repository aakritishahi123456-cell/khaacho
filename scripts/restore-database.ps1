# Database Restore Script for Windows
# Restores PostgreSQL database from backup using Docker

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$Container = "postgres-khaacho",
    [string]$Database = "khaacho",
    [string]$User = "postgres",
    [switch]$Force
)

# Check if backup file exists
if (-not (Test-Path $BackupFile)) {
    Write-Host "Error: Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "Database Restore" -ForegroundColor Cyan
Write-Host "Container: $Container" -ForegroundColor Gray
Write-Host "Database: $Database" -ForegroundColor Gray
Write-Host "Backup file: $BackupFile" -ForegroundColor Gray

# Check if Docker is running
try {
    docker ps | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Docker is not running" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error: Docker is not available" -ForegroundColor Red
    exit 1
}

# Check if container exists and is running
$ContainerRunning = docker ps --filter "name=$Container" --format "{{.Names}}"
if ($ContainerRunning -ne $Container) {
    Write-Host "Error: Container '$Container' is not running" -ForegroundColor Red
    exit 1
}

# Warning prompt
if (-not $Force) {
    Write-Host "`nWARNING: This will replace the current database!" -ForegroundColor Yellow
    Write-Host "All existing data will be lost." -ForegroundColor Yellow
    $Confirmation = Read-Host "Type 'YES' to continue"
    
    if ($Confirmation -ne "YES") {
        Write-Host "Restore cancelled" -ForegroundColor Gray
        exit 0
    }
}

# Decompress if needed
$TempFile = $BackupFile
if ($BackupFile -match "\.gz$") {
    Write-Host "Decompressing backup..." -ForegroundColor Yellow
    $TempFile = $BackupFile -replace "\.gz$", ""
    
    if (Get-Command "7z" -ErrorAction SilentlyContinue) {
        7z e $BackupFile -o"$(Split-Path $TempFile)" -y | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Failed to decompress backup" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Error: 7-Zip not found. Cannot decompress .gz file" -ForegroundColor Red
        Write-Host "Install 7-Zip or provide an uncompressed .sql file" -ForegroundColor Yellow
        exit 1
    }
}

# Perform restore
Write-Host "Restoring database..." -ForegroundColor Yellow
Get-Content $TempFile | docker exec -i $Container psql -U $User -d postgres

if ($LASTEXITCODE -eq 0) {
    Write-Host "Database restored successfully!" -ForegroundColor Green
} else {
    Write-Host "Error: Restore failed" -ForegroundColor Red
    exit 1
}

# Clean up temporary file if we decompressed
if ($TempFile -ne $BackupFile -and (Test-Path $TempFile)) {
    Remove-Item $TempFile
}

Write-Host "`nRestore completed!" -ForegroundColor Green
