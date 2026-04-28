#!/bin/bash

# Apply Account Type Migration
# This script applies the account type and weekly limits migration to Supabase

echo "========================================"
echo "Account Type Migration Script"
echo "========================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please create a .env file with your Supabase credentials."
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env"
    exit 1
fi

echo "Supabase URL: $SUPABASE_URL"
echo ""

# Extract project ref from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\///' | sed 's/\.supabase\.co.*//')
DB_HOST="db.${PROJECT_REF}.supabase.co"

echo "Applying migration via Supabase SQL Editor..."
echo ""
echo "Please follow these steps:"
echo "1. Go to: $SUPABASE_URL/project/$PROJECT_REF/sql/new"
echo "2. Copy the contents of: scripts/apply_account_type_migration.sql"
echo "3. Paste into the SQL Editor"
echo "4. Click 'Run' to execute the migration"
echo ""

# Try to use psql if available
if command -v psql &> /dev/null; then
    echo "psql is available. Would you like to apply the migration now? (y/N)"
    read -r response
    
    if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
        echo ""
        echo "Applying migration..."
        
        echo "Enter your Supabase database password:"
        read -s DB_PASSWORD
        
        export PGPASSWORD=$DB_PASSWORD
        
        psql -h "$DB_HOST" -p 5432 -U postgres -d postgres -f scripts/apply_account_type_migration.sql
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "========================================"
            echo "Migration applied successfully!"
            echo "========================================"
            echo ""
            echo "Next steps:"
            echo "1. Restart your worker: python backend/worker.py"
            echo "2. Deploy frontend: npm run build"
            echo "3. Test the new account settings in LinkedIn Accounts page"
        else
            echo ""
            echo "Migration failed. Please check the error above."
            echo "You can also apply it manually via Supabase SQL Editor."
        fi
    fi
else
    echo "psql is not available. Please apply the migration manually via Supabase SQL Editor."
fi

echo ""
echo "Migration file location: scripts/apply_account_type_migration.sql"
echo ""
