import { expect, test } from '@playwright/test';

test('only the content area scrolls, never the whole window', async ({ page }) => {
	await page.setViewportSize({ width: 1400, height: 900 });
	// A long page, in both views; the edit view also measures page breaks
	// off screen, which must not stretch the window either.
	for (const path of ['/w/e2e/long-text', '/w/e2e/long-text/edit']) {
		await page.goto(path);
		await expect(page.locator('[data-page-break]').first()).toBeAttached({ timeout: 15_000 });

		const scroll = await page.evaluate(() => ({
			window: document.documentElement.scrollHeight - window.innerHeight,
			content: (() => {
				const main = document.querySelector('main main')!;
				return main.scrollHeight - main.clientHeight;
			})()
		}));
		expect(scroll.window, path).toBe(0);
		expect(scroll.content, path).toBeGreaterThan(0);
	}
});
