# ============================================================================
# YouTube Viewer - Automated ADB Installation Script (PowerShell)
# ============================================================================
param (
    [string]$Version = "v1.0.3"
)

# ----------------------------------------------------------------------------
# CONFIGURATION & VARIABLES (DEFINED ON TOP)
# ----------------------------------------------------------------------------
$RepoOwner     = "baobabitogether-a11y"
$RepoName      = "youtubenet"
$ApkName       = "YouTube-Viewer-debug.apk"
$PackageName   = "com.ytviewer.app"
$MainActivity  = "com.ytviewer.app/.MainActivity"

# Downloads folder resolution (Windows standard)
$DownloadsDir  = [System.IO.Path]::Combine($env:USERPROFILE, "Downloads")
$ApkPath       = [System.IO.Path]::Combine($DownloadsDir, $ApkName)
$DownloadUrl   = "https://github.com/$RepoOwner/$RepoName/releases/download/$Version/$ApkName"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   YouTube Viewer - Automated ADB Installation (PowerShell)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " Repository   : $RepoOwner/$RepoName"
Write-Host " Version Tag  : $Version"
Write-Host " APK Name     : $ApkName"
Write-Host " Target Path  : $ApkPath"
Write-Host " Package Name : $PackageName"
Write-Host " Download URL : $DownloadUrl"
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------------------------------------
# 0. CHECK PREREQUISITES
# ----------------------------------------------------------------------------
$adbCmd = Get-Command "adb" -ErrorAction SilentlyContinue
if (-not $adbCmd) {
    $fallbackAdb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
    if (Test-Path $fallbackAdb) {
        $env:PATH = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:PATH"
        Write-Host "[+] Added ADB to PATH from Android SDK." -ForegroundColor Green
    } else {
        Write-Error "[ERROR] ADB executable not found in PATH or standard Android SDK directories."
        exit 1
    }
}

# Check for connected ADB device
Write-Host "[*] Checking connected ADB devices..." -ForegroundColor Yellow
& adb devices
$deviceState = & adb get-state 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Warning: Device may not be connected or unauthorized." -ForegroundColor DarkYellow
    Write-Host "    Make sure USB Debugging is ON and your PC is authorized."
}

# ----------------------------------------------------------------------------
# 1. REMOVE PREVIOUS DOWNLOADED APK
# ----------------------------------------------------------------------------
Write-Host "[*] Cleaning up old APK file at: $ApkPath" -ForegroundColor Yellow
if (Test-Path $ApkPath) {
    Remove-Item -Path $ApkPath -Force -ErrorAction SilentlyContinue
    Write-Host "[+] Old APK deleted." -ForegroundColor Green
} else {
    Write-Host "[+] No prior APK file found." -ForegroundColor DarkGray
}

# ----------------------------------------------------------------------------
# 2. DOWNLOAD LATEST APK VIA CURL (WITH -L FOR GITHUB 302 REDIRECTS)
# ----------------------------------------------------------------------------
Write-Host "[*] Downloading $ApkName ($Version)..." -ForegroundColor Yellow
Write-Host "[*] Using curl with -L (follow GitHub release redirects) and -f (fail on error)..."
& curl.exe -f -L --progress-bar "$DownloadUrl" --output "$ApkPath"

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $ApkPath)) {
    Write-Error "[ERROR] Failed to download APK from: $DownloadUrl"
    exit 1
}

$fileSize = (Get-Item $ApkPath).Length
if ($fileSize -lt 100000) {
    Write-Error "[ERROR] Downloaded file is only $fileSize bytes. Likely an HTML redirect or 404 response."
    exit 1
}
Write-Host "[+] APK downloaded successfully: $([math]::Round($fileSize/1MB, 2)) MB" -ForegroundColor Green

# ----------------------------------------------------------------------------
# 3. UNINSTALL PREVIOUS APPLICATION
# ----------------------------------------------------------------------------
Write-Host "[*] Uninstalling previous package $PackageName..." -ForegroundColor Yellow
& adb uninstall $PackageName
if ($LASTEXITCODE -ne 0) {
    Write-Host "[i] Note: Package wasn't previously installed or uninstall failed cleanly. Continuing..." -ForegroundColor DarkGray
} else {
    Write-Host "[+] Previous installation removed." -ForegroundColor Green
}

# ----------------------------------------------------------------------------
# 4. INSTALL NEW APK
# ----------------------------------------------------------------------------
Write-Host "[*] Installing APK via ADB..." -ForegroundColor Yellow
& adb install -r -d "$ApkPath"
if ($LASTEXITCODE -ne 0) {
    Write-Error "[ERROR] ADB install command failed."
    exit 1
}
Write-Host "[+] APK successfully installed on device!" -ForegroundColor Green

# ----------------------------------------------------------------------------
# 5. LAUNCH MAIN ACTIVITY
# ----------------------------------------------------------------------------
Write-Host "[*] Launching $MainActivity..." -ForegroundColor Yellow
& adb shell am start -n $MainActivity
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "   INSTALLATION COMPLETE! Application is now running on device. " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
