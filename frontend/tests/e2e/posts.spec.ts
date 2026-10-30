import { test, expect } from '@playwright/test';
import { uiLogin } from '../helpers/auth';

const ADMIN_EMAIL = 'admin@shpora.ru';
const ADMIN_PASSWORD = 'admin12345';

const POST_COMMENT = 'Playwright E2E test: post creation check';

test.describe('Posts: unauthenticated access', () => {
  test('guest is redirected from the post creation page to /login', async ({
    page,
  }) => {
    await page.goto('/posts/new');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Posts: creation (authentication required)', () => {
  test.beforeEach(async ({ page }) => {
    await uiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test('authenticated user can open the post creation form', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'Выложить' }).click();

    await expect(page).toHaveURL('/posts/new');
    await expect(
      page.getByRole('heading', { name: 'Новый пост' }),
    ).toBeVisible();

    await expect(page.getByTestId('post-comment')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Опубликовать' }),
    ).toBeVisible();
  });

  test('user can publish a post and see it in the feed', async ({ page }) => {
    const dictionaryResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/dictionaries') &&
        response.status() === 200,
    );

    await page.getByRole('link', { name: 'Выложить' }).click();
    await expect(page).toHaveURL('/posts/new');

    const dictionaryResponse = await dictionaryResponsePromise;

    await page.getByTestId('post-comment').fill(POST_COMMENT);

    for (const label of [
      'Институт',
      'Предмет',
      'Год',
      'Семестр',
      'Тип работы',
    ]) {
      const combobox = page.getByRole('combobox', { name: label });

      await expect(combobox).toBeVisible();
      await combobox.click();

      const options = page.getByRole('option');

      await expect(options.first()).toBeVisible();

      const realOption = options
        .filter({ hasNotText: /^(Выберите…|Не указан)$/ })
        .first();

      await expect(realOption).toBeVisible();
      await realOption.click();
    }

    await page.locator('input[type="file"]').setInputFiles({
      name: 'test-file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\nTest file for Playwright\n%%EOF'),
    });

    const postRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === 'POST' && request.url().includes('/api/posts'),
    );

    await page.getByRole('button', { name: 'Опубликовать' }).click();

    await postRequestPromise;

    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('article').filter({ hasText: POST_COMMENT }).first(),
    ).toBeVisible();
  });
});
