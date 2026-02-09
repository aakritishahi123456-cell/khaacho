# Apply Production Optimization Migration
# This script applies the database optimization migration (012)

param(
    [string]$Container = "postgres-khaacho",
    [string]$Database = "khaacho",
    [string]$User = "postgres"
)

Write-Host "Production Database Optimization" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker status..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Docker is not running" -ForegroundColor Red
        Write-Host "Please start Docker Desktop and try again" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "Error: Docker is not available" -ForegroundColor Red
    exit 1
}

# Check if container is running
Write-Host "Checking database container..." -ForegroundColor Yellow
$ContainerRunning = docker ps --filter "name=$Container" --format "{{.Names}}"
if ($ContainerRunning -ne $Container) {
    Write-Host "Error: Container '$Container' is not running" -ForegroundColor Red
    Write-Host "Start the container with: docker start $Container" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Container is running" -ForegroundColor Green

# Check if migration file exists
$MigrationFile = "prisma/migrations/012_production_optimization.sql"
if (-not (Test-Path $MigrationFile)) {
    Write-Host "Error: Migration file not found: $MigrationFile" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Migration file found" -ForegroundColor Green

Write-Host ""
Write-Host "This migration will:" -ForegroundColor Cyan
Write-Host "  • Create 30+ performance indexes" -ForegroundColor Gray
Write-Host "  • Add monitoring views (slow_queries, index_usage_stats, etc.)" -ForegroundColor Gray
Write-Host "  • Enable pg_stat_statements extension" -ForegroundColor Gray
Write-Host "  • Optimize autovacuum settings" -ForegroundColor Gray
Write-Host "  • Analyze all tables" -ForegroundColor Gray
Write-Host ""
Write-Host "Estimated time: 2-5 minutes" -ForegroundColor Gray
Write-Host ""

$Confirmation = Read-Host "Continue? (Y/N)"
if ($Confirmation -ne "Y" -and $Confirmation -ne "y") {
    Write-Host "Migration cancelled" -ForegroundColor Gray
    exit 0
}

Write-Host ""
Write-Host "Applying migration..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray
Write-Host ""

# Apply migration
Get-Content $MigrationFile | docker exec -i $Container psql -U $User -d $Database

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Migration applied successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Verify indexes were created
    Write-Host "Verifying indexes..." -ForegroundColor Yellow
    $IndexCount = docker exec $Container psql -U $User -d $Database -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';"
    Write-Host "✓ Total indexes created: $($IndexCount.Trim())" -ForegroundColor Green
    
    # Check monitoring views
    Write-Host "Verifying monitoring views..." -ForegroundColor Yellow
    $ViewCount = docker exec $Container psql -U $User -d $Database -t -c "SELECT COUNT(*) FROM pg_views WHERE schemaname = 'public' AND viewname IN ('slow_queries', 'index_usage_stats', 'table_bloat_stats', 'missing_indexes');"
    Write-Host "✓ Monitoring views created: $($ViewCount.Trim())" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Optimization Summary:" -ForegroundColor Cyan
    Write-Host "  • Indexes: $($IndexCount.Trim())" -ForegroundColor Gray
    Write-Host "  • Monitoring views: $($ViewCount.Trim())" -ForegroundColor Gray
    Write-Host "  • pg_stat_statements: Enabled" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Update .env with connection pool parameters (already done)" -ForegroundColor Gray
    Write-Host "  2. Restart your application server" -ForegroundColor Gray
    Write-Host "  3. Set up automated backups (see scripts/backup-database.ps1)" -ForegroundColor Gray
    Write-Host "  4. Monitor slow queries: SELECT * FROM slow_queries;" -ForegroundColor Gray
    Write-Host "  5. Check index usage: SELECT * FROM index_usage_stats;" -ForegroundColor Gray
    Write-Host ""
    Write-Host "See PERFORMANCE_OPTIMIZATION.md for complete guide" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Error: Migration failed" -ForegroundColor Red
    Write-Host "Check the error messages above for details" -ForegroundColor Yellow
    exit 1
}
