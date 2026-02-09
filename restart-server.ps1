# Restart Server Script
Write-Host "Stopping existing Node processes..." -ForegroundColor Yellow

# Stop all node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Start-Sleep -Seconds 2

Write-Host "Starting server..." -ForegroundColor Green

# Start server in background
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start" -WindowStyle Normal

Start-Sleep -Seconds 5

Write-Host "Server restarted!" -ForegroundColor Green
Write-Host "Testing health endpoint..." -ForegroundColor Cyan

# Test health endpoint
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/monitoring/health" -Method Get
    Write-Host "✓ Health check successful!" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "✗ Health check failed. Server may still be starting..." -ForegroundColor Red
    Write-Host "Wait a few seconds and try: curl http://localhost:3000/api/v1/monitoring/health" -ForegroundColor Yellow
}
