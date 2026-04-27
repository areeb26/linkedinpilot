"""
Test script to verify worker setup is correct.

Run this before starting the worker to check:
- Environment variables are set
- Database connection works
- Unipile API is accessible
- Pending actions exist
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

def check_env_vars():
    """Check required environment variables."""
    print("🔍 Checking environment variables...")
    
    required = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "UNIPILE_API_KEY",
        "UNIPILE_DSN"
    ]
    
    missing = []
    for var in required:
        if not os.getenv(var):
            missing.append(var)
            print(f"  ❌ {var} - NOT SET")
        else:
            # Show partial value for security
            value = os.getenv(var)
            masked = value[:10] + "..." if len(value) > 10 else value
            print(f"  ✅ {var} - {masked}")
    
    if missing:
        print(f"\n❌ Missing environment variables: {', '.join(missing)}")
        print("Please add them to your .env file")
        return False
    
    print("✅ All environment variables set\n")
    return True


def check_database():
    """Check database connection."""
    print("🔍 Checking database connection...")
    
    try:
        from utils.db import get_supabase
        supabase = get_supabase()
        
        # Test query
        response = supabase.table("action_queue").select("id").limit(1).execute()
        
        print("  ✅ Database connection successful")
        print(f"  ✅ Can access action_queue table\n")
        return True
    
    except Exception as e:
        print(f"  ❌ Database connection failed: {e}\n")
        return False


def check_unipile():
    """Check Unipile API connection."""
    print("🔍 Checking Unipile API connection...")
    
    try:
        from utils.unipile import UnipileClient
        client = UnipileClient()
        
        # Test API call - list accounts
        import asyncio
        accounts = asyncio.run(client._request("GET", "/accounts"))
        
        print("  ✅ Unipile API connection successful")
        print(f"  ✅ Found {len(accounts.get('items', []))} Unipile account(s)\n")
        return True
    
    except Exception as e:
        print(f"  ❌ Unipile API connection failed: {e}\n")
        return False


def check_pending_actions():
    """Check for pending actions in the queue."""
    print("🔍 Checking for pending actions...")
    
    try:
        from utils.db import get_supabase
        from datetime import datetime, timezone
        
        supabase = get_supabase()
        now = datetime.now(timezone.utc).isoformat()
        
        # Count pending actions
        response = supabase.table("action_queue").select(
            "id, action_type, workspace_id, scheduled_at",
            count="exact"
        ).eq("status", "pending").or_(
            f"scheduled_at.is.null,scheduled_at.lte.{now}"
        ).execute()
        
        count = response.count or 0
        actions = response.data or []
        
        if count == 0:
            print("  ⚠️  No pending actions found")
            print("  This is normal if you haven't queued any actions yet\n")
        else:
            print(f"  ✅ Found {count} pending action(s)")
            
            # Show breakdown by type
            by_type = {}
            for action in actions[:10]:  # Show first 10
                action_type = action.get("action_type", "unknown")
                by_type[action_type] = by_type.get(action_type, 0) + 1
            
            for action_type, type_count in by_type.items():
                print(f"     - {action_type}: {type_count}")
            
            print()
        
        return True
    
    except Exception as e:
        print(f"  ❌ Failed to check pending actions: {e}\n")
        return False


def check_linkedin_accounts():
    """Check LinkedIn account configuration."""
    print("🔍 Checking LinkedIn accounts...")
    
    try:
        from utils.db import get_supabase
        supabase = get_supabase()
        
        response = supabase.table("linkedin_accounts").select(
            "id, full_name, status, login_method, unipile_account_id"
        ).neq("status", "disconnected").execute()
        
        accounts = response.data or []
        
        if not accounts:
            print("  ⚠️  No active LinkedIn accounts found")
            print("  Please connect a LinkedIn account first\n")
            return False
        
        print(f"  ✅ Found {len(accounts)} active account(s)")
        
        for account in accounts:
            name = account.get("full_name", "Unknown")
            status = account.get("status", "unknown")
            login_method = account.get("login_method", "unknown")
            has_unipile = "✅" if account.get("unipile_account_id") else "❌"
            
            print(f"     - {name}")
            print(f"       Status: {status}")
            print(f"       Login method: {login_method}")
            print(f"       Unipile connected: {has_unipile}")
            
            if login_method != "hosted":
                print(f"       ⚠️  Worker only processes 'hosted' accounts")
            
            if not account.get("unipile_account_id"):
                print(f"       ❌ Missing unipile_account_id - actions will fail")
        
        print()
        return True
    
    except Exception as e:
        print(f"  ❌ Failed to check LinkedIn accounts: {e}\n")
        return False


def main():
    """Run all checks."""
    print("=" * 60)
    print("LinkedPilot Worker Setup Test")
    print("=" * 60)
    print()
    
    checks = [
        ("Environment Variables", check_env_vars),
        ("Database Connection", check_database),
        ("Unipile API", check_unipile),
        ("LinkedIn Accounts", check_linkedin_accounts),
        ("Pending Actions", check_pending_actions),
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ {name} check crashed: {e}\n")
            results.append((name, False))
    
    # Summary
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    
    all_passed = True
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
        if not result:
            all_passed = False
    
    print()
    
    if all_passed:
        print("🎉 All checks passed! You're ready to start the worker.")
        print()
        print("Start the worker with:")
        print("  Windows: start_worker.bat")
        print("  Mac/Linux: ./start_worker.sh")
        return 0
    else:
        print("⚠️  Some checks failed. Please fix the issues above before starting the worker.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
