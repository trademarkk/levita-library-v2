import { expect, test } from '@playwright/test';
import { collectConsoleFailures, loginAs, openTab } from './helpers';

function localDateKey(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

test('финансовый план показывает платежи на ближайшие три дня', async ({ page }) => {
  const consoleFailures = collectConsoleFailures(page);

  await page.route('**/api/state-slice?*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.searchParams.get('slice') !== 'financial-plan') {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    const payload = await response.json();
    payload.state = {
      ...(payload.state || {}),
      upcomingFinancialPayments: [{
        rowId: 'upcoming-payment-e2e',
        title: 'Аренда студии',
        date: localDateKey(1),
        value: '45000',
      }],
    };
    await route.fulfill({ response, json: payload });
  });

  await loginAs(page, 'owner');
  await openTab(page, 'Финансовый план');

  await expect(page.getByRole('heading', { name: 'Ближайшие платежи' })).toBeVisible();
  await expect(page.getByText('Завтра', { exact: true })).toBeVisible();
  await expect(page.getByText('Аренда студии')).toBeVisible();
  await expect(page.getByText('45 000 ₽')).toBeVisible();
  expect(consoleFailures).toEqual([]);
});
