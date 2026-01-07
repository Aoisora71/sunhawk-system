# Database Migration Guide

## Migration: Add running and display columns to surveys table

This migration adds `running` and `display` boolean columns to the `surveys` table to enable per-survey run/stop and show/hide functionality.

## Running the Migration

### Option 1: Using DATABASE_URL (Recommended)

If you have `DATABASE_URL` environment variable set:

**PowerShell (Windows):**
```powershell
$env:PGPASSWORD = "your_password"
psql $env:DATABASE_URL -f migrations\add_survey_running_display.sql
```

**Bash (Linux/Mac):**
```bash
psql "$DATABASE_URL" -f migrations/add_survey_running_display.sql
```

### Option 2: Using Connection Parameters

**PowerShell (Windows):**
```powershell
# Set password as environment variable (optional, psql will prompt if not set)
$env:PGPASSWORD = "your_password"

# Run migration
psql -h localhost -p 5432 -U your_username -d sunhawk_system -f migrations\add_survey_running_display.sql
```

**Bash (Linux/Mac):**
```bash
# Set password as environment variable (optional, psql will prompt if not set)
export PGPASSWORD="your_password"

# Run migration
psql -h localhost -p 5432 -U your_username -d sunhawk_system -f migrations/add_survey_running_display.sql
```

### Option 3: Using Helper Scripts

**PowerShell (Windows):**
```powershell
.\migrations\run_migration.ps1
```

**Bash (Linux/Mac):**
```bash
chmod +x migrations/run_migration.sh
bash migrations/run_migration.sh
```

### Option 4: Interactive psql Session

```powershell
# Connect to database
psql -h localhost -p 5432 -U your_username -d sunhawk_system

# Then run the SQL commands
\i migrations/add_survey_running_display.sql
```

## What This Migration Does

1. Adds `running` column (BOOLEAN, default: true) - Controls whether survey is running or stopped
2. Adds `display` column (BOOLEAN, default: true) - Controls whether survey is visible or hidden
3. Sets default values for existing surveys (running = true, display = true)
4. Adds documentation comments to the columns

## Verification

After running the migration, verify the columns were added:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'surveys' 
  AND column_name IN ('running', 'display');
```

You should see both `running` and `display` columns with `boolean` data type and `true` as default.

