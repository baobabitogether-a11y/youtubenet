// Unified TTS Engine supporting Android Native TextToSpeech and Web Speech Synthesis

let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentNativeUtteranceId: string | null = null;
let nativeTTSResolvers: Map<string, { resolve: () => void; reject: (err: any) => void }> = new Map();

// Initialize native TTS callbacks on window once
if (typeof window !== 'undefined') {
  window.onNativeTTSDone = (utteranceId: string) => {
    const callbacks = nativeTTSResolvers.get(utteranceId);
    if (callbacks) {
      callbacks.resolve();
      nativeTTSResolvers.delete(utteranceId);
    }
    if (currentNativeUtteranceId === utteranceId) {
      currentNativeUtteranceId = null;
    }
  };

  window.onNativeTTSError = (utteranceId: string, err: string) => {
    const callbacks = nativeTTSResolvers.get(utteranceId);
    if (callbacks) {
      callbacks.reject(new Error(err || 'Native TTS error'));
      nativeTTSResolvers.delete(utteranceId);
    }
    if (currentNativeUtteranceId === utteranceId) {
      currentNativeUtteranceId = null;
    }
  };
}

export function isAndroidNativeTTS(): boolean {
  return typeof window !== 'undefined' &&
    !!(window.AndroidNativeShell?.speak && typeof window.AndroidNativeShell.speak === 'function');
}

export function getTTSEngineType(): 'android_native' | 'web_speech' {
  return isAndroidNativeTTS() ? 'android_native' : 'web_speech';
}

export function isTTSAvailable(): boolean {
  if (isAndroidNativeTTS()) return true;
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Retrieves available system voices, optionally filtered by language code.
 */
export function getAvailableVoices(langCode?: string): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    if (!langCode) return voices;

    const clean = normalizeLanguageCode(langCode).toLowerCase();
    const prefix = clean.split('-')[0];

    // Priority: Exact match, then prefix match
    const matching = voices.filter(
      (v) => v.lang.toLowerCase() === clean || v.lang.toLowerCase().startsWith(prefix)
    );

    return matching.length > 0 ? matching : voices;
  } catch {
    return [];
  }
}

/**
 * Normalizes language codes (e.g. "es_auto" -> "es", "zh-CN" -> "zh-CN")
 */
export function normalizeLanguageCode(code: string): string {
  if (!code) return 'en';
  return code.replace(/_auto$/, '').trim();
}

/**
 * Speaks text using either Android device native TextToSpeech or Web SpeechSynthesis.
 * Returns a Promise that resolves when speech finishes.
 */
export function speakText(
  text: string,
  lang: string = 'en',
  rate: number = 1.0,
  voiceName?: string,
  onBoundary?: (charIndex: number) => void
): Promise<void> {
  const cleanLang = normalizeLanguageCode(lang);
  const cleanRate = Math.max(0.2, Math.min(3.0, rate || 1.0));

  // 1. Android Native TTS Bridge
  if (isAndroidNativeTTS() && window.AndroidNativeShell?.speak) {
    return new Promise((resolve, reject) => {
      try {
        stopTTS();
        const utteranceId = `native_tts_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        currentNativeUtteranceId = utteranceId;
        nativeTTSResolvers.set(utteranceId, { resolve, reject });

        const success = window.AndroidNativeShell!.speak(text, cleanLang, cleanRate, utteranceId);
        if (!success) {
          nativeTTSResolvers.delete(utteranceId);
          currentNativeUtteranceId = null;
          // Fall back to web speech if native fails
          fallbackWebSpeech(text, cleanLang, cleanRate, voiceName, onBoundary)
            .then(resolve)
            .catch(reject);
        }
      } catch (err) {
        // Fallback to web speech
        fallbackWebSpeech(text, cleanLang, cleanRate, voiceName, onBoundary)
          .then(resolve)
          .catch(reject);
      }
    });
  }

  // 2. Web Speech Synthesis API
  return fallbackWebSpeech(text, cleanLang, cleanRate, voiceName, onBoundary);
}

function fallbackWebSpeech(
  text: string,
  cleanLang: string,
  rate: number,
  voiceName?: string,
  onBoundary?: (charIndex: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve(); // Do not block if speech synthesis is unavailable
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = cleanLang;
      utterance.rate = rate;

      // Select voice: first check if a specific voice was requested by name or URI
      const voices = window.speechSynthesis.getVoices() || [];
      if (voiceName && voices.length > 0) {
        const found = voices.find(
          (v) => v.name === voiceName || v.voiceURI === voiceName
        );
        if (found) {
          utterance.voice = found;
        }
      }

      // If no specific voice matched, fallback to language best-match
      if (!utterance.voice && voices.length > 0) {
        const exact = voices.find((v) => v.lang.toLowerCase() === cleanLang.toLowerCase());
        const prefix = voices.find((v) => v.lang.toLowerCase().startsWith(cleanLang.toLowerCase().split('-')[0]));
        if (exact) {
          utterance.voice = exact;
        } else if (prefix) {
          utterance.voice = prefix;
        }
      }

      if (onBoundary) {
        utterance.onboundary = (event) => {
          if (event.name === 'word') {
            onBoundary(event.charIndex);
          }
        };
      }

      // Safety timeout: estimate speaking duration so headless environments don't hang
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const estimatedMs = Math.min(7000, Math.max(600, (wordCount / (2.5 * Math.max(0.5, rate))) * 1000 + 500));
      let isResolved = false;

      const finish = () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(safetyTimer);
          currentUtterance = null;
          resolve();
        }
      };

      const safetyTimer = setTimeout(finish, estimatedMs);

      utterance.onend = () => {
        finish();
      };

      utterance.onerror = (e) => {
        finish();
      };

      currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      resolve();
    }
  });
}

/**
 * Stops any active TTS playback immediately
 */
export function stopTTS(): void {
  if (typeof window !== 'undefined') {
    if (window.AndroidNativeShell?.stopSpeaking) {
      try {
        window.AndroidNativeShell.stopSpeaking();
      } catch {}
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
  currentUtterance = null;
  if (currentNativeUtteranceId) {
    const callbacks = nativeTTSResolvers.get(currentNativeUtteranceId);
    if (callbacks) callbacks.resolve();
    nativeTTSResolvers.delete(currentNativeUtteranceId);
    currentNativeUtteranceId = null;
  }
}

/**
 * Checks if speech is currently outputting
 */
export function isTTSSpeaking(): boolean {
  if (typeof window === 'undefined') return false;
  if (isAndroidNativeTTS() && window.AndroidNativeShell?.isSpeaking) {
    try {
      return !!window.AndroidNativeShell.isSpeaking();
    } catch {}
  }
  return !!window.speechSynthesis?.speaking || !!currentNativeUtteranceId;
}
