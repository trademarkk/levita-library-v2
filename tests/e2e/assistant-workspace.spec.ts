import { expect, test } from '@playwright/test';
import { collectConsoleFailures, loginAs, openTab } from './helpers';

test.describe('Кабинет ассистента', () => {
  let consoleFailures: string[] = [];

  test.beforeEach(({ page }) => {
    consoleFailures = collectConsoleFailures(page);
  });

  test.afterEach(() => {
    expect(consoleFailures).toEqual([]);
  });

  test('показывает ключевые вкладки роли', async ({ page }) => {
    await loginAs(page, 'assistant');

    for (const tab of [
      'Центр контроля',
      'Журнал смен',
      'Аудит действий',
      'Важные задачи',
      'Финансовый план',
      'Расходы',
      'Команда',
      'Листы оценивания',
      'Приём тренера',
      'Рейтинг тренеров',
      'Рейтинг звонков',
      'Контроль чек-листов',
      'База знаний',
      'Шаблоны ответов',
      'Рабочие ссылки и таблицы',
      'Чек-лист дня',
    ]) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }
  });

  test('база знаний открывает форму по кнопке и фильтруется по хештегу', async ({ page }) => {
    await loginAs(page, 'assistant');
    await openTab(page, 'База знаний');

    await expect(page.getByRole('button', { name: 'Добавить материал' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'База знаний ассистента' })).toBeVisible();

    await page.getByRole('button', { name: 'Добавить материал' }).click();
    await expect(page.getByRole('heading', { name: 'Добавить материал в базу знаний' })).toBeVisible();
    await expect(page.getByLabel('Бизнес-модель')).toBeVisible();

    await page.getByRole('button', { name: 'Подписки' }).click();
    await page.getByLabel('Поиск по хештегу').fill('#e2e');
    await expect(page.getByText('Материал для проверки поиска по хештегу.')).toBeVisible();
  });

  test('важная информация ассистента имеет отдельную форму добавления', async ({ page }) => {
    await loginAs(page, 'assistant');
    await openTab(page, 'Важная информация');

    await expect(page.getByRole('button', { name: 'Добавить информацию' })).toBeVisible();
    await page.getByRole('button', { name: 'Добавить информацию' }).click();
    await expect(page.getByRole('heading', { name: 'Добавить важную информацию' })).toBeVisible();
    await expect(page.getByPlaceholder('Название информации')).toBeVisible();
  });

  test('шаблоны ответов не создают заготовку сразу после клика', async ({ page }) => {
    await loginAs(page, 'assistant');
    await openTab(page, 'Шаблоны ответов');

    await expect(page.getByText('Ответ кандидату')).toBeVisible();
    const initialCards = await page.locator('[data-search-target^="template:"]').count();

    await page.getByRole('button', { name: 'Добавить шаблон' }).click();
    await expect(page.getByRole('heading', { name: 'Новый шаблон ответа' })).toBeVisible();
    await expect(page.locator('[data-search-target^="template:"]')).toHaveCount(initialCards);

    await page.getByRole('button', { name: 'Сохранить шаблон' }).click();
    await expect(page.getByText('Заполните название и текст шаблона.')).toBeVisible();
  });

  test('сложные рабочие разделы открываются без ошибок', async ({ page }) => {
    await loginAs(page, 'assistant');

    await openTab(page, 'Финансовый план');
    await expect(page.getByRole('heading', { name: 'Финансовый план' })).toBeVisible();
    await expect(page.locator('input[value="Аренда"]').first()).toBeVisible();

    await openTab(page, 'Расходы');
    await expect(page.getByRole('heading', { name: 'Расходы' })).toBeVisible();
    await expect(page.getByText('Тестовый расход')).toBeVisible();

    await openTab(page, 'Листы оценивания');
    await expect(page.getByRole('heading', { name: 'Листы оценивания' })).toBeVisible();
    await expect(page.getByText('Мила Тренер')).toBeVisible();

    await openTab(page, 'Приём тренера');
    await expect(page.getByRole('heading', { name: 'Приём тренера' })).toBeVisible();
    await expect(page.getByText('Ольга Кандидат')).toBeVisible();

    await openTab(page, 'Рейтинг звонков');
    await expect(page.getByRole('heading', { name: 'Рейтинг звонков' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Елена Администратор: 82 баллов/ })).toBeVisible();
  });
});
