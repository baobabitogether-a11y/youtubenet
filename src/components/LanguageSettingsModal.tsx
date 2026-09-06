import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Volume2,
  Globe,
  Sliders,
  Check,
} from 'lucide-react';
import { TargetLanguage } from '../types';
import { SUPPORTED_TARGET_LANGUAGES } from '../lib/translateService';
import { isAndroidNativeTTS } from '../lib/ttsEngine';

interface LanguageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLanguages: TargetLanguage[];
  onToggleLanguage: (id: string) => void;
  onUpdateRate: (id: string, rate: number) => void;
  onUpdateVoice: (id: string, voiceURI: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onAddLanguage: (lang: { code: string; name: string }) => void;
  onRemoveLanguage: (id: string) => void;
  onTestSpeak: (lang: TargetLanguage) => void;
  getVoicesForLang: (code: string) => SpeechSynthesisVoice[];
}

export const LanguageSettingsModal: React.FC<LanguageSettingsModalProps> = ({
  isOpen,
  onClose,
  targetLanguages,
  onToggleLanguage,
  onUpdateRate,
  onUpdateVoice,
  onMoveUp,
  onMoveDown,
  onAddLanguage,
  onRemoveLanguage,
  onTestSpeak,
  getVoicesForLang,
}) => {
  const [newLangCode, setNewLangCode] = useState('es');

  if (!isOpen) return null;

  const handleAdd = () => {
    const selected = SUPPORTED_TARGET_LANGUAGES.find((l) => l.code === newLangCode);
    if (selected) {
      onAddLanguage(selected);
    }
  };

  return (
    <div
      id="language-settings-modal"
      data-testid="language-settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-950/70 border border-indigo-800/60 text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-neutral-100">
                Target Languages &amp; Speech Settings
              </h2>
              <p className="text-xs text-neutral-400">
                Configure translation targets, speaking order, and TTS speeds (max 1.5x)
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-language-settings-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-5">
          {/* Add language section */}
          <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-neutral-200">
                Add Translation Language:
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                id="add-language-select"
                value={newLangCode}
                onChange={(e) => setNewLangCode(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                {SUPPORTED_TARGET_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                id="confirm-add-language-button"
                onClick={handleAdd}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Languages list */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Active Languages (Ordered for TTS Playback)
            </span>

            {targetLanguages.map((lang, index) => {
              const voices = getVoicesForLang(lang.code);
              return (
                <div
                  key={lang.id}
                  id={`target-language-card-${lang.code}`}
                  className={`p-3.5 rounded-xl border transition flex flex-col gap-3 ${
                    lang.enabled
                      ? 'bg-neutral-950/80 border-neutral-700/80'
                      : 'bg-neutral-950/40 border-neutral-800 opacity-60'
                  }`}
                >
                  {/* Top row: Checkbox, Name, Reorder buttons, Remove button */}
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={lang.enabled}
                        onChange={() => onToggleLanguage(lang.id)}
                        className="w-4 h-4 rounded border-neutral-700 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-neutral-200">
                        {lang.name}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                        {lang.code}
                      </span>
                    </label>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onMoveUp(index)}
                        disabled={index === 0}
                        title="Move up in speaking sequence"
                        className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveDown(index)}
                        disabled={index === targetLanguages.length - 1}
                        title="Move down in speaking sequence"
                        className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      {targetLanguages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveLanguage(lang.id)}
                          className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 ml-1 transition"
                          title="Remove language"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bottom row: TTS Rate Slider (Max 1.5x) & Voice selector & Test speak button */}
                  {lang.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-800/80 text-xs">
                      {/* TTS Rate Slider */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-neutral-400">
                          <span className="flex items-center gap-1">
                            <Sliders className="w-3 h-3 text-indigo-400" />
                            <span>Speaking Speed:</span>
                          </span>
                          <span
                            id={`tts-rate-value-${lang.code}`}
                            className="font-mono text-neutral-200 font-medium"
                          >
                            {lang.ttsRate.toFixed(2)}x
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-neutral-500">0.5x</span>
                          <input
                            type="range"
                            id={`tts-rate-slider-${lang.code}`}
                            min="0.5"
                            max="1.5"
                            step="0.05"
                            value={Math.min(1.5, lang.ttsRate)}
                            onChange={(e) => onUpdateRate(lang.id, parseFloat(e.target.value))}
                            className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                          />
                          <span className="text-[10px] text-neutral-400 font-semibold">1.5x</span>
                        </div>
                      </div>

                      {/* Voice selection & Test Speak */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-[11px] text-neutral-400">
                            {isAndroidNativeTTS() ? 'Android System Voice' : 'Web Voice'}:
                          </label>
                          <select
                            id={`tts-voice-select-${lang.code}`}
                            value={lang.voiceURI || ''}
                            onChange={(e) => onUpdateVoice(lang.id, e.target.value)}
                            className="w-full py-1 px-2 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-300 text-xs focus:outline-none focus:border-indigo-500"
                          >
                            <option value="">Default System Voice</option>
                            {voices.map((v) => (
                              <option key={v.voiceURI} value={v.voiceURI}>
                                {v.name} ({v.lang})
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          id={`test-speak-button-${lang.code}`}
                          onClick={() => onTestSpeak(lang)}
                          className="self-end px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 flex items-center gap-1 transition shrink-0"
                          title="Preview audio pronunciation"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Test</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-900/90 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            All settings are auto-saved for this session.
          </span>
          <button
            type="button"
            id="done-language-settings-button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
          >
            <Check className="w-4 h-4" />
            <span>Save &amp; Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
