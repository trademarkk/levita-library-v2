import { expect, type Page } from '@playwright/test';

export const credentials = {
  owner: { email: 'owner@levita.ru', password: 'owner123', heading: 'Кабинет руководителя', path: '/owner' },
  assistant: { email: 'assistant@levita.ru', password: 'assistant123', heading: 'Кабинет ассистента', path: '/assistant' },
  seniorAdmin: { email: 'senior-admin@levita.ru', password: 'senior123', heading: 'Кабинет: Старший администратор', path: '/senior-admin' },
  admin: { email: 'admin@levita.ru', password: 'admin123', heading: 'Кабинет: Администратор', path: '/admin' },
  seniorTrainer: { email: 'senior-trainer@levita.ru', password: 'trainer123', heading: 'Кабинет: Старший тренер', path: '/senior-trainer' },
  trainer: { email: 'trainer@levita.ru', password: 'trainer123', heading: 'Кабинет: Тренер', path: '/trainer' },
} as const;

export type CredentialKey = keyof typeof credentials;

export async function waitForAppReady(page: Page) {
  await page.getByText(/Загружаем актуальные данные из базы|Сохраняем данные в базе/).waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
}

export async function loginAs(page: Page, userKey: CredentialKey) {
  const user = credentials[userKey];
  await page.goto('/login');
  await page.getByLabel('Электронная почта').fill(user.email);
  await page.getByLabel('Пароль').fill(user.password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('heading', { name: user.heading })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${user.path}$`));
  await waitForAppReady(page);
}

export async function logout(page: Page) {
  await page.getByRole('link', { name: /Выйти/ }).click();
  await expect(page.getByRole('heading', { name: 'Добро пожаловать' })).toBeVisible();
}

export async function openTab(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
  await waitForAppReady(page);
}

export function collectConsoleFailures(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', (error) => {
    failures.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!/(ReferenceError|TypeError|RangeError|Uncaught)/.test(text)) return;
    failures.push(text);
  });
  return failures;
}
