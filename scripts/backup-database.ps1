# Database Backup Script for Windows
# Backs up PostgreSQL database using Docker

param(
    [string]$BackupDir = "backups",
    [string]$Container = "postgres-khaacho",
    [string]$Database = "khaacho",
    [string]$User = "postgres",
    [int]$RetentionDays = 7
)

# Create backup directory if it doesn't exist
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
    Write-Host "Created backup directory: $BackupDir" -ForegroundColor Green
}

# Generate backup filename with timestamp
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFile = "$BackupDir/khaacho_backup_$Timestamp.sql"
$CompressedFile = "$BackupFile.gz"

Write-Host "Starting database backup..." -ForegroundColor Cyan
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

# Check if container exists
$ContainerExists = docker ps -a --filter "name=$Container" --format "{{.Names}}"
if ($ContainerExists -ne $Container) {
    Write-Host "Error: Container '$Container' not found" -ForegroundColor Red
    exit 1
}

# Check if container is running
$ContainerRunning = docker ps --filter "name=$Container" --format "{{.Names}}"
if ($ContainerRunning -ne $Container) {
    Write-Host "Error: Container '$Container' is not running" -ForegroundColor Red
    exit 1
}

# Perform backup
Write-Host "Creating backup..." -ForegroundColor Yellow
docker exec $Container pg_dump -U $User -d $Database --clean --if-exists --create > $BackupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup created successfully: $BackupFile" -ForegroundColor Green
    
    # Get backup file size
    $FileSize = (Get-Item $BackupFile).Length
    $FileSizeMB = [math]::Round($FileSize / 1MB, 2)
    Write-Host "Backup size: $FileSizeMB MB" -ForegroundColor Gray
    
    # Compress backup (optional - requires 7-Zip or similar)
    if (Get-Command "7z" -ErrorAction SilentlyContinue) {
        Write-Host "Compressing backup..." -ForegroundColor Yellow
        7z a -tgzip $CompressedFile $BackupFile | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Remove-Item $BackupFile
            $CompressedSize = (Get-Item $CompressedFile).Length
            $CompressedSizeMB = [math]::Round($CompressedSize / 1MB, 2)
            Write-Host "Compressed backup: $CompressedFile ($CompressedSizeMB MB)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "Error: Backup failed" -ForegroundColor Red
    exit 1
}

# Clean up old backups
Write-Host "Cleaning up old backups (older than $RetentionDays days)..." -ForegroundColor Yellow
$CutoffDate = (Get-Date).AddDays(-$RetentionDays)
$OldBackups = Get-ChildItem -Path $BackupDir -Filter "khaacho_backup_*.sql*" | Where-Object { $_.LastWriteTime -lt $CutoffDate }

if ($OldBackups.Count -gt 0) {
    foreach ($OldBackup in $OldBackups) {
        Remove-Item $OldBackup.FullName
        Write-Host "Deleted old backup: $($OldBackup.Name)" -ForegroundColor Gray
    }
    Write-Host "Removed $($OldBackups.Count) old backup(s)" -ForegroundColor Green
} else {
    Write-Host "No old backups to remove" -ForegroundColor Gray
}

# Summary
Write-Host "`nBackup Summary:" -ForegroundColor Cyan
Write-Host "- Database: $Database" -ForegroundColor Gray
Write-Host "- Timestamp: $Timestamp" -ForegroundColor Gray
Write-Host "- Location: $BackupDir" -ForegroundColor Gray
Write-Host "- Retention: $RetentionDays days" -ForegroundColor Gray

$TotalBackups = (Get-ChildItem -Path $BackupDir -Filter "khaacho_backup_*.sql*").Count
Write-Host "- Total backups: $TotalBackups" -ForegroundColor Gray

Write-Host "`nBackup completed successfully!" -ForegroundColor Green
