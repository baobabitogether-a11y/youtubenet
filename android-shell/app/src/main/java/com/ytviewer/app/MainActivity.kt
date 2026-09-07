package com.ytviewer.app

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
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
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
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
import java.util.Locale

/**
 * Android Native Shell Activity
 * Intercepts YouTube caption HTTP requests (youtube.com/api/timedtext)
 * via WebViewClient.shouldInterceptRequest, reads raw XML/JSON3 bytes,
 * saves to local disk, bridges raw data back into the web view,
 * and provides native Android TextToSpeech (TTS) capabilities.
 */
class MainActivity : AppCompatActivity(), TextToSpeech.OnInitListener {

    private lateinit var webView: WebView
    private val okHttpClient = OkHttpClient.Builder().build()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var textToSpeech: TextToSpeech? = null
    private var isTtsReady: Boolean = false
    @Volatile
    private var lastObservedTimedTextUrl: String? = null
    private val lastObservedHeaders = java.util.concurrent.ConcurrentHashMap<String, String>()

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

        // Dark background prevents white flash during page transitions
        webView.setBackgroundColor(Color.parseColor("#0f0f12"))

        // Enable remote debugging via chrome://inspect
        WebView.setWebContentsDebuggingEnabled(true)

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
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            userAgentString = userAgentString.replace("; wv", "") // optimize for web video
        }

        // Setup AssetLoader for bundled local web assets
        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        // Initialize Android TextToSpeech engine
        try {
            textToSpeech = TextToSpeech(this, this)
        } catch (e: Exception) {
            Log.e(TAG, "Error creating TextToSpeech: ${e.message}", e)
        }

        // Add JavaScript Interface for bidirectional communication
        webView.addJavascriptInterface(AndroidNativeBridge(this), "AndroidNativeShell")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                Log.d("WebViewConsole", "${consoleMessage?.message()} [${consoleMessage?.sourceId()}:${consoleMessage?.lineNumber()}]")
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

                // 1. Intercept YouTube caption endpoint
                if (url.contains("youtube.com/api/timedtext") || url.contains("/timedtext?")) {
                    Log.i(TAG, "=== INTERCEPTED YOUTUBE CAPTION REQUEST ===")
                    Log.i(TAG, "URL: $url")
                    Log.i(TAG, "Method: ${request?.method}")

                    // Retain observed timedtext request URL and headers for native translation repetition
                    lastObservedTimedTextUrl = url
                    request?.requestHeaders?.let { h ->
                        lastObservedHeaders.clear()
                        lastObservedHeaders.putAll(h)
                    }

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

                // 2. Intercept bundled web assets for offline/hybrid hosting
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
                        val headers = mapOf(
                            "Access-Control-Allow-Origin" to "*",
                            "Access-Control-Allow-Methods" to "GET, OPTIONS",
                            "Cache-Control" to "no-cache"
                        )
                        return WebResourceResponse(mimeType, "UTF-8", 200, "OK", headers, inputStream)
                    } catch (e: Exception) {
                        // Fallback: if it's an extensionless SPA route, serve index.html
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

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                Log.e(TAG, "WebView error loading ${request?.url}: ${error?.description} (${error?.errorCode})")
                super.onReceivedError(view, request, error)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                Log.i(TAG, "Page finished loading: $url")
                super.onPageFinished(view, url)
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
            Log.i(TAG, "Loading bundled offline web assets from appassets.androidplatform.net/index.html")
            webView.loadUrl("https://appassets.androidplatform.net/index.html")
        } else {
            Log.i(TAG, "Loading remote web URL: $APP_URL")
            webView.loadUrl(APP_URL)
        }

        // Handle any shared intent that opened the app
        handleSharedIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleSharedIntent(intent)
    }

    private fun handleSharedIntent(intent: Intent?) {
        if (intent == null) return
        val action = intent.action
        val type = intent.type

        if (Intent.ACTION_SEND == action && type != null) {
            if ("text/plain" == type || type.startsWith("text/")) {
                val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
                    ?: intent.getStringExtra(Intent.EXTRA_SUBJECT)
                if (!sharedText.isNullOrBlank()) {
                    Log.i(TAG, "Received shared link from Android intent: $sharedText")
                    mainHandler.postDelayed({
                        val jsCode = """
                            (function() {
                                if (window.onNativeSharedLinkReceived) {
                                    window.onNativeSharedLinkReceived(${JSONObject.quote(sharedText)});
                                } else {
                                    window.__pendingSharedLink = ${JSONObject.quote(sharedText)};
                                }
                            })();
                        """.trimIndent()
                        webView.evaluateJavascript(jsCode, null)
                    }, 500)
                }
            }
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

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isTtsReady = true
            textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    Log.d(TAG, "Native TTS started utterance: $utteranceId")
                }

                override fun onDone(utteranceId: String?) {
                    Log.d(TAG, "Native TTS finished utterance: $utteranceId")
                    if (utteranceId != null) {
                        mainHandler.post {
                            webView.evaluateJavascript("if (window.onNativeTTSDone) { window.onNativeTTSDone('$utteranceId'); }", null)
                        }
                    }
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    Log.e(TAG, "Native TTS error on utterance: $utteranceId")
                    if (utteranceId != null) {
                        mainHandler.post {
                            webView.evaluateJavascript("if (window.onNativeTTSError) { window.onNativeTTSError('$utteranceId', 'TTS execution error'); }", null)
                        }
                    }
                }

                override fun onError(utteranceId: String?, errorCode: Int) {
                    Log.e(TAG, "Native TTS error on utterance: $utteranceId (code: $errorCode)")
                    if (utteranceId != null) {
                        mainHandler.post {
                            webView.evaluateJavascript("if (window.onNativeTTSError) { window.onNativeTTSError('$utteranceId', 'Error code: $errorCode'); }", null)
                        }
                    }
                }
            })
            Log.i(TAG, "Android TextToSpeech engine initialized successfully")
        } else {
            Log.e(TAG, "Failed to initialize Android TextToSpeech, status=$status")
            isTtsReady = false
        }
    }

    override fun onDestroy() {
        try {
            textToSpeech?.stop()
            textToSpeech?.shutdown()
        } catch (e: Exception) {
            Log.e(TAG, "Error shutting down TTS: ${e.message}")
        }
        super.onDestroy()
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

        @JavascriptInterface
        fun speak(text: String, lang: String, rate: Float, utteranceId: String): Boolean {
            if (!isTtsReady || textToSpeech == null) {
                Log.w(TAG, "TTS requested but engine is not ready (isTtsReady=$isTtsReady)")
                return false
            }

            mainHandler.post {
                try {
                    val locale = when (lang.lowercase()) {
                        "en" -> Locale.ENGLISH
                        "es" -> Locale("es", "ES")
                        "fr" -> Locale.FRENCH
                        "de" -> Locale.GERMAN
                        "it" -> Locale.ITALIAN
                        "pt" -> Locale("pt", "PT")
                        "ru" -> Locale("ru", "RU")
                        "ja" -> Locale.JAPANESE
                        "ko" -> Locale.KOREAN
                        "zh", "zh-cn" -> Locale.SIMPLIFIED_CHINESE
                        "zh-tw" -> Locale.TRADITIONAL_CHINESE
                        "ar" -> Locale("ar")
                        "he" -> Locale("he")
                        "hi" -> Locale("hi", "IN")
                        "tr" -> Locale("tr", "TR")
                        "nl" -> Locale("nl", "NL")
                        "pl" -> Locale("pl", "PL")
                        "sv" -> Locale("sv", "SE")
                        "vi" -> Locale("vi", "VN")
                        "th" -> Locale("th", "TH")
                        "el" -> Locale("el", "GR")
                        "uk" -> Locale("uk", "UA")
                        else -> Locale(lang)
                    }

                    textToSpeech?.language = locale
                    textToSpeech?.setSpeechRate(rate)
                    val params = Bundle()
                    textToSpeech?.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
                } catch (e: Exception) {
                    Log.e(TAG, "Error speaking text with native TTS: ${e.message}", e)
                }
            }
            return true
        }

        @JavascriptInterface
        fun stopSpeaking() {
            mainHandler.post {
                try {
                    textToSpeech?.stop()
                } catch (e: Exception) {
                    Log.e(TAG, "Error stopping native TTS: ${e.message}", e)
                }
            }
        }

        @JavascriptInterface
        fun isSpeaking(): Boolean {
            return textToSpeech?.isSpeaking ?: false
        }

        @JavascriptInterface
        fun getLastObservedTimedTextUrl(): String {
            return lastObservedTimedTextUrl ?: ""
        }

        @JavascriptInterface
        fun setLastObservedTimedTextUrl(url: String) {
            if (url.isNotEmpty()) {
                lastObservedTimedTextUrl = url
            }
        }

        @JavascriptInterface
        fun fetchTranslatedCaptions(targetLang: String, format: String): String {
            val base = lastObservedTimedTextUrl ?: return ""
            return executeTimedTextRepetition(base, targetLang, format)
        }

        @JavascriptInterface
        fun fetchTranslatedCaptionsWithUrl(customUrl: String, targetLang: String, format: String): String {
            val base = if (customUrl.isNotEmpty()) customUrl else (lastObservedTimedTextUrl ?: "")
            if (base.isEmpty()) return ""
            return executeTimedTextRepetition(base, targetLang, format)
        }

        private fun executeTimedTextRepetition(base: String, targetLang: String, format: String): String {
            return try {
                val uri = android.net.Uri.parse(base)
                val queryParamNames = uri.queryParameterNames
                val builder = uri.buildUpon().clearQuery()
                for (name in queryParamNames) {
                    val isTlang = name.equals("tlang", ignoreCase = true)
                    val isFmt = name.equals("fmt", ignoreCase = true) && format.isNotEmpty()
                    if (!isTlang && !isFmt) {
                        for (value in uri.getQueryParameters(name)) {
                            builder.appendQueryParameter(name, value)
                        }
                    }
                }
                builder.appendQueryParameter("tlang", targetLang)
                if (format.isNotEmpty()) {
                    builder.appendQueryParameter("fmt", format)
                }
                val targetUrl = builder.build().toString()
                Log.i(TAG, "Native Shell repeating observed timedtext request for targetLang=$targetLang, fmt=$format: $targetUrl")
                val reqBuilder = Request.Builder().url(targetUrl)
                lastObservedHeaders.forEach { (k, v) ->
                    // Exclude Accept-Encoding so OkHttp handles transparent decompression
                    if (!k.equals("accept-encoding", ignoreCase = true)) {
                        reqBuilder.addHeader(k, v)
                    }
                }
                val resp = okHttpClient.newCall(reqBuilder.build()).execute()
                if (resp.isSuccessful) {
                    val bodyString = resp.body?.string() ?: ""
                    Log.i(TAG, "Native Shell timedtext repetition successful: ${bodyString.length} chars received")
                    bodyString
                } else {
                    Log.w(TAG, "Native Shell repeating timedtext returned HTTP ${resp.code}")
                    ""
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching native translated captions: ${e.message}", e)
                ""
            }
        }
    }
}
