import { expect, type Page, test } from '@playwright/test';

const TYPE_FIXTURES = [
  ['text', 'Plain text message'],
  ['entities', 'Bold, italic, code and a link'],
  ['photo', 'A photo with caption'],
  ['album', undefined],
  ['video', 'A video'],
  ['file', 'hello.txt'],
  ['sticker', undefined],
  ['voice', undefined],
  ['round', undefined],
  ['poll', 'Best framework?'],
  ['location', undefined],
  ['contact', 'Alice Example'],
  ['reply', 'Replying to the first message'],
  ['service', 'changed group name to'],
  ['forwards', 'Forwarded from a user'],
  ['nested', 'Nested forward'],
  ['unhosted', 'View in Telegram'],
] as const;

async function waitForShareReady(page: Page) {
  await expect(page.locator('.Message, .ActionMessage').first()).toBeVisible();
  await expect(page.locator('.Transition_slide-active .MessageList')).toBeVisible();
  await expect(page.locator('.Message.shown, .ActionMessage').first()).toBeVisible();
  // App and message-list slides use different transition timers; wait until
  // both have dropped their entering layers before taking a visual baseline
  await page.waitForTimeout(800);
}

test.describe('read-only share view', () => {
  test('renders the message-type coverage matrix', async ({ page }, testInfo) => {
    const unexpectedErrors: string[] = [];
    page.on('pageerror', (error) => {
      unexpectedErrors.push(error.message);
    });

    await page.goto('/s/demo-types', { waitUntil: 'domcontentloaded' });
    await waitForShareReady(page);
    await expect(page.locator('.Message')).toHaveCount(18);
    await expect(page.locator('.ActionMessage')).toHaveCount(1);

    // Core message/media types
    await expect(page.getByText('Plain text message', { exact: true })).toBeVisible();
    await expect(page.locator('.Album')).toHaveCount(1);
    await expect(page.locator('.Album [id^="album-media-"]')).toHaveCount(2);
    await expect(page.locator('video.full-media')).toHaveCount(1);
    await expect(page.locator('.Location')).toHaveCount(1);
    await expect(page.locator('.EmbeddedMessage')).toHaveCount(1);
    await expect(page.getByText('Best framework?', { exact: true })).toBeVisible();
    await expect(page.getByText('Alice Example', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('hello.txt', { exact: true })).toBeVisible();
    await expect(page.getByText('View in Telegram', { exact: true })).toBeVisible();

    // Forward origins and service message
    await expect(page.locator('.sender-title')).toHaveCount(4);
    await expect(page.getByText('Hidden User', { exact: true })).toBeVisible();
    await expect(page.getByText(/changed group name to/).last()).toBeVisible();

    // Read-only trimming
    await expect(page.locator('#message-input-text')).toHaveCount(0);
    await expect(page.locator('.HeaderActions button')).toHaveCount(0);

    if (testInfo.project.name === 'chromium') {
      const message = page.locator('.Message:visible').first();
      await message.scrollIntoViewIfNeeded();
      await message.dispatchEvent('contextmenu', {
        button: 2,
        clientX: 400,
        clientY: 400,
      });
      const menu = page.locator('.MessageContextMenu');
      await expect(menu).toBeAttached();
      await expect(menu.locator('.MenuItem')).toHaveCount(1);
      await expect(menu.locator('.MenuItem').first()).toContainText('lng_context_copy_text');
      for (const label of ['Reply', 'Pin', 'Forward', 'Select', 'Delete']) {
        await expect(menu.getByText(label, { exact: true })).toHaveCount(0);
      }
      await page.keyboard.press('Escape');
    }

    await page.locator('.MessageList').screenshot({
      path: testInfo.outputPath('message-types.png'),
      animations: 'disabled',
    });
    expect(unexpectedErrors).toEqual([]);
  });

  for (const [type, text] of TYPE_FIXTURES) {
    test(`renders ${type} fixture batch`, async ({ page }) => {
      await page.goto(`/s/demo-type-${type}`, { waitUntil: 'domcontentloaded' });
      await waitForShareReady(page);
      if (text) await expect(page.getByText(text, { exact: false }).last()).toBeVisible();
      await expect(page.locator('#message-input-text')).toHaveCount(0);
    });
  }

  test('matches desktop screenshot baseline', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'Desktop baseline');
    await page.goto('/s/demo-text', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.Message')).toHaveCount(7);
    await waitForShareReady(page);
    await expect(page).toHaveScreenshot('share-text-desktop.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
    });
  });

  test('matches mobile screenshot baseline', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-chromium', 'Mobile baseline');
    await page.goto('/s/demo-text', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.Message')).toHaveCount(7);
    await waitForShareReady(page);
    await expect(page).toHaveScreenshot('share-text-mobile.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
    });
  });
});
