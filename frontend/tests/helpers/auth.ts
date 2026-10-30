import type { APIRequestContext, Page } from '@playwright/test';

const API_BASE = process.env.VITE_API_URL ?? 'http://localhost:8000';
const LOGIN_PATH = '/api/auth/login';
const REGISTER_PATH = '/api/auth/register';

export { API_BASE };

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  user?: unknown;
}

export async function apiRegister(
  request: APIRequestContext,
  data: {
    email: string;
    nickname: string;
    password: string;
    password_confirm: string;
  },
) {
  const res = await request.post(`${API_BASE}${REGISTER_PATH}`, { data });

  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`Registration failed (${res.status()}): ${body}`);
  }

  return await res.json();
}

export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<Tokens> {
  const res = await request.post(`${API_BASE}${LOGIN_PATH}`, {
    data: { email, password },
  });

  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`Login failed (${res.status()}): ${body}`);
  }

  const body = await res.json();

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    user: body.user,
  };
}

export async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByRole('button', { name: /Войти/ }).click();
  await page.getByRole('link', { name: 'Выложить' }).waitFor({
    state: 'visible',
  });
}

export async function signInWithTokens(page: Page, tokens: Tokens) {
  await page.goto('/');

  await page.evaluate(({ at, rt }) => {
    localStorage.setItem('token', at);

    if (rt) {
      localStorage.setItem('refresh_token', rt);
    }
  }, tokens);

  await page.reload();

  await page.getByRole('link', { name: 'Выложить' }).waitFor({
    state: 'visible',
  });
}

export async function signOut(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
  });

  await page.reload();
}

export async function selectFirstRealOption(page: Page, ariaLabel: string) {
  const combobox = page.getByRole('combobox', { name: ariaLabel });

  await combobox.waitFor({ state: 'visible' });
  await combobox.click();

  const realOptions = page
    .getByRole('option')
    .filter({ hasNotText: /^(Выберите…|Не указан)$/ });

  await realOptions.first().waitFor({ state: 'visible' });
  await realOptions.first().click();
}
