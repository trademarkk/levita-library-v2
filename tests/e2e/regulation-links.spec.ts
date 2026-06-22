import { expect, test } from '@playwright/test';
import { collectConsoleFailures, loginAs, openTab } from './helpers';

test('существующая ссылка из текста остается у правильной роли и открывается как ссылка', async ({ page }) => {
  const consoleFailures = collectConsoleFailures(page);

  await loginAs(page, 'owner');
  await openTab(page, 'Регламенты');
  await page.getByRole('button', { name: 'Регламенты для администратора', exact: true }).click();

  const card = page.locator('[data-search-target="knowledge:knowledge-admin-regulation"]');
  await expect(card).toContainText('Регламент администратора');
  const link = card.getByRole('link', { name: 'Открыть регламент' });
  await expect(link).toHaveAttribute('href', 'https://drive.google.com/document/d/existing-admin-regulation');
  await expect(link).toHaveAttribute('target', '_blank');

  await page.getByRole('button', { name: 'Регламенты для ассистента', exact: true }).click();
  await expect(page.locator('[data-search-target="knowledge:knowledge-admin-regulation"]')).toHaveCount(0);
  expect(consoleFailures).toEqual([]);
});

test('руководитель может добавить отдельную ссылку к регламенту', async ({ page }) => {
  const consoleFailures = collectConsoleFailures(page);
  const title = 'Регламент со ссылкой E2E';
  const url = 'https://drive.google.com/document/d/new-assistant-regulation';

  await page.route('**/api/mutations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, state: null, skipRefresh: true }),
    });
  });

  await loginAs(page, 'owner');
  await openTab(page, 'Регламенты');
  await page.getByRole('button', { name: 'Регламенты для ассистента', exact: true }).click();
  await page.getByPlaceholder('Название').fill(title);
  await page.getByLabel('Ссылка на регламент').fill(url);
  await page.getByPlaceholder('Текст регламента').fill('Краткое описание документа.');
  await page.getByRole('button', { name: 'Сохранить' }).click();

  const card = page.locator('[data-search-target^="knowledge:"]').filter({ hasText: title });
  await expect(card).toBeVisible();
  await expect(card.getByRole('link', { name: 'Открыть регламент' })).toHaveAttribute('href', url);

  await page.getByRole('button', { name: 'Регламенты для администратора', exact: true }).click();
  await expect(page.locator('[data-search-target^="knowledge:"]').filter({ hasText: title })).toHaveCount(0);
  expect(consoleFailures).toEqual([]);
});
