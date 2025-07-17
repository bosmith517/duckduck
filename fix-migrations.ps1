# PowerShell script to fix the migration issues

Write-Host "Step 1: Repairing migration history..." -ForegroundColor Green
supabase migration repair --status reverted 20250117140000 20250117141000 20250117142000 20250117143000 20250117144000

Write-Host "`nStep 2: Pulling current database state..." -ForegroundColor Green
supabase db pull

Write-Host "`nStep 3: Removing problematic local migrations..." -ForegroundColor Green
$migrations = @(
    "20250117140000_fix_form_sync_customer_id.sql",
    "20250117141000_fix_all_customer_id_references.sql",
    "20250117142000_diagnose_and_fix_customer_id.sql",
    "20250117143000_simple_fix_customer_id.sql",
    "20250117144000_fix_auto_convert_estimate_to_job.sql"
)

foreach ($migration in $migrations) {
    $path = "supabase/migrations/$migration"
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "Removed: $migration" -ForegroundColor Yellow
    }
}

Write-Host "`nStep 4: Pushing the cleanup migration..." -ForegroundColor Green
supabase db push

Write-Host "`nDone! The migration issues should be resolved." -ForegroundColor Green