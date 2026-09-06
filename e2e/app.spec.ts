import { test, expect } from '@playwright/test';

test.describe('YouTube Video Viewer & Subtitles Teacher E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app shell to be ready
    await expect(page).toHaveTitle(/YouTube/i);
    await expect(page.locator('header')).toBeVisible();
  });

  test('1. Video Playback - loads video player, accepts URL, and toggles theater mode', async ({ page }) => {
    // Verify player iframe
    const iframe = page.locator('#youtube-player-iframe');
    await expect(iframe).toBeVisible();

    // Verify input bar and test loading new video
    const urlInput = page.locator('#youtube-url-input');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://www.youtube.com/watch?v=jNQXAC9IVRw');

    // Format recognition badge
    await expect(page.locator('text=Recognized:')).toBeVisible();
    await expect(page.locator('text=jNQXAC9IVRw')).toBeVisible();

    // Play video
    const playButton = page.locator('#play-video-button');
    await playButton.click();
    await page.waitForTimeout(1000);
    await expect(iframe).toHaveAttribute('src', /jNQXAC9IVRw/);

    // Toggle theater mode
    const theaterButton = page.locator('#toggle-theater-mode-button');
    if ((await theaterButton.count()) > 0) {
      await theaterButton.click();
      await page.waitForTimeout(500);
      await theaterButton.click();
      await page.waitForTimeout(300);
    }
  });

  test('2. Subtitles View - displays subtitle cues, timestamps, text, search, and jump to cue', async ({ page }) => {
    // Load sample cues
    const loadSampleButton = page.locator('#load-sample-cues-button');
    await expect(loadSampleButton).toBeVisible();
    await loadSampleButton.click();

    // Verify subtitle segments list is rendered
    const firstCueRow = page.locator('#subtitle-cue-row-0');
    await expect(firstCueRow).toBeVisible();
    await expect(firstCueRow).toContainText('Hello, welcome to this video lesson!');

    const secondCueRow = page.locator('#subtitle-cue-row-1');
    await expect(secondCueRow).toBeVisible();
    await expect(secondCueRow).toContainText('Today we are practicing subtitles with automatic translation.');

    // Verify active subtitle card shows active cue
    const activeCueText = page.locator('#active-subtitle-cue-text');
    await expect(activeCueText).toBeVisible();
    await expect(activeCueText).toContainText('Hello, welcome to this video lesson!');

    // Click on cue row 1 to jump
    await secondCueRow.click();
    await expect(activeCueText).toContainText('Today we are practicing subtitles with automatic translation.');

    // Test search filter
    const searchInput = page.locator('input[placeholder="Filter subtitles..."]');
    await searchInput.fill('practice');
    await expect(page.locator('text=Today we are practicing subtitles with automatic translation.')).toBeVisible();
  });

  test('3. Subtitles Translation - verifies translation for Italian and Arabic', async ({ page }) => {
    // Load sample cues to have active cue
    await page.locator('#load-sample-cues-button').click();

    // Ensure Italian and Arabic preset is loaded
    const presetBtn = page.locator('#preset-italian-arabic-button');
    if ((await presetBtn.count()) > 0) {
      await presetBtn.click();
    }

    // Verify Target Translation Languages section lists Italian and Arabic
    const itCard = page.locator('#target-language-card-it');
    await expect(itCard).toBeVisible();
    await expect(itCard).toContainText('Italian');

    const arCard = page.locator('#target-language-card-ar');
    await expect(arCard).toBeVisible();
    await expect(arCard).toContainText('Arabic');

    // Verify active translations card displays translations in Italian and Arabic
    const activeTranslationsGrid = page.locator('#active-translations-grid');
    await expect(activeTranslationsGrid).toBeVisible();

    const itTranslation = page.locator('#active-translation-it');
    await expect(itTranslation).toBeVisible();
    await expect(itTranslation).toContainText('Italian (Italiano):');
    const itText = page.locator('[data-testid="translation-text-it"]');
    await expect(itText).toBeVisible();
    await expect(itText).not.toBeEmpty();

    const arTranslation = page.locator('#active-translation-ar');
    await expect(arTranslation).toBeVisible();
    await expect(arTranslation).toContainText('Arabic (العربية):');
    const arText = page.locator('[data-testid="translation-text-ar"]');
    await expect(arText).toBeVisible();
    await expect(arText).not.toBeEmpty();
  });

  test('4. TTS Config - configures speaking rate, voice selection, and test audio', async ({ page }) => {
    await page.locator('#load-sample-cues-button').click();

    // Set to Italian + Arabic preset
    await page.locator('#preset-italian-arabic-button').click();

    // Test Italian Rate Slider
    const itRateSlider = page.locator('#tts-rate-slider-it');
    await expect(itRateSlider).toBeVisible();
    await itRateSlider.fill('1.5');
    await itRateSlider.dispatchEvent('change');
    const itRateValue = page.locator('#tts-rate-value-it');
    await expect(itRateValue).toContainText('1.5x');

    // Test Arabic Rate Slider
    const arRateSlider = page.locator('#tts-rate-slider-ar');
    await expect(arRateSlider).toBeVisible();
    await arRateSlider.fill('0.8');
    await arRateSlider.dispatchEvent('change');
    const arRateValue = page.locator('#tts-rate-value-ar');
    await expect(arRateValue).toContainText('0.8x');

    // Test Voice Selection Dropdown
    const itVoiceSelect = page.locator('#tts-voice-select-it');
    await expect(itVoiceSelect).toBeVisible();
    const itOptionsCount = await itVoiceSelect.locator('option').count();
    expect(itOptionsCount).toBeGreaterThan(0);

    const arVoiceSelect = page.locator('#tts-voice-select-ar');
    await expect(arVoiceSelect).toBeVisible();
    const arOptionsCount = await arVoiceSelect.locator('option').count();
    expect(arOptionsCount).toBeGreaterThan(0);

    // Test Voice Preview Speak Button (should trigger without throwing errors)
    const itTestSpeakBtn = page.locator('#test-speak-button-it');
    await expect(itTestSpeakBtn).toBeVisible();
    await itTestSpeakBtn.click();

    const arTestSpeakBtn = page.locator('#test-speak-button-ar');
    await expect(arTestSpeakBtn).toBeVisible();
    await arTestSpeakBtn.click();
  });

  test('5. Synchronized Playback with Configured Order (TTS First vs Video First)', async ({ page }) => {
    // 1. Load sample cues
    await page.locator('#load-sample-cues-button').click();
    await page.locator('#preset-italian-arabic-button').click();

    // 2. Test selecting "2. TTS First" (Play subtitles section before video playback for each time frame)
    const ttsFirstBtn = page.locator('#play-order-tts-first-button');
    await expect(ttsFirstBtn).toBeVisible();
    await ttsFirstBtn.click();
    await expect(ttsFirstBtn).toHaveClass(/bg-indigo/);

    // 3. Start Teacher Sync in TTS First mode
    const syncPlayBtn = page.locator('#sync-teacher-play-button');
    await expect(syncPlayBtn).toBeVisible();
    await expect(syncPlayBtn).toContainText('Start Teacher Sync');

    await syncPlayBtn.click();

    // Verify sync engine becomes active
    await expect(syncPlayBtn).toContainText('Pause Teacher Sync');

    // Allow speech/video cycle to run
    await page.waitForTimeout(2000);

    // Pause Teacher Sync
    await syncPlayBtn.click();
    await expect(syncPlayBtn).toContainText('Start Teacher Sync');

    // 4. Test selecting "1. Video First"
    const videoFirstBtn = page.locator('#play-order-video-first-button');
    await expect(videoFirstBtn).toBeVisible();
    await videoFirstBtn.click();
    await expect(videoFirstBtn).toHaveClass(/bg-indigo/);
  });

  test('6. APK Guide Modal - opens APK guide and network inspection modal', async ({ page }) => {
    const apkGuideBtn = page.locator('#open-apk-guide-button');
    await expect(apkGuideBtn).toBeVisible();
    await apkGuideBtn.click();

    const modalHeading = page.locator('text=Android APK & Network Traffic Interception');
    await expect(modalHeading).toBeVisible();

    const closeButton = page.locator('#close-apk-guide-modal-button');
    if ((await closeButton.count()) > 0) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });
});
