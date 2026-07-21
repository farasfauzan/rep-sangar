# ERP Konstruksi - Local Development Startup Script (No Docker)
# Run this in PowerShell to start all services without Docker
#
# Usage:
#   .\start-local.ps1          # Start all services
#   .\start-local.ps1 -Stop    # Stop all services

param(
    [switch]$Stop
)

function Find-Php83 {
    $possiblePaths = @(
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\PHP.PHP.8.3*\php.exe",
        "$env:ProgramFiles\PHP\php.exe",
        "C:\tools\php*\php.exe",
        (Get-Command php -ErrorAction SilentlyContinue).Source
    )
    foreach ($pattern in $possiblePaths) {
        $matches = Get-ChildItem $pattern -ErrorAction SilentlyContinue
        if ($matches) {
            $phpExe = $matches[0].FullName
            # Verify it's PHP 8.3+
            $version = & $phpExe -v 2>&1
            if ($version -match 'PHP 8\.(3|4|5|6|7|8|9)') {
                $iniPath = Join-Path (Split-Path $phpExe -Parent) "php.ini"
                if (-not (Test-Path $iniPath)) {
                    $iniProduction = Join-Path (Split-Path $phpExe -Parent) "php.ini-production"
                    if (Test-Path $iniProduction) {
                        Copy-Item $iniProduction $iniPath
                        # Enable common extensions
                        $extDir = Join-Path (Split-Path $phpExe -Parent) "ext"
                        if (Test-Path $extDir) {
                            (Get-Content $iniPath) -replace ';extension_dir = "ext"', 'extension_dir = "ext"' | Set-Content $iniPath
                            @('curl','gd','mbstring','pdo_mysql','pdo_sqlite','sqlite3','fileinfo','openssl','intl','zip') | ForEach-Object {
                                (Get-Content $iniPath) -replace ";extension=$_", "extension=$_" | Set-Content $iniPath
                            }
                        }
                    }
                }
                return @{ Exe = $phpExe; Ini = $iniPath }
            }
        }
    }
    return $null
}

function Stop-Services {
    Write-Host "`nStopping all services..." -ForegroundColor Yellow
    Get-Job | Stop-Job -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -ErrorAction SilentlyContinue
    Write-Host "All services stopped." -ForegroundColor Green
    exit 0
}

# Handle -Stop flag
if ($Stop) {
    Stop-Services
}

# Detect PHP 8.3
Write-Host "🔍 Detecting PHP 8.3..." -ForegroundColor Cyan
$php = Find-Php83
if (-not $php) {
    Write-Host "❌ PHP 8.3+ not found!" -ForegroundColor Red
    Write-Host "   Install via winget: winget install PHP.PHP.8.3" -ForegroundColor Yellow
    exit 1
}
$PhpPath = $php.Exe
$PhpIni = $php.Ini
Write-Host "   ✓ Found: $PhpPath" -ForegroundColor Green

# Project root
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "`n🚀 Starting services..." -ForegroundColor Cyan
Write-Host ""

# Start Laravel dev server
Write-Host "   Starting Laravel dev server (port 8000)..." -ForegroundColor Yellow
$serverJob = Start-Job -ScriptBlock {
    param($p, $i, $r)
    Set-Location $r
    & $p -c $i artisan serve --host=127.0.0.1 --port=8000
} -ArgumentList $PhpPath, $PhpIni, $ProjectRoot
Start-Sleep -Seconds 2

# Start queue worker
Write-Host "   Starting queue worker..." -ForegroundColor Yellow
$queueJob = Start-Job -ScriptBlock {
    param($p, $i, $r)
    Set-Location $r
    & $p -c $i artisan queue:listen --tries=1 --timeout=0
} -ArgumentList $PhpPath, $PhpIni, $ProjectRoot

# Check if npx is available for Vite
$npxCheck = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npxCheck) {
    Write-Host "   ⚠️  npx not found; Vite HMR won't start" -ForegroundColor Yellow
    $viteJob = $null
} else {
    Write-Host "   Starting Vite dev server (HMR)..." -ForegroundColor Yellow
    $viteJob = Start-Job -ScriptBlock {
        param($r)
        Set-Location $r
        npx vite --host=127.0.0.1
    } -ArgumentList $ProjectRoot
}

Start-Sleep -Seconds 3

# Verify services
$serverOk = $false
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/login" -TimeoutSec 5 -UseBasicParsing
    $serverOk = $response.StatusCode -eq 200
} catch {}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
if ($serverOk) {
    Write-Host "  ✅ All services running!" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Services started (server not yet responding)" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  🌐 Laravel App:  http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  ⚡ Vite HMR:     http://127.0.0.1:5173" -ForegroundColor White
Write-Host ""
Write-Host "  👤 Test Accounts (password: password):" -ForegroundColor Cyan
Write-Host "     ADMIN             admin@erp.com" -ForegroundColor Gray
Write-Host "     LAPANGAN          lapangan@erp.com" -ForegroundColor Gray
Write-Host "     ENGINEER          engineer@erp.com" -ForegroundColor Gray
Write-Host "     PURCHASING_LEGAL  purchasing_legal@erp.com" -ForegroundColor Gray
Write-Host "     VERIFIKATOR_KEU   verifikator_keu@erp.com" -ForegroundColor Gray
Write-Host "     MGR_KOMERSIAL     mgr_komersial@erp.com" -ForegroundColor Gray
Write-Host "     KEU_KANTOR        keu_kantor@erp.com" -ForegroundColor Gray
Write-Host "     PAJAK             pajak@erp.com" -ForegroundColor Gray
Write-Host "     ACCOUNTING        accounting@erp.com" -ForegroundColor Gray
Write-Host ""
Write-Host "  ⌨️  Press Ctrl+C to stop all services" -ForegroundColor Magenta
Write-Host "  ℹ️  Or run: .\start-local.ps1 -Stop" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Green

# Monitor services until Ctrl+C
try {
    while ($true) {
        $allJobs = @($serverJob)
        if ($viteJob) { $allJobs += $viteJob }
        if ($queueJob) { $allJobs += $queueJob }
        
        $running = ($allJobs | Where-Object { $_.State -eq 'Running' }).Count
        $failed = ($allJobs | Where-Object { $_.State -eq 'Failed' }).Count
        
        if ($failed -gt 0) {
            Write-Host "`n❌ Some services failed!" -ForegroundColor Red
            $allJobs | Where-Object { $_.State -eq 'Failed' } | Format-Table Id, Name, State
            break
        }
        if ($running -eq 0) {
            Write-Host "`n⚠️  All services stopped." -ForegroundColor Yellow
            break
        }
        Start-Sleep -Seconds 10
    }
} finally {
    Write-Host "`nStopping services..." -ForegroundColor Yellow
    $serverJob, $queueJob, $viteJob | Where-Object { $_ -ne $null } | Stop-Job -ErrorAction SilentlyContinue
    $serverJob, $queueJob, $viteJob | Where-Object { $_ -ne $null } | Remove-Job -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
}
