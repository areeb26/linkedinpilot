# Apply Account Type Migration
# This script applies the account type and weekly limits migration to Supabase

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Account Type Migration Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file with your Supabase credentials." -ForegroundColor Yellow
    exit 1
}

# Load environment variables
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$') {
        $name = $matches[1]
        $value = $matches[2]
        Set-Item -Path "env:$name" -Value $value
    }
}

$SUPABASE_URL = $env:SUPABASE_URL
$SUPABASE_SERVICE_ROLE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $SUPABASE_URL -or -not $SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env" -ForegroundColor Red
    exit 1
}

Write-Host "Supabase URL: $SUPABASE_URL" -ForegroundColor Green
Write-Host ""

# Extract database connection details from Supabase URL
$DB_HOST = $SUPABASE_URL -replace 'https://', '' -replace '\.supabase\.co.*', '.supabase.co'
$PROJECT_REF = $SUPABASE_URL -replace 'https://', '' -replace '\.supabase\.co.*', ''

Write-Host "Applying migration via Supabase SQL Editor..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Please follow these steps:" -ForegroundColor Cyan
Write-Host "1. Go to: $SUPABASE_URL/project/$PROJECT_REF/sql/new" -ForegroundColor White
Write-Host "2. Copy the contents of: scripts/apply_account_type_migration.sql" -ForegroundColor White
Write-Host "3. Paste into the SQL Editor" -ForegroundColor White
Write-Host "4. Click 'Run' to execute the migration" -ForegroundColor White
Write-Host ""

# Try to use psql if available
$psqlAvailable = Get-Command psql -ErrorAction SilentlyContinue

if ($psqlAvailable) {
    Write-Host "psql is available. Would you like to apply the migration now? (Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    
    if ($response -eq 'Y' -or $response -eq 'y') {
        Write-Host ""
        Write-Host "Applying migration..." -ForegroundColor Green
        
        # Construct connection string
        $DB_PASSWORD = Read-Host "Enter your Supabase database password" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DB_PASSWORD)
        $PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        
        $env:PGPASSWORD = $PlainPassword
        
        psql -h "db.$DB_HOST" -p 5432 -U postgres -d postgres -f scripts/apply_account_type_migration.sql
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "Migration applied successfully!" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next steps:" -ForegroundColor Cyan
            Write-Host "1. Restart your worker: python backend/worker.py" -ForegroundColor White
            Write-Host "2. Deploy frontend: npm run build" -ForegroundColor White
            Write-Host "3. Test the new account settings in LinkedIn Accounts page" -ForegroundColor White
        } else {
            Write-Host ""
            Write-Host "Migration failed. Please check the error above." -ForegroundColor Red
            Write-Host "You can also apply it manually via Supabase SQL Editor." -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "psql is not available. Please apply the migration manually via Supabase SQL Editor." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Migration file location: scripts/apply_account_type_migration.sql" -ForegroundColor Cyan
Write-Host ""
