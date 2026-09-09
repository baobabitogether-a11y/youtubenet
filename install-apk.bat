@echo off
setlocal EnableDelayedExpansion

:: ============================================================================
:: CONFIGURATION & VARIABLES (CUSTOMIZE ON TOP)
:: ============================================================================
set "REPO_OWNER=baobabitogether-a11y"
set "REPO_NAME=youtubenet"
set "DEFAULT_VERSION=v1.0.3"
set "APK_NAME=YouTube-Viewer-debug.apk"
set "PACKAGE_NAME=com.ytviewer.app"
set "MAIN_ACTIVITY=com.ytviewer.app/.MainActivity"
set "DOWNLOAD_DIR=%USERPROFILE%\Downloads"

:: Use command line argument if provided, otherwise default version
if "%~1"=="" (
    set "VERSION=%DEFAULT_VERSION%"
) else (
    set "VERSION=%~1"
)

set "APK_FILE=%DOWNLOAD_DIR%\%APK_NAME%"
set "DOWNLOAD_URL=https://github.com/%REPO_OWNER%/%REPO_NAME%/releases/download/%VERSION%/%APK_NAME%"

:: ============================================================================
:: BANNER & SUMMARY
:: ============================================================================
echo ================================================================
echo    YouTube Viewer - Automated ADB Installation Script
echo ================================================================
echo  Repository  : %REPO_OWNER%/%REPO_NAME%
echo  Version Tag : %VERSION%
echo  APK Name    : %APK_NAME%
echo  Target Path : %APK_FILE%
echo  Package     : %PACKAGE_NAME%
echo  Download URL: %DOWNLOAD_URL%
echo ================================================================
echo.

:: ============================================================================
:: 0. CHECK PREREQUISITES: ADB AVAILABILITY
:: ============================================================================
where adb >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] 'adb' is not found in PATH. Checking common Android SDK locations...
    if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
        set "PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools;%PATH%"
        echo [+] Found adb at %LOCALAPPDATA%\Android\Sdk\platform-tools
    ) else (
        echo [ERROR] ADB is not installed or not in your PATH.
        echo Please install Android platform-tools or add adb to your system PATH.
        pause
        exit /b 1
    )
)

:: Check for connected Android devices
echo [*] Checking connected ADB devices...
adb get-state >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARNING] No authorized device found via 'adb get-state'.
    echo Currently detected devices:
    adb devices
    echo.
    echo Please make sure USB debugging is enabled on your phone and device is authorized.
    echo Press any key to continue anyway, or close this window to cancel...
    pause >nul
) else (
    echo [+] Connected device detected.
)
echo.

:: ============================================================================
:: 1. REMOVE PREVIOUS DOWNLOADED APK
:: ============================================================================
echo [*] Removing existing APK from: %APK_FILE%
if exist "%APK_FILE%" (
    del /f /q "%APK_FILE%"
    if exist "%APK_FILE%" (
        echo [!] Warning: Could not delete existing APK file.
    ) else (
        echo [+] Old APK successfully removed.
    )
) else (
    echo [+] No previous APK file to delete.
)
echo.

:: ============================================================================
:: 2. DOWNLOAD LATEST APK VIA CURL (WITH -L TO FOLLOW GITHUB REDIRECTS)
:: ============================================================================
echo [*] Downloading %APK_NAME% (%VERSION%)...
echo [*] Executing curl with -L (follow GitHub 302 redirects) and -f (fail on HTTP error)...
curl -f -L --progress-bar "%DOWNLOAD_URL%" --output "%APK_FILE%"

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Failed to download APK from:
    echo %DOWNLOAD_URL%
    echo Please verify that the release tag "%VERSION%" and file "%APK_NAME%" exist.
    pause
    exit /b 1
)

if not exist "%APK_FILE%" (
    echo.
    echo [ERROR] Downloaded file does not exist at %APK_FILE%.
    pause
    exit /b 1
)

:: Verify file size is greater than 100KB (GitHub error redirect pages are usually <2KB)
for %%F in ("%APK_FILE%") do (
    set "FILE_SIZE=%%~zF"
)
if !FILE_SIZE! LSS 100000 (
    echo.
    echo [ERROR] Downloaded file is too small (!FILE_SIZE! bytes). It may be an error page instead of a valid APK.
    pause
    exit /b 1
)

echo [+] Successfully downloaded APK: !FILE_SIZE! bytes
echo.

:: ============================================================================
:: 3. UNINSTALL OLD PACKAGE
:: ============================================================================
echo [*] Uninstalling existing %PACKAGE_NAME% from device...
adb uninstall %PACKAGE_NAME%
if %ERRORLEVEL% neq 0 (
    echo [i] Note: Uninstall returned non-zero (app was likely not installed previously). Continuing...
) else (
    echo [+] Old app version uninstalled.
)
echo.

:: ============================================================================
:: 4. INSTALL NEW APK
:: ============================================================================
echo [*] Installing fresh APK via ADB...
adb install -r -d "%APK_FILE%"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] ADB installation failed!
    pause
    exit /b 1
)
echo [+] App installed successfully!
echo.

:: ============================================================================
:: 5. LAUNCH MAIN ACTIVITY
:: ============================================================================
echo [*] Launching %MAIN_ACTIVITY%...
adb shell am start -n %MAIN_ACTIVITY%
if %ERRORLEVEL% neq 0 (
    echo [!] Warning: Could not start main activity automatically. Please open the app manually on your device.
) else (
    echo [+] YouTube Viewer launched successfully on device!
)

echo.
echo ================================================================
echo    INSTALLATION COMPLETE!
echo ================================================================
echo.
pause
