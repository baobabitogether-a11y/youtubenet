# Changelog

All notable changes to the YouTube Video Viewer & Subtitles Teacher application are documented in this file.

## [Unreleased] - 2026-09-06

### Added
- **Playwright End-to-End (E2E) Test Suite (`e2e/app.spec.ts`)**:
  - `1. Video Playback`: Tests video player iframe mounting, YouTube URL input recognition, watch ID extraction, play trigger, and theater mode toggling.
  - `2. Subtitles View`: Tests sample cue loading, timestamp formatting, cue text rendering, real-time search filtering, and jump-to-cue navigation.
  - `3. Subtitles Translation`: Verifies real-time translation for target languages, including Italian (`it`) and Arabic (`ar`), with language badge verification and cue translations.
  - `4. TTS Configuration`: Validates speech synthesis configuration, rate adjustments (0.5x to 2.0x), voice selection per language, and test-speak audio trigger.
  - `5. Synchronized Playback Order`: Tests dual synchronization modes—"Subtitles / TTS First" (speaks subtitle translations before video segment plays) and "Video First" (plays video timeframe before speaking subtitles).
  - `6. APK Guide & Android Distribution Modal`: Tests opening the Android APK generation, download, and network security inspection modal.
- **GitHub Actions Workflow (`.github/workflows/e2e.yml`)**:
  - Automated CI workflow executing all available Playwright E2E tests on `push`, `pull_request`, and manual `workflow_dispatch`.
  - Automatic dependency caching, Chromium headless browser installation with system dependencies, and report artifact upload on completion.
- **Quick Language Presets**:
  - Added one-click preset button for "Italian + Arabic" learning setup in the Subtitles Teacher panel.
  - Added custom voice selector dropdown for each target language allowing users to select available OS / browser voices.

### Improved
- **Video Player IFrame Stability**:
  - Switched from destructive `YT.Player.destroy()` to persistent React iframe referencing with YouTube IFrame API binding.
  - Guaranteed iframe visibility and responsive aspect ratio even under restricted network or sandbox conditions.
- **Active Subtitle Cue Selection**:
  - Auto-selects the first loaded cue upon sample or file upload so active translations are immediately visible without requiring manual cue clicks.
- **Search Filtering & Cue Item Identifiers**:
  - Added semantic `data-testid` and `data-cue-id` attributes to subtitle cue items and active preview cards for robust headless test reliability.
- **Web Speech Synthesis Safety Timer**:
  - Added a 6-second timeout fallback in `ttsEngine.ts` to prevent headless browsers or muted audio contexts from stalling time-synchronized playback loops.
