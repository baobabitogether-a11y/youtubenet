package com.ytviewer.app

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
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

/**
 * Android Native Shell Activity
 * Intercepts YouTube caption HTTP requests (youtube.com/api/timedtext)
 * via WebViewClient.shouldInterceptRequest, reads raw XML/JSON3 bytes,
 * saves to local disk, and bridges raw data back into the web view.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val okHttpClient = OkHttpClient.Builder().build()
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val TAG = "YT_CAPTION_INTERCEPTOR"
        // Replace with your production URL or local development server
        private const val APP_URL = "https://ais-pre-jvmryifbax5a2rcbkml22h-93170524797.europe-west2.run.app"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        // Configure WebView settings for YouTube video playback and JS execution
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            useWideViewPort = true
            loadWithOverviewMode = true
            userAgentString = userAgentString.replace("; wv", "") // optimize for web video
        }

        // Setup AssetLoader for bundled local web assets
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        // Add JavaScript Interface for bidirectional communication
        webView.addJavascriptInterface(AndroidNativeBridge(this), "AndroidNativeShell")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url.toString()

                // Intercept YouTube caption endpoint
                if (url.contains("youtube.com/api/timedtext") || url.contains("/timedtext?")) {
                    Log.i(TAG, "=== INTERCEPTED YOUTUBE CAPTION REQUEST ===")
                    Log.i(TAG, "URL: $url")
                    Log.i(TAG, "Method: ${request?.method}")

                    try {
                        // Replicate the request with original headers
                        val requestBuilder = Request.Builder().url(url)
                        request?.requestHeaders?.forEach { (key, value) ->
                            requestBuilder.addHeader(key, value)
                        }

                        val response = okHttpClient.newCall(requestBuilder.build()).execute()
                        val rawBodyBytes = response.body?.bytes() ?: ByteArray(0)
                        val rawBodyString = String(rawBodyBytes, StandardCharsets.UTF_8)
                        val contentType = response.header("Content-Type", "text/xml; charset=utf-8") ?: "text/xml"

                        Log.i(TAG, "Received ${rawBodyBytes.size} bytes of raw caption data.")

                        // 1. Save raw caption to device storage
                        saveCaptionToFile(url, rawBodyBytes)

                        // 2. Dispatch captured data back into the WebView JavaScript runtime
                        dispatchToJavaScript(url, rawBodyString, contentType, response.code)

                        // 3. Return response stream to WebView so YouTube player displays it smoothly
                        return WebResourceResponse(
                            contentType.split(";")[0].trim(),
                            "UTF-8",
                            ByteArrayInputStream(rawBodyBytes)
                        )
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to intercept/fetch caption request: ${e.message}", e)
                    }
                }

                // Intercept bundled web assets when hosted locally via appassets domain
                if (request != null) {
                    val assetResponse = assetLoader.shouldInterceptRequest(request.url)
                    if (assetResponse != null) {
                        return assetResponse
                    }
                }

                return super.shouldInterceptRequest(view, request)
            }
        }

        // Load the application: prefer local bundled web app if available, otherwise load remote APP_URL
        val hasBundledAssets = try {
            assets.open("index.html").close()
            true
        } catch (e: Exception) {
            false
        }

        if (hasBundledAssets) {
            Log.i(TAG, "Loading bundled offline web assets from appassets.androidplatform.net")
            webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        } else {
            Log.i(TAG, "Loading remote web URL: $APP_URL")
            webView.loadUrl(APP_URL)
        }
    }

    private fun saveCaptionToFile(url: String, data: ByteArray) {
        try {
            val dir = File(getExternalFilesDir(null), "youtube_captions")
            if (!dir.exists()) dir.mkdirs()
            val filename = "caption_${System.currentTimeMillis()}.xml"
            val file = File(dir, filename)
            FileOutputStream(file).use { it.write(data) }
            Log.i(TAG, "Saved raw caption to: ${file.absolutePath}")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving file: ${e.message}")
        }
    }

    private fun dispatchToJavaScript(url: String, rawData: String, contentType: String, status: Int) {
        mainHandler.post {
            try {
                // Pass as JSON object to window.onCaptionsIntercepted
                val payload = JSONObject().apply {
                    put("url", url)
                    put("status", status)
                    put("contentType", contentType)
                    put("rawData", rawData)
                    put("timestamp", System.currentTimeMillis())
                    put("bytes", rawData.toByteArray(StandardCharsets.UTF_8).size)
                    put("source", "native_webview_interceptor")
                }

                val base64Payload = Base64.encodeToString(
                    payload.toString().toByteArray(StandardCharsets.UTF_8),
                    Base64.NO_WRAP
                )

                // Execute in WebView
                val script = "if (window.onNativeCaptionsInterceptedBase64) { window.onNativeCaptionsInterceptedBase64('$base64Payload'); }"
                webView.evaluateJavascript(script, null)
            } catch (e: Exception) {
                Log.e(TAG, "Error evaluating JS bridge: ${e.message}")
            }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    /**
     * JS Interface exposed to window.AndroidNativeShell
     */
    inner class AndroidNativeBridge(private val context: Context) {
        @JavascriptInterface
        fun isNativeShell(): Boolean = true

        @JavascriptInterface
        fun showToast(message: String) {
            mainHandler.post {
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            }
        }
    }
}
