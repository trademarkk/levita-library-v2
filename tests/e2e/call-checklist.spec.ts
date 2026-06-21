import { expect, test } from '@playwright/test';
import { collectConsoleFailures, loginAs, logout, openTab } from './helpers';

test('чек-лист звонка загружается из базы и одинаков для руководителя и администратора', async ({ page }) => {
  const consoleFailures = collectConsoleFailures(page);

  await loginAs(page, 'owner');
  await openTab(page, 'Чек-лист звонка');
  await expect(page.getByText('Поздороваться и назвать студию')).toBeVisible();
  await expect(page.getByText('Уточнить цель клиента')).toBeVisible();

  await logout(page);
  await loginAs(page, 'admin');
  await page.getByRole('button', { name: 'Я сегодня не на смене' }).click();
  await openTab(page, 'Чек-лист звонка');
  await expect(page.getByText('Поздороваться и назвать студию')).toBeVisible();
  await expect(page.getByText('Уточнить цель клиента')).toBeVisible();

  expect(consoleFailures).toEqual([]);
});

test('чек-лист звонка компактен, пронумерован и очищает отметки', async ({ page }) => {
  const consoleFailures = collectConsoleFailures(page);

  await loginAs(page, 'admin');
  await page.getByRole('button', { name: 'Я сегодня не на смене' }).click();
  await openTab(page, 'Чек-лист звонка');

  const grid = page.getByTestId('call-checklist-grid');
  await expect(grid).toHaveCSS('grid-template-columns', /.+ .+/);
  await expect(grid.getByText('1.', { exact: true })).toBeVisible();
  await expect(grid.getByText('2.', { exact: true })).toBeVisible();

  const checkboxes = grid.getByRole('checkbox');
  const clearButton = page.getByRole('button', { name: 'Очистить отметки' });
  await expect(clearButton).toBeDisabled();

  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await expect(page.getByText('Отмечено 2 из 2')).toBeVisible();
  await expect(clearButton).toBeEnabled();

  await clearButton.click();
  await expect(checkboxes.nth(0)).not.toBeChecked();
  await expect(checkboxes.nth(1)).not.toBeChecked();
  await expect(page.getByText('Отмечено 0 из 2')).toBeVisible();
  await expect(clearButton).toBeDisabled();

  expect(consoleFailures).toEqual([]);
});
