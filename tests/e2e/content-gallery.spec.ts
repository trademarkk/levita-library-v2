import { expect, test } from '@playwright/test';
import { collectConsoleFailures, loginAs, openTab } from './helpers';

const screenshotDataUrl = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
    <rect width="1600" height="900" fill="#25202c"/>
    <rect x="100" y="100" width="1400" height="700" rx="30" fill="#c9a98d"/>
    <text x="800" y="470" text-anchor="middle" font-family="Arial" font-size="72" fill="#141218">
      LEVTIA screenshot
    </text>
  </svg>
`)}`;

test('галерея скриншотов открывается поверх viewport и увеличивает изображение по клику', async ({ page }) => {
  const consoleFailures = collectConsoleFailures(page);

  await page.route('**/api/state-slice?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.searchParams.get('slice') !== 'content') {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    const payload = await response.json();
    const regulation = payload.state?.knowledge?.find((entry: { category?: string }) => entry.category === 'REGULATION');
    if (regulation) {
      regulation.attachments = [{
        id: 'e2e-gallery-attachment',
        knowledgeEntryId: regulation.id,
        fileName: 'regulation.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
        position: 0,
        createdAt: new Date().toISOString(),
        url: screenshotDataUrl,
      }];
    }
    await route.fulfill({ response, json: payload });
  });

  await loginAs(page, 'owner');
  await openTab(page, 'Регламенты');
  await page.getByRole('button', { name: 'Регламенты для администратора', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  await page.getByRole('button', { name: 'Посмотреть скриншоты (1)' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Просмотр скриншотов' });
  await expect(dialog).toBeVisible();

  const viewport = page.viewportSize();
  const dialogBox = await dialog.boundingBox();
  expect(viewport).not.toBeNull();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport!.height + 1);

  const image = dialog.getByRole('img', { name: 'regulation.png' });
  const initialWidth = (await image.boundingBox())!.width;
  await image.click();
  await expect(dialog.locator('.content-gallery-stage')).toHaveClass(/is-zoomed/);
  const zoomedWidth = (await image.boundingBox())!.width;
  expect(zoomedWidth).toBeGreaterThan(initialWidth * 1.2);

  await page.getByRole('button', { name: 'Уменьшить скриншот' }).click();
  await expect(dialog.locator('.content-gallery-stage')).not.toHaveClass(/is-zoomed/);
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await expect(dialog).toBeHidden();
  expect(consoleFailures).toEqual([]);
});
