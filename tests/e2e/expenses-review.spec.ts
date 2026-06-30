import { expect, test } from '@playwright/test';
import { collectConsoleFailures, loginAs, openTab } from './helpers';

test('локальные отметки расходов сохраняются и очищаются без записи в базу', async ({ page }) => {
  const consoleFailures = collectConsoleFailures(page);
  const apiWrites: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/') && request.method() !== 'GET') apiWrites.push(`${request.method()} ${request.url()}`);
  });
  await loginAs(page, 'owner');
  await openTab(page, 'Расходы');

  const reviewCheckbox = page.getByRole('checkbox', { name: 'Отметить расход от' });
  const expenseRow = reviewCheckbox.locator('xpath=ancestor::tr');
  const resetButton = page.getByRole('button', { name: 'Сбросить отметки' });
  const apiWritesBeforeReview = apiWrites.length;

  await expect(reviewCheckbox).not.toBeChecked();
  await expect(expenseRow).toHaveAttribute('data-expense-reviewed', 'false');
  await reviewCheckbox.check();

  await expect(reviewCheckbox).toBeChecked();
  await expect(expenseRow).toHaveAttribute('data-expense-reviewed', 'true');
  await expect(resetButton).toBeEnabled();
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('levita.expense-review.v1:user-owner');
    return raw ? JSON.parse(raw).ids : [];
  })).toContain('expense-1');
  expect(apiWrites).toHaveLength(apiWritesBeforeReview);

  await page.reload();
  await openTab(page, 'Расходы');
  await expect(page.getByRole('checkbox', { name: 'Отметить расход от' })).toBeChecked();

  await page.getByRole('button', { name: 'Сбросить отметки' }).click();
  await expect(page.getByRole('checkbox', { name: 'Отметить расход от' })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Сбросить отметки' })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('levita.expense-review.v1:user-owner'))).toBeNull();
  expect(apiWrites).toHaveLength(apiWritesBeforeReview);
  expect(consoleFailures).toEqual([]);
});
