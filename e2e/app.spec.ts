import { test, expect } from '@playwright/test';

test.describe('YouTube Video Viewer End-to-End Test', () => {
  test('complete viewer journey: loads app, parses URLs, switches video, toggles theater mode, and opens APK guide', async ({ page }) => {
    // 1. Navigate to application
    await page.goto('/');

    // 2. Verify page title and header
    await expect(page).toHaveTitle(/YouTube/i);
    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(header).toContainText('YouTube Viewer');

    // 3. Verify player iframe is rendered with default video
    const iframe = page.locator('iframe[title="YouTube video player"]');
    await expect(iframe).toBeVisible();

    // 4. Verify input bar is loaded
    const urlInput = page.locator('#youtube-url-input');
    await expect(urlInput).toBeVisible();

    // 5. Enter a new YouTube URL
    const testVideoUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
    await urlInput.fill(testVideoUrl);

    // 6. Verify real-time format recognition badge is displayed
    const recognitionBadge = page.locator('text=Recognized:');
    await expect(recognitionBadge).toBeVisible();
    await expect(page.locator('text=jNQXAC9IVRw')).toBeVisible();

    // 7. Click Play button to load video
    const playButton = page.locator('#play-video-button');
    await playButton.click();

    // Allow time for iframe to reload with new video ID
    await page.waitForTimeout(1500);
    await expect(iframe).toHaveAttribute('src', /jNQXAC9IVRw/);

    // 8. Test quick sample format buttons if present
    const sampleButtons = page.locator('button:has-text("Shorts"), button:has-text("Timestamp")');
    if ((await sampleButtons.count()) > 0) {
      await sampleButtons.first().click();
      await page.waitForTimeout(1500);
    }

    // 9. Test Theater Mode toggle
    const theaterButton = page.locator('#toggle-theater-mode-button');
    if ((await theaterButton.count()) > 0) {
      await theaterButton.click();
      await page.waitForTimeout(1200);
      // Toggle back
      await theaterButton.click();
      await page.waitForTimeout(600);
    }

    // 10. Open APK Guide Modal
    const apkGuideButton = page.locator('#open-apk-guide-button');
    await expect(apkGuideButton).toBeVisible();
    await apkGuideButton.click();

    // 11. Verify modal is visible
    const modalHeading = page.locator('text=Android APK & Network Traffic Interception');
    await expect(modalHeading).toBeVisible();

    await page.waitForTimeout(1000);

    // 12. Close modal
    const closeButton = page.locator('#close-apk-guide-modal-button');
    if ((await closeButton.count()) > 0) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(1000);

    // 13. Final pause to give the video artifact smooth visual closure
    await page.waitForTimeout(2000);
  });
});
