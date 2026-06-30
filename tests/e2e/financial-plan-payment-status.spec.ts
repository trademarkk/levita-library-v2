import { expect, test } from '@playwright/test';
import { collectConsoleFailures, loginAs, openTab } from './helpers';

function currentMonthAndDate() {
  const date = new Date();
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return { month, day: `${month}-${String(date.getDate()).padStart(2, '0')}` };
}

test('оплаченный платеж сохраняется отдельным действием и исчезает из ближайших', async ({ page }) => {
  const consoleFailures = collectConsoleFailures(page);
  const { month, day } = currentMonthAndDate();
  const mutationBodies: Array<{ action?: string; payload?: Record<string, unknown> }> = [];

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
      financialPlans: [{
        month,
        rows: [{ id: `${month}:rent`, title: 'Аренда', payments: { [day]: '45000' }, paidPayments: {} }],
      }],
      upcomingFinancialPayments: [{ rowId: `${month}:rent`, title: 'Аренда', date: day, value: '45000' }],
    };
    await route.fulfill({ response, json: payload });
  });

  await page.route('**/api/mutations', async (route) => {
    mutationBodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, state: null, skipRefresh: true }) });
  });

  await loginAs(page, 'owner');
  await openTab(page, 'Финансовый план');

  const paidCheckbox = page.getByRole('checkbox', { name: /Оплачено: Аренда/ });
  await expect(paidCheckbox).toBeVisible();
  await paidCheckbox.check();
  await expect(paidCheckbox).toBeChecked();
  await expect(page.getByText('Аренда', { exact: true })).toHaveCount(0);

  await expect.poll(() => mutationBodies.find((body) => body.action === 'financial.payment.status')).toMatchObject({
    action: 'financial.payment.status',
    payload: { month, rowId: `${month}:rent`, date: day, isPaid: true },
  });
  expect(consoleFailures).toEqual([]);
});
