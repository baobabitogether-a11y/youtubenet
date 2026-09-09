#!/usr/bin/env bash
# ============================================================================
# YouTube Viewer - Automated ADB Installation Script
# ============================================================================
# This script downloads the latest release APK from GitHub and installs
# it onto a connected Android device via ADB.
# Compatible with: Windows Git Bash (MINGW64 / MSYS2), macOS, and Linux.
# ============================================================================

set -uo pipefail

REPO_OWNER="baobabitogether-a11y"
REPO_NAME="youtubenet"
VERSION="${1:-v1.0.9}"
APK_NAME="YouTube-Viewer-debug.apk"
PACKAGE_NAME="com.ytviewer.app"
MAIN_ACTIVITY="com.ytviewer.app/.MainActivity"

# ----------------------------------------------------------------------------
# 1. Resolve Platform Paths (Git Bash on Windows vs macOS/Linux)
# ----------------------------------------------------------------------------
if [[ "${OSTYPE:-}" == "msys"* || "${OSTYPE:-}" == "cygwin"* || "${OSTYPE:-}" == "win32"* ]]; then
  # On Windows Git Bash: normalize USERPROFILE to forward slashes for bash
  WIN_USER="${USERPROFILE:-$HOME}"
  WIN_USER="${WIN_USER//\\//}"
  DOWNLOAD_DIR="${WIN_USER}/Downloads"
else
  DOWNLOAD_DIR="${HOME}/Downloads"
fi

mkdir -p "${DOWNLOAD_DIR}"
APK_FILE="${DOWNLOAD_DIR}/${APK_NAME}"
DOWNLOAD_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${VERSION}/${APK_NAME}"

# Compute a Windows-native path (e.g. C:\Users\User\Downloads\...) for adb.exe
if command -v cygpath &> /dev/null; then
  ADB_TARGET_PATH=$(cygpath -w "${APK_FILE}")
elif [[ "$APK_FILE" =~ ^([a-zA-Z]):/(.*) ]]; then
  DRIVE="${BASH_REMATCH[1]}"
  REST="${BASH_REMATCH[2]}"
  ADB_TARGET_PATH="${DRIVE^^}:\\${REST//\//\\}"
elif [[ "$APK_FILE" =~ ^/([a-zA-Z])/(.*) ]]; then
  DRIVE="${BASH_REMATCH[1]}"
  REST="${BASH_REMATCH[2]}"
  ADB_TARGET_PATH="${DRIVE^^}:\\${REST//\//\\}"
else
  ADB_TARGET_PATH="${APK_FILE}"
fi

echo "================================================================"
echo "   YouTube Viewer - Automated ADB Installation Script"
echo "================================================================"
echo " Repository  : ${REPO_OWNER}/${REPO_NAME}"
echo " Version Tag : ${VERSION}"
echo " APK Name    : ${APK_NAME}"
echo " Target Path : ${APK_FILE}"
echo " ADB Path    : ${ADB_TARGET_PATH}"
echo " Package     : ${PACKAGE_NAME}"
echo " Download URL: ${DOWNLOAD_URL}"
echo "================================================================"
echo ""

# ----------------------------------------------------------------------------
# 2. Check and Locate ADB
# ----------------------------------------------------------------------------
if ! command -v adb &> /dev/null; then
  FOUND_ADB=""
  # Check standard Android SDK locations on Windows
  if [ -n "${LOCALAPPDATA:-}" ] && [ -f "${LOCALAPPDATA//\\//}/Android/Sdk/platform-tools/adb.exe" ]; then
    FOUND_ADB="${LOCALAPPDATA//\\//}/Android/Sdk/platform-tools"
  elif [ -f "/c/Users/${USER:-User}/AppData/Local/Android/Sdk/platform-tools/adb.exe" ]; then
    FOUND_ADB="/c/Users/${USER:-User}/AppData/Local/Android/Sdk/platform-tools"
  elif [ -d "$HOME/Android/Sdk/platform-tools" ]; then
    FOUND_ADB="$HOME/Android/Sdk/platform-tools"
  fi

  if [ -n "$FOUND_ADB" ]; then
    export PATH="${FOUND_ADB}:${PATH}"
    echo "[+] Found ADB at: ${FOUND_ADB}"
  else
    echo "[ERROR] 'adb' command not found in your PATH."
    echo "Please ensure Android platform-tools is installed or adb is in PATH."
    exit 1
  fi
fi

# ----------------------------------------------------------------------------
# 3. Check Connected ADB Devices
# ----------------------------------------------------------------------------
echo "[*] Checking connected ADB devices..."
adb devices
echo ""

# Parse attached devices in 'device' state
DEVICE_ID=$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')

if [ -n "$DEVICE_ID" ]; then
  echo "[+] Target Android device selected: ${DEVICE_ID}"
  ADB_CMD="adb -s ${DEVICE_ID}"
else
  # Check if unauthorized or offline
  UNAUTH=$(adb devices | awk 'NR>1 && ($2=="unauthorized" || $2=="offline") {print $1; exit}')
  if [ -n "$UNAUTH" ]; then
    echo "[WARNING] Device ${UNAUTH} is detected but UNAUTHORIZED or OFFLINE."
    echo "Please check your phone screen and allow 'USB Debugging' prompt."
  else
    echo "[WARNING] No device detected in 'device' mode. Proceeding with default adb target."
  fi
  ADB_CMD="adb"
fi
echo ""

# ----------------------------------------------------------------------------
# 4. Clean & Download Latest APK
# ----------------------------------------------------------------------------
echo "[*] Cleaning up old download: ${APK_FILE}"
rm -f "${APK_FILE}" 2>/dev/null || true

echo "[*] Downloading ${APK_NAME} (${VERSION})..."
if ! curl -f -L --progress-bar "${DOWNLOAD_URL}" --output "${APK_FILE}"; then
  echo "[ERROR] Failed to download APK from: ${DOWNLOAD_URL}"
  echo "Verify your internet connection and that release ${VERSION} exists."
  exit 1
fi

# Verify file exists and has size > 100 KB
if [ ! -s "${APK_FILE}" ]; then
  echo "[ERROR] Download failed: ${APK_FILE} is missing or empty."
  exit 1
fi

FILE_SIZE=$(wc -c < "${APK_FILE}" | tr -dc '0-9')
if [ "${FILE_SIZE:-0}" -lt 100000 ]; then
  echo "[ERROR] Downloaded file is too small (${FILE_SIZE} bytes). It may be an HTTP error response."
  exit 1
fi
echo "[+] Download complete (${FILE_SIZE} bytes)."
echo ""

# ----------------------------------------------------------------------------
# 5. Uninstall Existing App from Device (Clean Slate)
# ----------------------------------------------------------------------------
echo "[*] Uninstalling existing ${PACKAGE_NAME} from device..."
UNINSTALL_RES=$($ADB_CMD uninstall "${PACKAGE_NAME}" 2>&1 || true)
echo "${UNINSTALL_RES}"
if echo "${UNINSTALL_RES}" | grep -iq "Success"; then
  echo "[+] Existing version removed."
else
  echo "[i] Clean state: previous version was not present or already removed."
fi
echo ""

# ----------------------------------------------------------------------------
# 6. Install New APK to Device
# ----------------------------------------------------------------------------
echo "[*] Installing APK to device (${ADB_TARGET_PATH})..."
INSTALL_SUCCESS=false

# Method A: Try native Windows path with replace & grant flags
INSTALL_OUTPUT=$($ADB_CMD install -r -d -t -g "${ADB_TARGET_PATH}" 2>&1 || true)
echo "${INSTALL_OUTPUT}"

if echo "${INSTALL_OUTPUT}" | grep -iq "Success"; then
  INSTALL_SUCCESS=true
fi

# Method B: If Windows path fails, try bash POSIX path
if [ "$INSTALL_SUCCESS" = false ]; then
  echo "[!] Retrying installation with POSIX path (${APK_FILE})..."
  INSTALL_OUTPUT_B=$($ADB_CMD install -r -d -t -g "${APK_FILE}" 2>&1 || true)
  echo "${INSTALL_OUTPUT_B}"
  if echo "${INSTALL_OUTPUT_B}" | grep -iq "Success"; then
    INSTALL_SUCCESS=true
  fi
fi

# Method C: Push to device temp directory and run pm install (bulletproof against path quirks)
if [ "$INSTALL_SUCCESS" = false ]; then
  echo "[!] Retrying via direct ADB push to /data/local/tmp/..."
  $ADB_CMD push "${APK_FILE}" /data/local/tmp/app-install.apk 2>&1 || \
    $ADB_CMD push "${ADB_TARGET_PATH}" /data/local/tmp/app-install.apk 2>&1 || true

  INSTALL_OUTPUT_C=$($ADB_CMD shell pm install -r -d -g /data/local/tmp/app-install.apk 2>&1 || true)
  echo "${INSTALL_OUTPUT_C}"
  $ADB_CMD shell rm -f /data/local/tmp/app-install.apk 2>/dev/null || true

  if echo "${INSTALL_OUTPUT_C}" | grep -iq "Success"; then
    INSTALL_SUCCESS=true
  fi
fi

if [ "$INSTALL_SUCCESS" = false ]; then
  echo ""
  echo "[ERROR] APK installation failed. Check ADB device connection and log above."
  exit 1
fi

echo "[+] APK installed successfully!"
echo ""

# ----------------------------------------------------------------------------
# 7. Launch Main Activity on Device
# ----------------------------------------------------------------------------
echo "[*] Launching ${MAIN_ACTIVITY} on device..."
LAUNCH_OUTPUT=$($ADB_CMD shell am start -n "${MAIN_ACTIVITY}" 2>&1 || true)
echo "${LAUNCH_OUTPUT}"
echo ""

echo "================================================================"
echo "   INSTALLATION COMPLETE! Application is running on device."
echo "================================================================"
