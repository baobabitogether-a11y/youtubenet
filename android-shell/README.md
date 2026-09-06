# Android Native WebView Shell with Network Interception

This Android Studio project embeds the YouTube Viewer web application inside a native `WebView` and intercepts HTTP network traffic for YouTube captions (`/api/timedtext`).

### How It Works

1. `WebViewClient.shouldInterceptRequest(view, request)` listens for any HTTP `GET` requests matching `youtube.com/api/timedtext`.
2. When detected, it executes the request directly via `OkHttpClient` while preserving all original HTTP headers and cookies.
3. The raw response body (XML, JSON3, or VTT) is:
   - Saved locally to disk at `context.getExternalFilesDir(null)/youtube_captions/`.
   - Dispatched into the web runtime via `window.onNativeCaptionsInterceptedBase64(...)`.
   - Returned as a `WebResourceResponse` stream to the WebView so the video player functions uninterrupted.

### Automated Build & Release via GitHub Actions

This repository includes a fully automated GitHub Actions pipeline (`.github/workflows/release-apk.yml`) that compiles and releases working, signed APKs:

1. **Automatic Releases on Tag or Push**:
   - Pushing a version tag (e.g. `v1.0.0`) or pushing to `main` builds both `YouTube-Viewer-release.apk` and `YouTube-Viewer-debug.apk`.
   - Creates a GitHub Release with direct download links and SHA256 checksums.
2. **Manual Trigger (`workflow_dispatch`)**:
   - In GitHub, navigate to **Actions** > **Build & Release Android APK**.
   - Click **Run workflow**, optionally specify a tag name (e.g. `v1.0.1`), and click **Run workflow**.
   - Within 2-3 minutes, the signed APKs will be attached to a new GitHub Release and downloadable as workflow artifacts!

### Manual Build in Android Studio

1. Open Android Studio.
2. Select **Open**, navigate to this `/android-shell` directory, and click **OK**.
3. Let Gradle sync dependencies (`OkHttp`, `AndroidX WebKit`).
4. Run `./gradlew assembleRelease` or click **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
5. Android Studio outputs:
   - `app/build/outputs/apk/release/app-release.apk` (Signed Release APK)
   - `app/build/outputs/apk/debug/app-debug.apk` (Debug APK)
6. Transfer the APK to your phone or run on an emulator!
