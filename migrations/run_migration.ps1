# PowerShell script to run the migration
# Usage: .\migrations\run_migration.ps1

# Option 1: Using DATABASE_URL environment variable (if set)
if ($env:DATABASE_URL) {
    Write-Host "Using DATABASE_URL environment variable..."
    $dbUrl = $env:DATABASE_URL
    
    # Parse DATABASE_URL and extract components
    if ($dbUrl -match "postgres(ql)?://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
        $username = $matches[2]
        $password = $matches[3]
        $host = $matches[4]
        $port = $matches[5]
        $database = $matches[6]
        
        # Set PGPASSWORD environment variable for psql
        $env:PGPASSWORD = $password
        
        # Run migration
        psql -h $host -p $port -U $username -d $database -f "migrations\add_survey_running_display.sql"
        
        # Clear password from environment
        Remove-Item Env:\PGPASSWORD
    } else {
        Write-Host "Error: Could not parse DATABASE_URL"
        exit 1
    }
} else {
    # Option 2: Using default connection (adjust these values for your environment)
    Write-Host "DATABASE_URL not set. Using default connection parameters..."
    Write-Host "Please adjust the following values if needed:"
    Write-Host "  Host: localhost"
    Write-Host "  Port: 5432"
    Write-Host "  Database: sunhawk_system"
    Write-Host "  User: (your PostgreSQL username)"
    Write-Host ""
    
    $host = Read-Host "Enter database host (default: localhost)"
    if ([string]::IsNullOrWhiteSpace($host)) { $host = "localhost" }
    
    $port = Read-Host "Enter database port (default: 5432)"
    if ([string]::IsNullOrWhiteSpace($port)) { $port = "5432" }
    
    $database = Read-Host "Enter database name (default: sunhawk_system)"
    if ([string]::IsNullOrWhiteSpace($database)) { $database = "sunhawk_system" }
    
    $username = Read-Host "Enter PostgreSQL username"
    
    # Run migration (psql will prompt for password)
    psql -h $host -p $port -U $username -d $database -f "migrations\add_survey_running_display.sql"
}

Write-Host ""
Write-Host "Migration completed!"

