import { expect, test } from '@playwright/test';

const PATH = 'e2e/konflikt';

test('saving over someone else’s newer version asks first', async ({ browser, baseURL }) => {
	// Version 1 of the page.
	await (
		await browser.newPage()
	).request.post(`${baseURL}/w/${PATH}/edit?/save`, {
		form: { title: 'Konflikt', content: 'Ursprung' },
		headers: { origin: baseURL! },
		maxRedirects: 0
	});

	// Two people open the editor on version 1.
	const alice = await browser.newPage();
	const bob = await browser.newPage();
	for (const page of [alice, bob]) {
		await page.goto(`/w/${PATH}/edit`, { waitUntil: 'networkidle' });
	}

	await alice.getByLabel('Titel').fill('Konflikt von Alice');
	await alice.getByRole('button', { name: 'Speichern', exact: true }).click();
	await alice.waitForURL(`**/w/${PATH}`);

	// Bob saves on top of version 1 — refused, his edit stays in the form.
	await bob.getByLabel('Titel').fill('Konflikt von Bob');
	await bob.getByRole('button', { name: 'Speichern', exact: true }).click();
	await expect(bob.getByText('inzwischen gespeichert (jetzt Version 2)')).toBeVisible();
	await expect(bob).toHaveURL(new RegExp(`/w/${PATH}/edit$`));
	await expect(bob.getByLabel('Titel')).toHaveValue('Konflikt von Bob');

	// He decides to overwrite anyway.
	await bob.getByRole('button', { name: 'Trotzdem speichern' }).click();
	await bob.waitForURL(`**/w/${PATH}`);
	await expect(bob.getByRole('heading', { level: 1 })).toHaveText('Konflikt von Bob');

	// Alice's version isn't lost either: 1 → Alice (2) → Bob (3).
	await bob.goto(`/w/${PATH}/history`);
	await expect(bob.getByRole('button', { name: /^Version \d/ })).toHaveCount(3);
});
