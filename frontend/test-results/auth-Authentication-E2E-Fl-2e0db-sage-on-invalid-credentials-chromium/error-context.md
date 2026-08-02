# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.js >> Authentication E2E Flow >> should display error message on invalid credentials
- Location: tests\auth.spec.js:27:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/login
Call log:
  - navigating to "http://localhost:5173/login", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Authentication E2E Flow', () => {
  4  |   test('should login successfully with default demo credentials and load dashboard', async ({ page }) => {
  5  |     // 1. Visit login page
  6  |     await page.goto('/login');
  7  | 
  8  |     // 2. Wait for page title or welcome text to verify page loaded
  9  |     await expect(page.locator('h1')).toContainText('Welcome back');
  10 | 
  11 |     // 3. Inputs are prefilled with demo credentials, but let's explicitly fill them to be robust
  12 |     await page.fill('input[type="email"]', 'demo@pfm.com');
  13 |     await page.fill('input[type="password"]', 'Demo@1234');
  14 | 
  15 |     // 4. Click Sign In button
  16 |     await page.click('button[type="submit"]');
  17 | 
  18 |     // 5. Verify redirection to home/dashboard (route '/')
  19 |     // The page URL should navigate to the base url or main path
  20 |     await expect(page).toHaveURL(/.*$/); // matched since '/' path is dashboard
  21 |     
  22 |     // We expect the main layout navigation to show dashboard elements
  23 |     // Let's check for visual confirmation of login
  24 |     await expect(page.locator('text=Demo User')).toBeVisible({ timeout: 10000 });
  25 |   });
  26 | 
  27 |   test('should display error message on invalid credentials', async ({ page }) => {
> 28 |     await page.goto('/login');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/login
  29 |     
  30 |     // Fill in incorrect details
  31 |     await page.fill('input[type="email"]', 'wrong@example.com');
  32 |     await page.fill('input[type="password"]', 'WrongPassword123');
  33 |     
  34 |     await page.click('button[type="submit"]');
  35 |     
  36 |     // Verify error notification is displayed
  37 |     const errorAlert = page.locator('.bg-red-500\\/10');
  38 |     await expect(errorAlert).toBeVisible();
  39 |     await expect(errorAlert).toContainText('Incorrect email or password');
  40 |   });
  41 | });
  42 | 
```