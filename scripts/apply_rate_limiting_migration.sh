#!/bin/bash

# Apply Campaign Rate Limiting Enhancements Migration
# This script applies the database migration for improved rate limiting

set -e

echo "🚀 Applying Campaign Rate Limiting Enhancements..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set it first:"
    echo "  export DATABASE_URL='postgresql://user:pass@host:port/database'"
    exit 1
fi

echo "✓ DATABASE_URL found"
echo ""

# Check if migration file exists
MIGRATION_FILE="supabase/migrations/20260426_campaign_rate_limiting_enhancements.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ ERROR: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "✓ Migration file found"
echo ""

# Apply migration
echo "📝 Applying migration..."
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "📊 Verifying installation..."
    echo ""
    
    # Verify tables
    psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_name IN ('daily_action_counts', 'weekly_action_counts');"
    
    echo ""
    echo "🔍 Verifying functions..."
    echo ""
    
    # Verify functions
    psql "$DATABASE_URL" -c "SELECT routine_name FROM information_schema.routines WHERE routine_name IN ('check_rate_limits', 'increment_action_count', 'calculate_next_action_time', 'get_week_start_date');"
    
    echo ""
    echo "✨ All done! Your campaign system now has:"
    echo "  ✓ Weekly limit tracking (200 connections/week)"
    echo "  ✓ Natural timing with random jitter"
    echo "  ✓ Cross-campaign rate limit enforcement"
    echo "  ✓ Auto-retry on rate limits"
    echo ""
    echo "📖 See CAMPAIGN_RATE_LIMITING_IMPROVEMENTS.md for details"
else
    echo ""
    echo "❌ Migration failed!"
    echo "Please check the error messages above"
    exit 1
fi
