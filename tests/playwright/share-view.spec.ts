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

async function expectShareShellStable(page: Page, url: string) {
  await expect(page).toHaveURL(url);
  await expect(page.locator('.Transition_slide-active .MessageList')).toBeVisible();
  await expect(page.locator('#MiddleSearch')).toHaveCount(0);
}

test.describe('read-only share view', () => {
  test('shows the content warning before the shared messages', async ({ page }) => {
    await page.addInitScript(() => {
      window.Telegram = {
        WebApp: {
          openLink: (url: string) => {
            document.documentElement.dataset.openedUrl = url;
          },
        },
      };
    });
    await page.goto('/s/demo-type-text', { waitUntil: 'domcontentloaded' });
    await waitForShareReady(page);

    const warning = page.getByRole('note');
    await expect(warning).toContainText(
      'Messages may have been excerpted, mixed, or tampered with and are for reference only.',
    );
    await expect(page.locator('.messages-container > :is(.share-content-warning, .message-date-group)').first())
      .toHaveClass(/share-content-warning/);

    const learnMore = warning.getByRole('link', { name: 'Learn More' });
    await expect(learnMore).toHaveAttribute(
      'href',
      'https://github.com/agoudbg/telegram-batch-forwarding-bot/blob/main/docs/SHARED_MESSAGE_AUTHENTICITY.md',
    );
    await learnMore.click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-opened-url',
      'https://github.com/agoudbg/telegram-batch-forwarding-bot/blob/main/docs/SHARED_MESSAGE_AUTHENTICITY.md',
    );
  });

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

    // Origin identities and service message
    await expect(page.locator('.sender-title').filter({ hasText: 'Alice Example' }).first()).toBeVisible();
    await expect(page.getByText('Hidden User', { exact: true })).toBeVisible();
    await expect(page.getByText('Forwarded from', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/changed group name to/).last()).toBeVisible();

    // Read-only trimming
    await expect(page.locator('#message-input-text')).toHaveCount(0);
    await expect(page.locator('.MiddleHeader')).toHaveCount(0);
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
      await expect(menu.locator('.MenuItem').first()).toContainText('Copy Text');
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

  test('renders ordinary origins as standard senders', async ({ page }) => {
    await page.goto('/s/demo-type-text', { waitUntil: 'domcontentloaded' });
    await waitForShareReady(page);

    const message = page.locator('.Message:visible').first();
    await expect(message.getByText('Alice Example', { exact: true })).toBeVisible();
    await expect(message.getByText('Forwarded from', { exact: true })).toHaveCount(0);
    await expect(page.locator('.sender-group-container .Avatar').first()).toBeVisible();
  });

  test('blocks shell navigation, search and bare Escape', async ({ page }) => {
    await page.goto('/s/demo-types', { waitUntil: 'domcontentloaded' });
    await waitForShareReady(page);
    const shareUrl = page.url();

    const avatar = page.locator('.sender-group-container .Avatar').first();
    await avatar.click();
    await expectShareShellStable(page, shareUrl);

    await avatar.click({ button: 'right' });
    await expect(page.locator('#portals .Menu')).toHaveCount(0);

    await page.locator('.sender-title').filter({ hasText: 'Alice Example' }).first().click();
    await page.keyboard.press('Control+f');
    await page.keyboard.press('Escape');
    await expectShareShellStable(page, shareUrl);
  });

  test('renders reactions, polls and bot controls as read-only', async ({ page }) => {
    await page.goto('/s/demo-types', { waitUntil: 'domcontentloaded' });
    await waitForShareReady(page);
    const shareUrl = page.url();

    await expect(page.getByText('Unsafe callback', { exact: true })).toHaveCount(0);
    const reaction = page.locator('.message-reaction').first();
    await expect(reaction).toContainText('3');
    await reaction.click();
    await expect(reaction).not.toHaveClass(/chosen/);

    const pollAnswer = page.getByText('Vue', { exact: true });
    const pollOption = pollAnswer.locator('..').locator('..');
    await expect(pollOption).not.toHaveClass(/clickable/);
    await pollAnswer.click();
    await expect(pollOption).not.toHaveClass(/clickable/);

    const message = page.locator('.Message:visible').first();
    await message.dblclick();
    await expect(reaction).toContainText('3');
    await expectShareShellStable(page, shareUrl);
  });

  test('keeps media viewing and viewer Escape while blocking sender navigation', async ({ page }) => {
    await page.goto('/s/demo-type-photo', { waitUntil: 'domcontentloaded' });
    await waitForShareReady(page);
    const shareUrl = page.url();

    await page.locator('.Message:visible .full-media').click();
    await expect(page.locator('#MediaViewer')).toBeVisible();
    await page.locator('#MediaViewer .SenderInfo').click();
    await expect(page.locator('#MediaViewer')).toBeVisible();
    await expect(page).toHaveURL(shareUrl);

    await page.keyboard.press('Escape');
    await expect(page.locator('#MediaViewer')).toHaveCount(0);
    await expectShareShellStable(page, shareUrl);
  });

  test('keeps same-share replies and the generated Telegram fallback link', async ({ page }) => {
    await page.goto('/s/demo-type-reply', { waitUntil: 'domcontentloaded' });
    await waitForShareReady(page);
    const replyUrl = page.url();
    await page.locator('.EmbeddedMessage').click();
    await expect(page.getByText('Plain text message', { exact: true })).toBeVisible();
    await expectShareShellStable(page, replyUrl);

    await page.goto('/s/demo-type-unhosted', { waitUntil: 'domcontentloaded' });
    await waitForShareReady(page);
    await page.evaluate(() => {
      window.open = (url?: string | URL) => {
        document.documentElement.dataset.openedUrl = String(url);
        return window;
      };
    });
    await page.getByRole('button', { name: 'View in Telegram' }).click({ noWaitAfter: true });
    await expect(page.locator('html')).toHaveAttribute(
      'data-opened-url',
      /https:\/\/t\.me\/examplebot\?start=get_demo-type-unhosted_/,
    );
  });

  test('reserves the forwarded header for nested forwards', async ({ page }) => {
    await page.goto('/s/demo-type-nested', { waitUntil: 'domcontentloaded' });
    await waitForShareReady(page);

    const message = page.locator('.Message:visible').first();
    await expect(message.getByText('Forwarded from', { exact: true })).toBeVisible();
    await expect(message.getByText('Alice Example', { exact: true })).toBeVisible();
    await expect(page.locator('.sender-group-container .Avatar')).toHaveCount(0);
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
