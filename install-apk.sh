#!/usr/bin/env bash
set -e

# ============================================================================
# CONFIGURATION & VARIABLES (CUSTOMIZE ON TOP)
# ============================================================================
REPO_OWNER="baobabitogether-a11y"
REPO_NAME="youtubenet"
VERSION="${1:-v1.0.3}"
APK_NAME="YouTube-Viewer-debug.apk"
PACKAGE_NAME="com.ytviewer.app"
MAIN_ACTIVITY="com.ytviewer.app/.MainActivity"

# Determine downloads folder (OS-aware)
if [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* ]]; then
  DOWNLOAD_DIR="${USERPROFILE:-$HOME}/Downloads"
else
  DOWNLOAD_DIR="${HOME}/Downloads"
fi

APK_FILE="${DOWNLOAD_DIR}/${APK_NAME}"
DOWNLOAD_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${VERSION}/${APK_NAME}"

echo "================================================================"
echo "   YouTube Viewer - Automated ADB Installation Script"
echo "================================================================"
echo " Repository  : ${REPO_OWNER}/${REPO_NAME}"
echo " Version Tag : ${VERSION}"
echo " APK Name    : ${APK_NAME}"
echo " Target Path : ${APK_FILE}"
echo " Package     : ${PACKAGE_NAME}"
echo " Download URL: ${DOWNLOAD_URL}"
echo "================================================================"
echo ""

# 0. Check ADB availability
if ! command -v adb &> /dev/null; then
  echo "[ERROR] 'adb' command not found in PATH."
  echo "Please install Android platform-tools or add adb to your PATH."
  exit 1
fi

echo "[*] Checking connected ADB devices..."
adb devices

# 1. Remove previous downloaded APK
echo "[*] Removing existing APK from: ${APK_FILE}"
rm -f "${APK_FILE}"

# 2. Download latest APK via curl (with -L to follow GitHub release 302 redirects)
echo "[*] Downloading ${APK_NAME} (${VERSION})..."
curl -f -L --progress-bar "${DOWNLOAD_URL}" --output "${APK_FILE}"

# Verify file exists and has size
if [ ! -s "${APK_FILE}" ]; then
  echo "[ERROR] Downloaded file is empty or missing: ${APK_FILE}"
  exit 1
fi

FILE_SIZE=$(wc -c < "${APK_FILE}")
if [ "$FILE_SIZE" -lt 100000 ]; then
  echo "[ERROR] Downloaded file is too small (${FILE_SIZE} bytes). It may be an error page."
  exit 1
fi
echo "[+] Download complete (${FILE_SIZE} bytes)."

# 3. Uninstall old package
echo "[*] Uninstalling existing ${PACKAGE_NAME} from device..."
adb uninstall "${PACKAGE_NAME}" || echo "[i] Note: Uninstall returned non-zero (app was not previously installed). Continuing..."

# 4. Install new APK
echo "[*] Installing APK via ADB..."
adb install -r -d "${APK_FILE}"

# 5. Launch Main Activity
echo "[*] Launching ${MAIN_ACTIVITY}..."
adb shell am start -n "${MAIN_ACTIVITY}"

echo ""
echo "================================================================"
echo "   INSTALLATION COMPLETE! Application launched on device."
echo "================================================================"
