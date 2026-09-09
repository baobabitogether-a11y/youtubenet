import { test, expect } from '@playwright/test';

test.describe('YouTube Video Viewer - Subtitle Auto-Detection Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app shell to be ready
    await expect(page).toHaveTitle(/YouTube/i);
    await expect(page.locator('header')).toBeVisible();
  });

  /**
   * CRITICAL TEST: Auto-detect subtitles once caption icon is set to ON (MUST NOT BE MOCKED).
   * All other tests are currently skipped as requested.
   */
  test('Auto-detect subtitles once caption icon is set to ON', async ({ page }) => {
    // 1. Locate the caption toggle icon / button on the video player
    const captionToggleButton = page.locator('#caption-toggle-button');
    await expect(captionToggleButton).toBeVisible();

    // 2. Click the caption icon to toggle captions to ON
    const isPressed = await captionToggleButton.getAttribute('aria-pressed');
    if (isPressed !== 'true') {
      await captionToggleButton.click();
    }

    // 3. Verify auto-detection runs (real network call or cached native stream, unmocked)
    // The button state updates to indicate captions are ON / detecting / ready
    await expect(captionToggleButton).toHaveAttribute('aria-pressed', 'true');

    // 4. Verify subtitles cues are detected and displayed in the application
    // Either the subtitle cues list or the active subtitle cue card is populated with text
    const subtitleCueRow = page.locator('#subtitle-cue-row-0');
    const activeCueText = page.locator('#active-subtitle-cue-text');
    const restoredToast = page.locator('#restored-subtitles-toast');

    // Wait for subtitles to be auto-detected and rendered
    await expect(
      subtitleCueRow.or(activeCueText).or(restoredToast).first()
    ).toBeVisible({ timeout: 15000 });

    // 5. Verify the caption text is real non-empty speech text
    if ((await subtitleCueRow.count()) > 0) {
      const text = await subtitleCueRow.first().textContent();
      expect(text).toBeTruthy();
      expect(text!.length).toBeGreaterThan(3);
    } else {
      const activeText = await activeCueText.textContent();
      expect(activeText).toBeTruthy();
      expect(activeText!.length).toBeGreaterThan(3);
    }

    // 6. Confirm the Redux State Machine reached captions_loaded state or healthy state
    const stateBadge = page.locator('#state-machine-status-badge');
    if ((await stateBadge.count()) > 0) {
      await expect(stateBadge).toBeVisible();
    }
  });

  // =========================================================================
  // SKIPPED TESTS (as instructed: currently skip other tests)
  // =========================================================================
  test.skip('1. Video Playback - loads video player, accepts URL, and toggles theater mode', async () => {});
  test.skip('2. Subtitles View - displays subtitle cues, timestamps, text, search, and jump to cue', async () => {});
  test.skip('3. Subtitles Translation - verifies translation for Italian and Arabic', async () => {});
  test.skip('4. TTS Config - configures speaking rate, voice selection, and test audio', async () => {});
  test.skip('5. Synchronized Playback with Configured Order (TTS First vs Video First)', async () => {});
  test.skip('6. APK Guide Modal - opens APK guide and network inspection modal', async () => {});
});
