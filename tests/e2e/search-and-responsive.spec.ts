import { expect, test } from '@playwright/test';
import { collectConsoleFailures, loginAs, openTab } from './helpers';

test.describe('Поиск и адаптивность', () => {
  let consoleFailures: string[] = [];

  test.beforeEach(({ page }) => {
    consoleFailures = collectConsoleFailures(page);
  });

  test.afterEach(() => {
    expect(consoleFailures).toEqual([]);
  });

  test('глобальный поиск открывает вкладку, где лежит найденный материал', async ({ page }) => {
    await loginAs(page, 'assistant');
    await openTab(page, 'База знаний');
    await expect(page.getByRole('heading', { name: 'База знаний ассистента' })).toBeVisible();
    await page.getByRole('button', { name: 'Подписки' }).click();
    await expect(page.getByText('Материал для проверки поиска по хештегу.')).toBeVisible();
    await openTab(page, 'Важные задачи');

    await page.getByPlaceholder('Поиск по базе, регламентам, ссылкам').fill('e2e');
    await page.getByRole('button', { name: /База знаний ассистента/ }).click();

    await expect(page.getByRole('button', { name: 'База знаний', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('Материал для проверки поиска по хештегу.')).toBeVisible();
  });

  test('кабинет ассистента открывается на мобильном viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, 'assistant');

    await expect(page.getByRole('heading', { name: 'Кабинет ассистента' })).toBeVisible();
    await expect(page.getByText('Роль', { exact: true })).toBeVisible();

    await openTab(page, 'Рабочие ссылки и таблицы');
    await expect(page.getByRole('heading', { name: 'Рабочая таблица админов' })).toBeVisible();
  });
});
