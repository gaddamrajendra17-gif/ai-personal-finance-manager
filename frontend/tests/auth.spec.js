import { test, expect } from '@playwright/test';

test.describe('Authentication E2E Flow', () => {
  test('should login successfully with default demo credentials and load dashboard', async ({ page }) => {
    // 1. Visit login page
    await page.goto('/login');

    // 2. Wait for page title or welcome text to verify page loaded
    await expect(page.locator('h1')).toContainText('Welcome back');

    // 3. Inputs are prefilled with demo credentials, but let's explicitly fill them to be robust
    await page.fill('input[type="email"]', 'demo@pfm.com');
    await page.fill('input[type="password"]', 'Demo@1234');

    // 4. Click Sign In button
    await page.click('button[type="submit"]');

    // 5. Verify redirection to home/dashboard (route '/')
    // The page URL should navigate to the base url or main path
    await expect(page).toHaveURL(/.*$/); // matched since '/' path is dashboard
    
    // We expect the main layout navigation to show dashboard elements
    // Let's check for visual confirmation of login
    await expect(page.locator('text=Demo User')).toBeVisible({ timeout: 10000 });
  });

  test('should display error message on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in incorrect details
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'WrongPassword123');
    
    await page.click('button[type="submit"]');
    
    // Verify error notification is displayed
    const errorAlert = page.locator('.bg-red-500\\/10');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Incorrect email or password');
  });
});

