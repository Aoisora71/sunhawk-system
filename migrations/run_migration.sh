#!/bin/bash
# Bash script to run the migration
# Usage: bash migrations/run_migration.sh

# Option 1: Using DATABASE_URL environment variable (if set)
if [ -n "$DATABASE_URL" ]; then
    echo "Using DATABASE_URL environment variable..."
    psql "$DATABASE_URL" -f migrations/add_survey_running_display.sql
else
    # Option 2: Using default connection (adjust these values for your environment)
    echo "DATABASE_URL not set. Using default connection parameters..."
    echo "Please adjust the following values if needed:"
    echo "  Host: localhost"
    echo "  Port: 5432"
    echo "  Database: sunhawk_system"
    echo ""
    
    read -p "Enter database host (default: localhost): " host
    host=${host:-localhost}
    
    read -p "Enter database port (default: 5432): " port
    port=${port:-5432}
    
    read -p "Enter database name (default: sunhawk_system): " database
    database=${database:-sunhawk_system}
    
    read -p "Enter PostgreSQL username: " username
    
    # Run migration (psql will prompt for password)
    psql -h "$host" -p "$port" -U "$username" -d "$database" -f migrations/add_survey_running_display.sql
fi

echo ""
echo "Migration completed!"

