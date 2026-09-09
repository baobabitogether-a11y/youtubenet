#!/usr/bin/env bash
# ============================================================================
# YouTube Viewer - Automated ADB Installation Script
# ============================================================================

# Disable exit on error for ADB section so uninstall failure doesn't abort
set +e

REPO_OWNER="baobabitogether-a11y"
REPO_NAME="youtubenet"
VERSION="${1:-v1.0.5}"
APK_NAME="YouTube-Viewer-debug.apk"
PACKAGE_NAME="com.ytviewer.app"
MAIN_ACTIVITY="com.ytviewer.app/.MainActivity"

# Determine downloads folder (OS-aware & path-safe for Windows Git Bash / Cygwin / macOS / Linux)
if [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* || "$OSTYPE" == "win32"* ]]; then
  USER_BASE="${USERPROFILE:-$HOME}"
  # Normalize backslashes to forward slashes for bash operations
  USER_BASE="${USER_BASE//\\//}"
  DOWNLOAD_DIR="${USER_BASE}/Downloads"
else
  DOWNLOAD_DIR="${HOME}/Downloads"
fi

APK_FILE="${DOWNLOAD_DIR}/${APK_NAME}"
DOWNLOAD_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${VERSION}/${APK_NAME}"

# Format path for Windows-native adb.exe if running under Git Bash / MSYS / Cygwin
if command -v cygpath &> /dev/null; then
  ADB_APK_PATH=$(cygpath -w "${APK_FILE}")
elif [[ "$APK_FILE" =~ ^([a-zA-Z]):/(.*) ]]; then
  DRIVE="${BASH_REMATCH[1]}"
  REST="${BASH_REMATCH[2]}"
  ADB_APK_PATH="${DRIVE}:\\${REST//\//\\}"
elif [[ "$APK_FILE" =~ ^/([a-zA-Z])/(.*) ]]; then
  DRIVE="${BASH_REMATCH[1]}"
  REST="${BASH_REMATCH[2]}"
  ADB_APK_PATH="${DRIVE^^}:\\${REST//\//\\}"
else
  ADB_APK_PATH="${APK_FILE//\//\\}"
fi

echo "================================================================"
echo "   YouTube Viewer - Automated ADB Installation Script"
echo "================================================================"
echo " Repository  : ${REPO_OWNER}/${REPO_NAME}"
echo " Version Tag : ${VERSION}"
echo " APK Name    : ${APK_NAME}"
echo " Target Path : ${APK_FILE}"
echo " ADB Path    : ${ADB_APK_PATH}"
echo " Package     : ${PACKAGE_NAME}"
echo " Download URL: ${DOWNLOAD_URL}"
echo "================================================================"
echo ""

# 0. Check ADB availability
if ! command -v adb &> /dev/null; then
  # Check standard Android SDK locations on Windows
  if [ -n "$LOCALAPPDATA" ] && [ -f "${LOCALAPPDATA//\\//}/Android/Sdk/platform-tools/adb.exe" ]; then
    export PATH="${LOCALAPPDATA//\\//}/Android/Sdk/platform-tools:$PATH"
    echo "[+] Found adb in Android SDK platform-tools."
  elif [ -f "/c/Users/${USER}/AppData/Local/Android/Sdk/platform-tools/adb.exe" ]; then
    export PATH="/c/Users/${USER}/AppData/Local/Android/Sdk/platform-tools:$PATH"
    echo "[+] Found adb in standard AppData location."
  else
    echo "[ERROR] 'adb' command not found in PATH."
    echo "Please install Android platform-tools or add adb to your PATH."
    exit 1
  fi
fi

echo "[*] Checking connected ADB devices..."
adb devices
echo ""

# Check if at least one device is online
DEVICE_ID=$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')
if [ -z "$DEVICE_ID" ]; then
  echo "[WARNING] No active Android device detected in 'device' state."
  echo "Make sure USB debugging is enabled and your device is authorized."
  echo "Continuing with default device..."
  ADB_CMD="adb"
else
  echo "[+] Detected connected device: ${DEVICE_ID}"
  ADB_CMD="adb -s ${DEVICE_ID}"
fi
echo ""

# 1. Remove previous downloaded APK
echo "[*] Removing existing APK from: ${APK_FILE}"
rm -f "${APK_FILE}" 2>/dev/null || true

# 2. Download latest APK via curl
echo "[*] Downloading ${APK_NAME} (${VERSION})..."
curl -f -L --progress-bar "${DOWNLOAD_URL}" --output "${APK_FILE}"

# Verify file exists and has size
if [ ! -s "${APK_FILE}" ]; then
  echo "[ERROR] Downloaded file is empty or missing: ${APK_FILE}"
  exit 1
fi

FILE_SIZE=$(wc -c < "${APK_FILE}" | tr -d '[:space:]')
if [ "$FILE_SIZE" -lt 100000 ]; then
  echo "[ERROR] Downloaded file is too small (${FILE_SIZE} bytes). It may be an error page."
  exit 1
fi
echo "[+] Download complete (${FILE_SIZE} bytes)."
echo ""

# 3. Uninstall old package from device
echo "[*] Uninstalling existing ${PACKAGE_NAME} from device..."
UNINSTALL_OUTPUT=$($ADB_CMD uninstall "${PACKAGE_NAME}" 2>&1 || true)
echo "$UNINSTALL_OUTPUT"
if echo "$UNINSTALL_OUTPUT" | grep -iq "Success"; then
  echo "[+] Successfully uninstalled previous version."
else
  echo "[i] Note: App was not previously installed or was cleanly removed."
fi
echo ""

# 4. Install new APK
echo "[*] Installing APK to device: ${ADB_APK_PATH}..."
INSTALL_OUTPUT=$($ADB_CMD install -r -d "${ADB_APK_PATH}" 2>&1 || true)
echo "$INSTALL_OUTPUT"

# Fallback: if Windows path fails, try bash path
if echo "$INSTALL_OUTPUT" | grep -iq "Failure" || ! echo "$INSTALL_OUTPUT" | grep -iq "Success"; then
  echo "[!] Retrying installation with POSIX path (${APK_FILE})..."
  INSTALL_OUTPUT_POSIX=$($ADB_CMD install -r -d "${APK_FILE}" 2>&1 || true)
  echo "$INSTALL_OUTPUT_POSIX"
  if ! echo "$INSTALL_OUTPUT_POSIX" | grep -iq "Success"; then
    echo "[!] Retrying with permission grant flag (-g)..."
    $ADB_CMD install -r -d -g "${ADB_APK_PATH}" 2>&1 || true
  fi
fi
echo ""

# 5. Launch Main Activity
echo "[*] Launching ${MAIN_ACTIVITY} on device..."
LAUNCH_OUTPUT=$($ADB_CMD shell am start -n "${MAIN_ACTIVITY}" 2>&1 || true)
echo "$LAUNCH_OUTPUT"
echo ""

echo "================================================================"
echo "   INSTALLATION COMPLETE! Application launched on device."
echo "================================================================"
