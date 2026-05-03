import { test, expect } from '@playwright/test';

test('remaining player sees winner notice and stays on match after opponent leaves', async ({ browser }) => {
  const player1Context = await browser.newContext();
  const player2Context = await browser.newContext();
  const page1 = await player1Context.newPage();
  const page2 = await player2Context.newPage();

  await page1.goto('/');
  await page1.click('button:has-text("Create")');
  await page1.fill('input[name="playerName"]', 'Player 1');
  await page1.click('body');
  await page1.locator('button.primary[type="submit"]').click();

  const roomCodeLocator = page1.locator('.room-code strong');
  await expect(roomCodeLocator).not.toHaveText('------');
  const roomCode = await roomCodeLocator.innerText();

  await page2.goto('/');
  await page2.click('button:has-text("Join")');
  await page2.fill('input[name="playerName"]', 'Player 2');
  await page2.fill('input[name="roomCode"]', roomCode);
  await page2.click('button:has-text("Join room")');

  await expect(page1.locator('.player-name:has-text("Player 2")')).toBeVisible();
  await page1.click('button:has-text("Start")');

  await expect(page1.locator('text=PLAYING').first()).toBeVisible({ timeout: 10000 });
  await expect(page2.locator('text=PLAYING').first()).toBeVisible({ timeout: 10000 });

  await page2.click('button[aria-label="Leave match"]');

  const winnerNotice = page1.locator('.notice-toast').filter({ hasText: 'wins!' });
  await expect(winnerNotice).toBeVisible({ timeout: 10000 });
  await expect(page1).toHaveURL(/\/match$/);
  await expect(page1.locator('[data-testid="board-host"]')).toBeVisible();
  await expect(page1.locator('button[aria-label="Leave match"]')).toBeVisible();

  await page1.click('button[aria-label="Leave match"]');
  await expect(page1).toHaveURL(/\/$/);

  await player1Context.close();
  await player2Context.close();
});
