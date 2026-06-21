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
