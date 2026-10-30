import { test, expect } from '@playwright/test';
import { apiLogin } from '../helpers/auth';

const ADMIN_EMAIL = 'admin@shpora.ru';
const ADMIN_PASSWORD = 'admin12345';

function uniqueEmail() {
  return `user_${Date.now()}@test.shpora.ru`;
}

test.describe('Authentication: UI', () => {
  test('user can register through the form', async ({ page }) => {
    const email = uniqueEmail();
    const nickname = `Test_${Date.now()}`;

    await page.goto('/register');
    await expect(page).toHaveURL('/register');

    await page.getByTestId('register-nickname').fill(nickname);
    await page.getByTestId('register-email').fill(email);
    await page.getByTestId('register-password').fill('Password123');
    await page.getByTestId('register-confirm').fill('Password123');
    await page.getByTestId('register-agree').locator('xpath=..').click();
    await page.getByRole('button', { name: /Зарегистрироваться/ }).click();

    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('heading', { name: /Знания ближе/ }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Профиль' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Войти' })).not.toBeVisible();
  });

  test('registration is rejected when terms are not accepted', async ({
    page,
  }) => {
    await page.goto('/register');
    await page.getByTestId('register-nickname').fill('User');
    await page.getByTestId('register-email').fill('n@mail.ru');
    await page.getByTestId('register-password').fill('Password123');
    await page.getByTestId('register-confirm').fill('Password123');

    await page.getByRole('button', { name: /Зарегистрироваться/ }).click();

    await expect(page).toHaveURL('/register');
    await expect(page.getByText(/Нужно принять условия/)).toBeVisible();
  });

  test('admin can log in successfully', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(ADMIN_EMAIL);
    await page.getByTestId('login-password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Войти/ }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('link', { name: 'Профиль' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Войти' })).not.toBeVisible();
  });

  test('user remains on the login page after entering an incorrect password', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(ADMIN_EMAIL);
    await page.getByTestId('login-password').fill('wrong-password');
    await page.getByRole('button', { name: /Войти/ }).click();

    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('button', { name: /Войти/ })).toBeEnabled();
  });

  test('user can authenticate through the API', async ({ page, request }) => {
    await apiLogin(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Знания ближе/ }),
    ).toBeVisible();
  });
});
