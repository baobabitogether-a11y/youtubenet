import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Download,
  Terminal,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Code2,
  FolderArchive,
  FileCode,
  GitBranch,
} from 'lucide-react';
import JSZip from 'jszip';

interface ApkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  onInstall: () => void;
}

const KOTLIN_CODE = `package com.ytviewer.app

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.charset.StandardCharsets

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val okHttpClient = OkHttpClient.Builder().build()
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val TAG = "YT_CAPTION_INTERCEPTOR"
        private const val APP_URL = "https://ais-pre-jvmryifbax5a2rcbkml22h-93170524797.europe-west2.run.app"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.setBackgroundColor(Color.parseColor("#0f0f12"))
        WebView.setWebContentsDebuggingEnabled(true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            useWideViewPort = true
            loadWithOverviewMode = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            userAgentString = userAgentString.replace("; wv", "")
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.addJavascriptInterface(AndroidNativeBridge(this), "AndroidNativeShell")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                Log.d("WebViewConsole", "\${consoleMessage?.message()} [\${consoleMessage?.sourceId()}:\${consoleMessage?.lineNumber()}]")
                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url.toString()
                val host = request?.url?.host
                val path = request?.url?.path ?: ""

                if (url.contains("youtube.com/api/timedtext") || url.contains("/timedtext?")) {
                    try {
                        val requestBuilder = Request.Builder().url(url)
                        request?.requestHeaders?.forEach { (k, v) -> requestBuilder.addHeader(k, v) }
                        val response = okHttpClient.newCall(requestBuilder.build()).execute()
                        val rawBytes = response.body?.bytes() ?: ByteArray(0)
                        val rawString = String(rawBytes, StandardCharsets.UTF_8)
                        val contentType = response.header("Content-Type", "text/xml; charset=utf-8") ?: "text/xml"

                        saveCaptionToFile(rawBytes)
                        dispatchToJavaScript(url, rawString, contentType, response.code)

                        return WebResourceResponse(
                            contentType.split(";")[0].trim(),
                            "UTF-8",
                            ByteArrayInputStream(rawBytes)
                        )
                    } catch (e: Exception) {
                        Log.e(TAG, "Error intercepting caption: \${e.message}", e)
                    }
                }

                if (host == "appassets.androidplatform.net") {
                    val cleanPath = path.removePrefix("/")
                    val assetPath = if (cleanPath.isEmpty() || cleanPath == "/") "index.html" else cleanPath
                    try {
                        val inputStream = assets.open(assetPath)
                        val mimeType = when {
                            assetPath.endsWith(".html") -> "text/html"
                            assetPath.endsWith(".js") || assetPath.endsWith(".mjs") -> "application/javascript"
                            assetPath.endsWith(".css") -> "text/css"
                            assetPath.endsWith(".json") || assetPath.endsWith(".webmanifest") -> "application/json"
                            assetPath.endsWith(".svg") -> "image/svg+xml"
                            assetPath.endsWith(".png") -> "image/png"
                            assetPath.endsWith(".ico") -> "image/x-icon"
                            assetPath.endsWith(".woff2") -> "font/woff2"
                            else -> "application/octet-stream"
                        }
                        return WebResourceResponse(mimeType, "UTF-8", 200, "OK", mapOf("Access-Control-Allow-Origin" to "*"), inputStream)
                    } catch (e: Exception) {
                        if (!assetPath.contains(".")) {
                            try {
                                val indexStream = assets.open("index.html")
                                return WebResourceResponse("text/html", "UTF-8", 200, "OK", mapOf("Access-Control-Allow-Origin" to "*"), indexStream)
                            } catch (_: Exception) {}
                        }
                        val loaderResponse = assetLoader.shouldInterceptRequest(request!!.url)
                        if (loaderResponse != null) return loaderResponse
                    }
                }

                return super.shouldInterceptRequest(view, request)
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                Log.e(TAG, "WebView error loading \${request?.url}: \${error?.description}")
                super.onReceivedError(view, request, error)
            }
        }

        val hasBundledAssets = try {
            assets.open("index.html").close()
            true
        } catch (e: Exception) {
            false
        }

        if (hasBundledAssets) {
            webView.loadUrl("https://appassets.androidplatform.net/index.html")
        } else {
            webView.loadUrl(APP_URL)
        }
    }

    private fun saveCaptionToFile(data: ByteArray) {
        try {
            val dir = File(getExternalFilesDir(null), "youtube_captions")
            if (!dir.exists()) dir.mkdirs()
            val file = File(dir, "caption_\${System.currentTimeMillis()}.xml")
            FileOutputStream(file).use { it.write(data) }
            Log.i(TAG, "Saved raw caption to: \${file.absolutePath}")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving: \${e.message}")
        }
    }

    private fun dispatchToJavaScript(url: String, rawData: String, contentType: String, status: Int) {
        mainHandler.post {
            try {
                val payload = JSONObject().apply {
                    put("url", url)
                    put("status", status)
                    put("contentType", contentType)
                    put("rawData", rawData)
                    put("timestamp", System.currentTimeMillis())
                    put("bytes", rawData.toByteArray(StandardCharsets.UTF_8).size)
                    put("source", "native_webview_interceptor")
                }
                val base64 = Base64.encodeToString(payload.toString().toByteArray(StandardCharsets.UTF_8), Base64.NO_WRAP)
                webView.evaluateJavascript("if (window.onNativeCaptionsInterceptedBase64) { window.onNativeCaptionsInterceptedBase64('$base64'); }", null)
            } catch (e: Exception) {
                Log.e(TAG, "JS dispatch error: \${e.message}")
            }
        }
    }

    inner class AndroidNativeBridge(private val context: Context) {
        @JavascriptInterface
        fun isNativeShell(): Boolean = true

        @JavascriptInterface
        fun showToast(msg: String) {
            mainHandler.post { Toast.makeText(context, msg, Toast.LENGTH_SHORT).show() }
        }

        @JavascriptInterface
        fun speak(text: String, lang: String, rate: Float, utteranceId: String): Boolean {
            if (!isTtsReady || textToSpeech == null) return false
            mainHandler.post {
                try {
                    textToSpeech?.language = Locale(lang)
                    textToSpeech?.setSpeechRate(rate)
                    textToSpeech?.speak(text, TextToSpeech.QUEUE_FLUSH, Bundle(), utteranceId)
                } catch (e: Exception) {
                    Log.e(TAG, "TTS speak error: \${e.message}")
                }
            }
            return true
        }

        @JavascriptInterface
        fun stopSpeaking() {
            mainHandler.post { textToSpeech?.stop() }
        }

        @JavascriptInterface
        fun isSpeaking(): Boolean = textToSpeech?.isSpeaking ?: false
    }
}`;

const MANIFEST_XML = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="YouTube Viewer"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true"
        android:theme="@style/Theme.App">
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

const GRADLE_KTS = `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.ytviewer.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ytviewer.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.webkit:webkit:1.10.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
`;

const WORKFLOW_YML = `name: Build & Release Android APK

on:
  push:
    branches: [main, master]
    tags: ['v*']
  workflow_dispatch:
    inputs:
      tag_name:
        description: 'Release Tag (e.g. v1.0.0)'
        required: false
        default: ''
      is_prerelease:
        description: 'Mark as pre-release'
        required: false
        type: boolean
        default: false
      run_e2e_tests:
        description: 'Run E2E UI verification tests and produce video artifact'
        required: false
        type: boolean
        default: true

permissions:
  contents: write

jobs:
  build-and-release:
    name: Build & Publish APK
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - name: Bundle Web Assets into Android
        run: |
          mkdir -p android-shell/app/src/main/assets
          cp -r dist/* android-shell/app/src/main/assets/
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - name: Accept Android SDK Licenses
        run: yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses 2>/dev/null || true
      - uses: gradle/actions/setup-gradle@v3
        with:
          build-root-directory: android-shell
      - name: Build APKs
        run: |
          chmod +x android-shell/gradlew
          cd android-shell
          echo "sdk.dir=$ANDROID_HOME" > local.properties
          ./gradlew assembleRelease --stacktrace
      - name: Organize Artifacts
        if: always()
        run: |
          mkdir -p release-artifacts
          find android-shell/app/build/outputs/apk/release -type f -name "*.apk" -exec cp {} release-artifacts/YouTube-Viewer-release.apk \\; 2>/dev/null || true
          find android-shell/app/build/outputs/apk/debug -type f -name "*.apk" -exec cp {} release-artifacts/YouTube-Viewer-debug.apk \\; 2>/dev/null || true
          cd release-artifacts
          for apk in *.apk; do [ -f "$apk" ] && sha256sum "$apk" > "$apk.sha256"; done
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: youtube-viewer-apks
          path: release-artifacts/*
          if-no-files-found: ignore
      - uses: softprops/action-gh-release@v2
        if: success() && (startsWith(github.ref, 'refs/tags/') || github.event_name == 'workflow_dispatch' || github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master')
        continue-on-error: true
        with:
          tag_name: \${{ github.event.inputs.tag_name || github.ref_name || 'v1.0.0' }}
          files: release-artifacts/*
          fail_on_unmatched_files: false
          token: \${{ secrets.GITHUB_TOKEN }}
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
      - name: Install Playwright Browsers
        if: (!cancelled()) && (github.event.inputs.run_e2e_tests != 'false')
        run: npx playwright install --with-deps chromium
      - name: Run E2E Test Suite & Record Video
        if: (!cancelled()) && (github.event.inputs.run_e2e_tests != 'false')
        run: |
          mkdir -p e2e-video-artifacts
          npx playwright test || true
          count=1
          find test-results -type f \\( -name "*.webm" -o -name "*.mp4" \\) | while read -r vid; do
            cp "$vid" "e2e-video-artifacts/youtube-viewer-e2e-run-\${count}.webm"
            cp "$vid" "e2e-video-artifacts/youtube-viewer-e2e-run.webm"
            count=$((count+1))
          done
      - name: Upload E2E Test Video Artifact
        if: (!cancelled()) && (github.event.inputs.run_e2e_tests != 'false')
        uses: actions/upload-artifact@v4
        with:
          name: e2e-test-video-recording
          path: e2e-video-artifacts/*
          retention-days: 14`;

export const ApkGuideModal: React.FC<ApkGuideModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  onInstall,
}) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [selectedCodeTab, setSelectedCodeTab] = useState<'kotlin' | 'manifest' | 'gradle' | 'workflow'>('workflow');
  const [isZipping, setIsZipping] = useState(false);

  if (!isOpen) return null;

  const currentAppUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const pwaBuilderUrl = `https://www.pwabuilder.com/?site=${encodeURIComponent(currentAppUrl)}`;

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCmd(id);
      setTimeout(() => setCopiedCmd(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadProjectZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      // README
      zip.file(
        'README.md',
        `# YouTube Viewer Android Shell APK Project\n\nThis project provides a native Android APK wrapper that intercepts HTTP requests to YouTube caption endpoints (youtube.com/api/timedtext).\n\n### How to Build:\n1. Open Android Studio.\n2. Select "Open" and choose this unzipped folder.\n3. Click "Build" > "Build Bundle(s) / APK(s)" > "Build APK(s)".\n4. Your APK will be compiled at app/build/outputs/apk/debug/app-debug.apk!`
      );

      // Root Gradle
      zip.file(
        'build.gradle.kts',
        `plugins {\n    id("com.android.application") version "8.2.2" apply false\n    id("org.jetbrains.kotlin.android") version "1.9.22" apply false\n}`
      );
      zip.file(
        'settings.gradle.kts',
        `pluginManagement {\n    repositories {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\ndependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)\n    repositories {\n        google()\n        mavenCentral()\n    }\n}\nrootProject.name = "YouTubeViewerShell"\ninclude(":app")`
      );

      // GitHub Actions CI/CD Workflow
      zip.file('.github/workflows/release-apk.yml', WORKFLOW_YML);

      // Gradle properties
      zip.file(
        'gradle.properties',
        'org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nandroid.nonTransitiveRClass=true\norg.gradle.daemon=true\n'
      );

      // App folder
      const app = zip.folder('app');
      if (app) {
        app.file('build.gradle.kts', GRADLE_KTS);
        app.file('proguard-rules.pro', '# ProGuard rules for YouTube Viewer Android Shell\n-keepattributes *Annotation*\n-keepattributes JavascriptInterface\n-keepclassmembers class * {\n    @android.webkit.JavascriptInterface <methods>;\n}\n-dontwarn okhttp3.**\n-dontwarn okio.**\n');
        const main = app.folder('src')?.folder('main');
        if (main) {
          main.file('AndroidManifest.xml', MANIFEST_XML);
          const pkg = main.folder('java')?.folder('com')?.folder('ytviewer')?.folder('app');
          if (pkg) {
            pkg.file('MainActivity.kt', KOTLIN_CODE);
          }
          const res = main.folder('res');
          if (res) {
            const values = res.folder('values');
            values?.file('themes.xml', '<resources>\n    <style name="Theme.App" parent="Theme.MaterialComponents.DayNight.NoActionBar">\n        <item name="android:statusBarColor">#0f0f0f</item>\n        <item name="android:navigationBarColor">#0f0f0f</item>\n        <item name="android:windowBackground">#0f0f0f</item>\n    </style>\n</resources>');
            values?.file('strings.xml', '<resources>\n    <string name="app_name">YouTube Viewer</string>\n</resources>');
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'YouTubeViewer-Android-Shell-Project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-100 shadow-2xl p-4 sm:p-6">
        {/* Close Button */}
        <button
          id="close-apk-guide-modal-button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          title="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-500/30">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Android APK & Network Traffic Interception
            </h3>
            <p className="text-xs text-neutral-400">
              Complete implementation for capturing raw YouTube captions (<code className="text-neutral-300">/api/timedtext</code>)
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Option 2: Native Android APK Shell with Network Interception (PRIMARY) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-neutral-850 border border-red-500/40 shadow-lg flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-red-600 text-white text-xs font-bold">
                  OPTION 2 (Selected)
                </span>
                <h4 className="text-sm sm:text-base font-bold text-white">
                  Native Android WebView Shell APK (Network Interceptor)
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Accesses Raw HTTP Traffic
              </span>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              In a native Android APK, <code className="text-red-400">WebViewClient.shouldInterceptRequest</code> intercepts the YouTube player&apos;s HTTP request to <code className="text-neutral-200">youtube.com/api/timedtext</code>, fetches the raw body stream via <code className="text-neutral-200">OkHttpClient</code>, writes the raw XML/JSON to Android storage, and dispatches the raw data to the web view.
            </p>

            {/* Quick Download Zip Button */}
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-neutral-900 border border-neutral-750">
              <button
                onClick={handleDownloadProjectZip}
                disabled={isZipping}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-semibold shadow-md transition active:scale-95 disabled:opacity-50"
              >
                <FolderArchive className="w-4 h-4" />
                <span>{isZipping ? 'Packaging ZIP...' : 'Download Android Studio Project (.ZIP)'}</span>
              </button>
              <span className="text-xs text-neutral-400">
                Ready to open in Android Studio and build <code className="text-neutral-200">app-debug.apk</code>
              </span>
            </div>

            {/* Source Code Viewer Tabs */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between border-b border-neutral-750 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedCodeTab('workflow')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                      selectedCodeTab === 'workflow'
                        ? 'bg-red-600/20 text-red-300 border border-red-500/40'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>release-apk.yml (CI/CD)</span>
                  </button>

                  <button
                    onClick={() => setSelectedCodeTab('kotlin')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                      selectedCodeTab === 'kotlin'
                        ? 'bg-red-600/20 text-red-300 border border-red-500/40'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>MainActivity.kt</span>
                  </button>

                  <button
                    onClick={() => setSelectedCodeTab('manifest')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                      selectedCodeTab === 'manifest'
                        ? 'bg-red-600/20 text-red-300 border border-red-500/40'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>AndroidManifest.xml</span>
                  </button>

                  <button
                    onClick={() => setSelectedCodeTab('gradle')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                      selectedCodeTab === 'gradle'
                        ? 'bg-red-600/20 text-red-300 border border-red-500/40'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>build.gradle.kts</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    const code =
                      selectedCodeTab === 'workflow'
                        ? WORKFLOW_YML
                        : selectedCodeTab === 'kotlin'
                        ? KOTLIN_CODE
                        : selectedCodeTab === 'manifest'
                        ? MANIFEST_XML
                        : GRADLE_KTS;
                    handleCopy(code, selectedCodeTab);
                  }}
                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition"
                >
                  {copiedCmd === selectedCodeTab ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="max-h-56 overflow-auto p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-neutral-300 leading-relaxed">
                {selectedCodeTab === 'workflow' && WORKFLOW_YML}
                {selectedCodeTab === 'kotlin' && KOTLIN_CODE}
                {selectedCodeTab === 'manifest' && MANIFEST_XML}
                {selectedCodeTab === 'gradle' && GRADLE_KTS}
              </pre>
            </div>

            {/* GitHub Actions CI/CD Automated Release Callout */}
            <div className="p-3.5 rounded-xl bg-neutral-900 border border-emerald-500/30 text-xs text-neutral-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  GitHub Actions Automated Release (.github/workflows/release-apk.yml)
                </span>
                <span className="text-[11px] text-emerald-400 font-mono">assembleRelease & assembleDebug</span>
              </div>
              <p className="text-neutral-400 text-[11px] leading-relaxed">
                Every push to <code className="text-neutral-200">main</code> or git tag (e.g. <code className="text-neutral-200">v1.0.0</code>) triggers GitHub Actions to bundle the web player into Android assets, compile the Kotlin interceptor, attach signed <code className="text-emerald-400">YouTube-Viewer-release.apk</code> files to the GitHub Release, and run automated E2E tests generating a downloadable <strong>video artifact</strong> (<code className="text-emerald-300">youtube-viewer-e2e-run.webm</code>)!
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] text-neutral-400">Quick Release:</span>
                <code className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-200 font-mono">
                  git tag v1.0.0 && git push --tags
                </code>
              </div>
              <div className="pt-1 text-[11px] text-neutral-400 border-t border-neutral-800">
                <span className="text-amber-400 font-medium">Tip:</span> Ensure GitHub repo <code className="text-neutral-300">Settings &gt; Actions &gt; General &gt; Workflow permissions</code> is set to <strong>"Read and write permissions"</strong> so the workflow can attach APKs to Releases. (APKs are also always uploaded under GitHub Actions <strong>Artifacts</strong>).
              </div>
            </div>

            {/* Steps to compile APK */}
            <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-750 text-xs text-neutral-300 space-y-1">
              <p className="font-semibold text-white">Alternative: Local build in Android Studio:</p>
              <ol className="list-decimal list-inside space-y-1 text-neutral-400">
                <li>Download the ZIP or open the <code className="text-neutral-200">/android-shell</code> folder in Android Studio.</li>
                <li>Let Gradle sync dependencies (<code className="text-neutral-200">OkHttp 4.12</code> and <code className="text-neutral-200">AndroidX WebKit</code>).</li>
                <li>Run <code className="text-neutral-200">./gradlew assembleRelease</code> or click <strong>Build</strong> &gt; <strong>Build APK(s)</strong>. Your signed APK is ready in <code className="text-neutral-200">app/build/outputs/apk/release/</code>!</li>
              </ol>
            </div>
          </div>

          {/* Other options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Direct WebAPK */}
            <div className="p-3.5 rounded-xl bg-neutral-850 border border-neutral-750 flex flex-col justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-white">
                  Alternative: Instant WebAPK
                </h4>
                <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                  Generates an Android PWA app directly on your phone without compilation.
                </p>
              </div>
              {isInstallable ? (
                <button
                  onClick={() => {
                    onInstall();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-xs font-semibold text-neutral-200 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install WebAPK</span>
                </button>
              ) : (
                <span className="text-[10px] text-neutral-500">
                  Open Chrome menu &gt; Add to Home screen
                </span>
              )}
            </div>

            {/* PWABuilder */}
            <div className="p-3.5 rounded-xl bg-neutral-850 border border-neutral-750 flex flex-col justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-white">
                  Alternative: Cloud PWABuilder
                </h4>
                <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                  Generate signed APK cloud package from your hosted web app URL.
                </p>
              </div>
              <a
                href={pwaBuilderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-xs font-semibold text-neutral-200 transition"
              >
                <span>Open PWABuilder</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div className="mt-5 pt-4 border-t border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Full Android Studio project source files generated</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
