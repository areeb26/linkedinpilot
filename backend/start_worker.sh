#!/bin/bash

# LinkedPilot Queue Worker Startup Script
# This script starts the background worker that processes pending actions

echo "=========================================="
echo "LinkedPilot Queue Worker"
echo "=========================================="
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "⚠️  Virtual environment not found. Creating one..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install/update dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "Please create a .env file with the following variables:"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_SERVICE_ROLE_KEY"
    echo "  - UNIPILE_API_KEY"
    echo "  - UNIPILE_DSN"
    echo ""
    exit 1
fi

echo ""
echo "Starting worker..."
echo "Press Ctrl+C to stop"
echo ""

# Start the worker
python worker.py
