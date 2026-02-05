import { test, expect } from '@playwright/test';

test.describe('LeaveBoard Application', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check that the page loaded successfully
    expect(page.url()).toContain('localhost');
  });
});
