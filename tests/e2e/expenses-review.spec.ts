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

test('расход добавляется с первого раза, сортируется и фильтруется по флагу прошлого месяца', async ({ page }) => {
  const consoleFailures = collectConsoleFailures(page);
  const month = new Date().toISOString().slice(0, 7);
  const newExpenseDate = `${month}-01`;

  await loginAs(page, 'owner');
  await openTab(page, 'Расходы');
  const existingExpenseDate = await page.locator('tr[data-expense-id="expense-1"]').getAttribute('data-expense-date');
  await page.route('**/api/mutations', async (route) => {
    const body = route.request().postDataJSON() as { action?: string };
    if (body.action === 'expense.create' || body.action === 'expense.update') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, state: null, skipRefresh: true }) });
      return;
    }
    await route.continue();
  });

  await expect(page.getByLabel('Статья расхода')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Укажите сумму расхода больше нуля.');

  await page.getByLabel('Дата расхода').fill(newExpenseDate);
  await page.getByLabel('Сумма расхода').fill('1250');
  await page.getByLabel('Комментарий к расходу').fill('Расход с флагом прошлого месяца');
  await page.getByRole('checkbox', { name: 'Кр. пред. месяца', exact: true }).check();
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();

  const createdRow = page.locator(`tr[data-expense-date="${newExpenseDate}"]`);
  await expect(createdRow).toBeVisible();
  await expect(createdRow).toHaveAttribute('data-expense-previous-month-credit', 'true');

  await page.getByRole('button', { name: 'Дата', exact: true }).click();
  await expect.poll(() => page.locator('tr[data-expense-id]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-expense-date')))).toEqual([
    newExpenseDate,
    existingExpenseDate,
  ]);

  await page.getByLabel('Фильтр по кредиторской задолженности предыдущего месяца').selectOption('FLAGGED');
  await expect(page.locator('tr[data-expense-id]')).toHaveCount(1);
  await expect(createdRow).toBeVisible();
  await createdRow.getByRole('checkbox', { name: 'Кр. пред. месяца для расхода от' }).click();
  await expect(page.locator('tr[data-expense-id]')).toHaveCount(0);
  expect(consoleFailures).toEqual([]);
});
