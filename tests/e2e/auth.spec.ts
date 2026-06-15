import { expect, test } from '@playwright/test';
import { collectConsoleFailures, credentials, loginAs, logout } from './helpers';

test.describe('Авторизация и защищённые маршруты', () => {
  let consoleFailures: string[] = [];

  test.beforeEach(({ page }) => {
    consoleFailures = collectConsoleFailures(page);
  });

  test.afterEach(() => {
    expect(consoleFailures).toEqual([]);
  });

  test('гость не может открыть защищённый кабинет по прямой ссылке', async ({ page }) => {
    await page.goto('/assistant');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Добро пожаловать' })).toBeVisible();
    await expect(page.getByLabel('Электронная почта')).toBeVisible();
  });

  test('показывает ошибку при неверном пароле', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Электронная почта').fill(credentials.assistant.email);
    await page.getByLabel('Пароль').fill('wrong-password');
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page.getByText('Неверный пароль.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  for (const [key, user] of Object.entries(credentials)) {
    test(`вход под ролью ${key} открывает правильный кабинет`, async ({ page }) => {
      await loginAs(page, key as keyof typeof credentials);

      await expect(page.getByRole('heading', { name: user.heading })).toBeVisible();
      await expect(page.getByText('Рабочий стол')).toBeVisible();
    });
  }

  test('выход очищает сессию и возвращает на страницу входа', async ({ page }) => {
    await loginAs(page, 'assistant');
    await logout(page);

    await page.goto('/assistant');
    await expect(page).toHaveURL(/\/login$/);
  });
});
