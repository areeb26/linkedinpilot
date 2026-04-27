# Apply Campaign Rate Limiting Migration via Supabase SQL Editor
# This script reads the migration file and executes it via Supabase REST API

$ErrorActionPreference = "Stop"

Write-Host "🚀 Applying Campaign Rate Limiting Migration..." -ForegroundColor Cyan
Write-Host ""

# Load environment variables
$envFile = Get-Content .env
$supabaseUrl = ($envFile | Select-String "SUPABASE_URL=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value })
$serviceKey = ($envFile | Select-String "SUPABASE_SERVICE_ROLE_KEY=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value })

if (-not $supabaseUrl -or -not $serviceKey) {
    Write-Host "❌ ERROR: Could not find SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found Supabase credentials" -ForegroundColor Green
Write-Host "  URL: $supabaseUrl" -ForegroundColor Gray
Write-Host ""

# Read migration file
$migrationFile = "supabase/migrations/20260426_campaign_rate_limiting_enhancements.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ ERROR: Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found migration file" -ForegroundColor Green
Write-Host ""

$sql = Get-Content $migrationFile -Raw

# Split into individual statements (simple split by semicolon)
$statements = $sql -split ";" | Where-Object { $_.Trim() -ne "" -and $_.Trim() -notmatch "^--" }

Write-Host "📝 Executing $($statements.Count) SQL statements..." -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$errorCount = 0

foreach ($statement in $statements) {
    $trimmed = $statement.Trim()
    if ($trimmed -eq "" -or $trimmed -match "^--") {
        continue
    }
    
    # Show first 60 chars of statement
    $preview = $trimmed.Substring(0, [Math]::Min(60, $trimmed.Length))
    Write-Host "  Executing: $preview..." -ForegroundColor Gray
    
    try {
        $body = @{
            query = $trimmed
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/exec_sql" `
            -Method Post `
            -Headers @{
                "apikey" = $serviceKey
                "Authorization" = "Bearer $serviceKey"
                "Content-Type" = "application/json"
            } `
            -Body $body `
            -ErrorAction SilentlyContinue
        
        $successCount++
        Write-Host "    ✓ Success" -ForegroundColor Green
    }
    catch {
        # Try alternative method - direct query
        try {
            $body = $trimmed
            $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/" `
                -Method Post `
                -Headers @{
                    "apikey" = $serviceKey
                    "Authorization" = "Bearer $serviceKey"
                    "Content-Type" = "application/sql"
                    "Prefer" = "return=representation"
                } `
                -Body $body
            
            $successCount++
            Write-Host "    ✓ Success" -ForegroundColor Green
        }
        catch {
            $errorCount++
            Write-Host "    ⚠️ Warning: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "📊 Results:" -ForegroundColor Cyan
Write-Host "  ✓ Successful: $successCount" -ForegroundColor Green
Write-Host "  ⚠️ Warnings: $errorCount" -ForegroundColor Yellow
Write-Host ""

if ($errorCount -eq 0) {
    Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Migration completed with warnings. Some statements may need manual execution." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📖 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Verify tables exist in Supabase Dashboard > SQL Editor" -ForegroundColor Gray
Write-Host "  2. Run: SELECT * FROM daily_action_counts LIMIT 1;" -ForegroundColor Gray
Write-Host "  3. Restart backend: cd backend && python main.py" -ForegroundColor Gray
