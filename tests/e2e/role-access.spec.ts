import { expect, test } from '@playwright/test';
import { collectConsoleFailures, loginAs, openTab } from './helpers';

test.describe('Права и навигация по ролям', () => {
  let consoleFailures: string[] = [];

  test.beforeEach(({ page }) => {
    consoleFailures = collectConsoleFailures(page);
  });

  test.afterEach(() => {
    expect(consoleFailures).toEqual([]);
  });

  test('руководитель видит управленческие разделы и форму добавления сотрудника', async ({ page }) => {
    await loginAs(page, 'owner');

    for (const tab of [
      'Мои таблицы и ссылки',
      'Центр контроля',
      'Журнал смен',
      'Аудит действий',
      'Команда',
      'Финансовый план',
      'Расходы',
      'Листы оценивания',
      'Приём тренера',
      'Рейтинг звонков',
      'Рабочие ссылки и таблицы',
      'Полезные контакты',
      'Контроль чек-листов',
    ]) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }

    await openTab(page, 'Команда');
    await page.getByRole('button', { name: 'Добавить сотрудника' }).click();
    await expect(page.getByRole('heading', { name: 'Новый сотрудник' })).toBeVisible();
    await expect(page.getByPlaceholder('Имя')).toBeVisible();
    await expect(page.getByPlaceholder('Почта')).toBeVisible();
  });

  test('администратор может войти без смены только для изучения материалов', async ({ page }) => {
    await loginAs(page, 'admin');

    await expect(page.getByRole('heading', { name: 'Перед началом смены' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Я на смене' })).toBeVisible();
    await page.getByRole('button', { name: 'Я сегодня не на смене' }).click();

    await expect(page.getByText('Доступны материалы без открытия смены')).toBeVisible();
    await openTab(page, 'Чек-лист дня');
    await expect(page.getByRole('heading', { name: 'Чек-лист доступен только на смене' })).toBeVisible();
  });

  test('старший администратор открывает формы шаблонов и рабочих ссылок по кнопке', async ({ page }) => {
    await loginAs(page, 'seniorAdmin');
    await page.getByRole('button', { name: 'Я сегодня не на смене' }).click();

    await openTab(page, 'Шаблоны сообщений');
    await page.getByRole('button', { name: 'Добавить шаблон' }).click();
    await expect(page.getByRole('heading', { name: 'Добавить шаблон сообщения' })).toBeVisible();
    await expect(page.getByText('Поле ссылки обязательно.')).toBeHidden();

    await openTab(page, 'Рабочие ссылки и таблицы');
    await page.getByRole('button', { name: 'Добавить ссылку' }).click();
    await expect(page.getByRole('heading', { name: 'Добавить рабочую ссылку или таблицу' })).toBeVisible();
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText('Укажите название.')).toBeVisible();
  });

  test('старший тренер управляет тренерскими ссылками и видит приём тренера', async ({ page }) => {
    await loginAs(page, 'seniorTrainer');

    await expect(page.getByRole('button', { name: 'Приём тренера', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Шаблоны сообщений', exact: true })).toHaveCount(0);

    await openTab(page, 'Рабочие ссылки и таблицы');
    await expect(page.getByRole('heading', { name: 'Таблица тренеров' })).toBeVisible();
    await page.getByRole('button', { name: 'Добавить ссылку' }).click();
    await expect(page.getByRole('heading', { name: 'Добавить рабочую ссылку или таблицу' })).toBeVisible();

    await openTab(page, 'Приём тренера');
    await expect(page.getByText('Ольга Кандидат')).toBeVisible();
  });

  test('тренер видит только тренерский набор вкладок без шаблонов сообщений', async ({ page }) => {
    await loginAs(page, 'trainer');

    await expect(page.getByRole('button', { name: 'Рабочие ссылки и таблицы', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Рейтинг тренеров', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Шаблоны сообщений', exact: true })).toHaveCount(0);
  });
});
