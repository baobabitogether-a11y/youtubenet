import { useState, useRef, useCallback, useEffect, type RefObject } from 'react';
import { CaptionCue, TargetLanguage, SyncPlayOrder, YouTubePlayerHandle } from '../types';
import { speakText, stopTTS, isTTSSpeaking, getTTSEngineType } from '../lib/ttsEngine';
import {
  translateText,
  prefetchCueTranslations,
  translateTrackWithNativeFirst,
} from '../lib/translateService';

interface UseSyncEngineProps {
  cues: CaptionCue[];
  sourceLang?: string;
  languages: TargetLanguage[];
  playerRef: RefObject<YouTubePlayerHandle | null>;
  playOrder: SyncPlayOrder;
  observedUrl?: string | null;
  videoId?: string;
}

export function useSyncEngine({
  cues,
  sourceLang = 'auto',
  languages,
  playerRef,
  playOrder,
  observedUrl,
  videoId,
}: UseSyncEngineProps) {
  const [activeCueIndex, setActiveCueIndex] = useState<number>(-1);
  const [isSyncActive, setIsSyncActive] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentTTSLang, setCurrentTTSLang] = useState<string | null>(null);
  const [currentTTSText, setCurrentTTSText] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});

  const abortRef = useRef<boolean>(false);
  const isLoopRunningRef = useRef<boolean>(false);
  const translationsRef = useRef(translations);
  translationsRef.current = translations;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      stopTTS();
    };
  }, []);

  // Prepopulate translations using YouTube Native timedtext translation by default (fallback to GTX)
  useEffect(() => {
    if (!cues || cues.length === 0) return;
    const enabledLangs = languages.filter((l) => l.enabled);
    enabledLangs.forEach(async (lang) => {
      try {
        const result = await translateTrackWithNativeFirst({
          originalCues: cues,
          targetLang: lang.code,
          observedUrl,
          videoId,
          sourceLang,
        });
        if (result.translations) {
          setTranslations((prev) => {
            const updated = { ...prev };
            Object.entries(result.translations).forEach(([cId, text]) => {
              updated[cId] = { ...(updated[cId] || {}), [lang.code]: text };
            });
            return updated;
          });
        }
      } catch (err) {
        console.warn(`[SyncEngine] Pre-translation error for ${lang.code}:`, err);
      }
    });
  }, [cues, languages, observedUrl, videoId, sourceLang]);

  /**
   * Helper to retrieve or fetch translation for a cue
   */
  const getCueTranslation = useCallback(
    async (cue: CaptionCue, targetLangCode: string): Promise<string> => {
      const cueId = cue.id;
      if (translationsRef.current[cueId]?.[targetLangCode]) {
        return translationsRef.current[cueId][targetLangCode];
      }

      const translated = await translateText(cue.text, sourceLang, targetLangCode);
      setTranslations((prev) => ({
        ...prev,
        [cueId]: {
          ...(prev[cueId] || {}),
          [targetLangCode]: translated,
        },
      }));
      return translated;
    },
    [sourceLang]
  );

  /**
   * Plays TTS for all enabled languages for a given cue in the exact configured sequence
   */
  const playCueTTSSequence = useCallback(
    async (cue: CaptionCue, enabledLangs: TargetLanguage[]): Promise<boolean> => {
      for (const lang of enabledLangs) {
        if (abortRef.current) return false;

        const textToSpeak = await getCueTranslation(cue, lang.code);
        if (abortRef.current) return false;

        setCurrentTTSLang(lang.code);
        setCurrentTTSText(textToSpeak);
        setIsSpeaking(true);

        try {
          await speakText(textToSpeak, lang.code, lang.ttsRate, lang.voice);
        } catch (err) {
          console.warn(`TTS failed for lang ${lang.code}:`, err);
        }

        if (abortRef.current) {
          setIsSpeaking(false);
          setCurrentTTSLang(null);
          setCurrentTTSText(null);
          return false;
        }

        // Slight pause between language narrations
        await new Promise((r) => setTimeout(r, 220));
      }

      setIsSpeaking(false);
      setCurrentTTSLang(null);
      setCurrentTTSText(null);
      return true;
    },
    [getCueTranslation]
  );

  /**
   * Waits until YouTube video plays the duration of the current cue
   */
  const playVideoCueSegment = useCallback(
    (cue: CaptionCue): Promise<void> => {
      return new Promise((resolve) => {
        const player = playerRef.current;
        if (!player) {
          resolve();
          return;
        }

        const start = Math.max(0, cue.start);
        const targetEnd = start + Math.max(1.0, cue.duration || 2.5);

        player.seekTo(start);
        player.play();

        const startTime = Date.now();
        const durationSec = Math.max(1.0, cue.duration || 2.5);

        const checkInterval = setInterval(() => {
          if (abortRef.current) {
            clearInterval(checkInterval);
            resolve();
            return;
          }

          const currentTime = player.getCurrentTime();
          const elapsed = (Date.now() - startTime) / 1000;

          // Stop when current time passes target, or fallback timeout elapsed
          if (
            currentTime >= targetEnd - 0.15 ||
            (currentTime < start - 2 && currentTime > 0) ||
            elapsed >= durationSec + 3
          ) {
            clearInterval(checkInterval);
            player.pause();
            resolve();
          }
        }, 100);
      });
    },
    [playerRef]
  );

  /**
   * Master execution loop
   */
  const startSync = useCallback(
    async (startIndex?: number) => {
      if (!cues || cues.length === 0) return;

      // Abort any existing loop first
      abortRef.current = true;
      stopTTS();
      await new Promise((r) => setTimeout(r, 120));

      abortRef.current = false;
      isLoopRunningRef.current = true;
      setIsSyncActive(true);

      let idx = startIndex !== undefined ? startIndex : activeCueIndex >= 0 ? activeCueIndex : 0;
      if (idx < 0 || idx >= cues.length) idx = 0;

      const enabledLangs = languages.filter((l) => l.enabled);

      while (idx < cues.length && !abortRef.current) {
        const cue = cues[idx];
        setActiveCueIndex(idx);

        // Background prefetch translations for upcoming cues
        if (enabledLangs.length > 0) {
          enabledLangs.forEach((l) => {
            prefetchCueTranslations(cues, idx, 4, sourceLang, l.code);
          });
        }

        if (playOrder === 'video_first') {
          // 1. Play video segment
          await playVideoCueSegment(cue);
          if (abortRef.current) break;

          // 2. Pause video and TTS-play translations in sequence
          if (enabledLangs.length > 0) {
            const completed = await playCueTTSSequence(cue, enabledLangs);
            if (!completed || abortRef.current) break;
          }
        } else {
          // 1. TTS first: translate and narrate
          if (enabledLangs.length > 0) {
            const completed = await playCueTTSSequence(cue, enabledLangs);
            if (!completed || abortRef.current) break;
          }

          // 2. Play video segment
          await playVideoCueSegment(cue);
          if (abortRef.current) break;
        }

        // Small inter-cue delay
        await new Promise((r) => setTimeout(r, 200));
        idx++;
      }

      isLoopRunningRef.current = false;
      setIsSyncActive(false);
      setIsSpeaking(false);
      setCurrentTTSLang(null);
      setCurrentTTSText(null);
    },
    [cues, activeCueIndex, languages, playOrder, playVideoCueSegment, playCueTTSSequence, sourceLang]
  );

  /**
   * Pauses the sync loop and active TTS
   */
  const pauseSync = useCallback(() => {
    abortRef.current = true;
    isLoopRunningRef.current = false;
    stopTTS();
    setIsSyncActive(false);
    setIsSpeaking(false);
    setCurrentTTSLang(null);
    setCurrentTTSText(null);
    playerRef.current?.pause();
  }, [playerRef]);

  /**
   * Jump to a specific cue
   */
  const jumpToCue = useCallback(
    (index: number) => {
      if (index < 0 || index >= cues.length) return;
      setActiveCueIndex(index);
      if (isSyncActive) {
        startSync(index);
      } else {
        const cue = cues[index];
        playerRef.current?.seekTo(cue.start);
      }
    },
    [cues, isSyncActive, startSync, playerRef]
  );

  const nextCue = useCallback(() => {
    const nextIdx = Math.min((activeCueIndex >= 0 ? activeCueIndex : 0) + 1, cues.length - 1);
    jumpToCue(nextIdx);
  }, [activeCueIndex, cues.length, jumpToCue]);

  const prevCue = useCallback(() => {
    const prevIdx = Math.max((activeCueIndex >= 0 ? activeCueIndex : 0) - 1, 0);
    jumpToCue(prevIdx);
  }, [activeCueIndex, jumpToCue]);

  /**
   * Test-play TTS for a single target language without launching the whole video loop
   */
  const testSpeakLang = useCallback(
    async (cue: CaptionCue, lang: TargetLanguage) => {
      stopTTS();
      const textToSpeak = await getCueTranslation(cue, lang.code);
      setCurrentTTSLang(lang.code);
      setCurrentTTSText(textToSpeak);
      setIsSpeaking(true);
      try {
        await speakText(textToSpeak, lang.code, lang.ttsRate, lang.voice);
      } finally {
        setIsSpeaking(false);
        setCurrentTTSLang(null);
        setCurrentTTSText(null);
      }
    },
    [getCueTranslation]
  );

  return {
    activeCueIndex,
    isSyncActive,
    isSpeaking,
    currentTTSLang,
    currentTTSText,
    translations,
    ttsEngineType: getTTSEngineType(),
    startSync,
    pauseSync,
    jumpToCue,
    nextCue,
    prevCue,
    testSpeakLang,
    getCueTranslation,
  };
}
