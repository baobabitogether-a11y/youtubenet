# Android Native WebView Shell with Network Interception

This Android Studio project embeds the YouTube Viewer web application inside a native `WebView` and intercepts HTTP network traffic for YouTube captions (`/api/timedtext`).

### How It Works

1. `WebViewClient.shouldInterceptRequest(view, request)` listens for any HTTP `GET` requests matching `youtube.com/api/timedtext`.
2. When detected, it executes the request directly via `OkHttpClient` while preserving all original HTTP headers and cookies.
3. The raw response body (XML, JSON3, or VTT) is:
   - Saved locally to disk at `context.getExternalFilesDir(null)/youtube_captions/`.
   - Dispatched into the web runtime via `window.onNativeCaptionsInterceptedBase64(...)`.
   - Returned as a `WebResourceResponse` stream to the WebView so the video player functions uninterrupted.

### How to Build the APK

1. Open Android Studio.
2. Select **Open**, navigate to this `/android-shell` directory, and click **OK**.
3. Let Gradle sync dependencies (`OkHttp`, `AndroidX WebKit`).
4. Click **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
5. Android Studio outputs `app/build/outputs/apk/debug/app-debug.apk`.
6. Transfer `app-debug.apk` to your phone or run on an emulator!
