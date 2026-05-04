import { test, expect } from '@playwright/test';

const SHORT_TURN_TIME_MS = 2000;
const PENALTY_POINTS = 10;

test('timeout penalty applied when active player exceeds turn time', async ({ browser }) => {
  const player1Context = await browser.newContext();
  const player2Context = await browser.newContext();

  const page1 = await player1Context.newPage();
  const page2 = await player2Context.newPage();

  await page1.goto(`/?testTurnTime=${SHORT_TURN_TIME_MS}`);
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

  const isP1Active = await page1.locator('button:has-text("Pass")').isEnabled();
  const activePage = isP1Active ? page1 : page2;
  const waitingPage = isP1Active ? page2 : page1;

  // Wait for turn time to expire
  await activePage.waitForTimeout(SHORT_TURN_TIME_MS + 3000);

  // Assert negative timer display
  const turnTimer = activePage.getByTestId('turn-timer');
  await expect(turnTimer).toContainText('-');
  await expect(turnTimer).toHaveClass(/overtime/);

  // Record scores BEFORE pass
  const activePlayerId = await activePage.locator('[data-testid="player-card"][data-active="true"]').getAttribute('data-player-id');
  if (!activePlayerId) throw new Error('Active player ID not found');

  const activePlayerCard = activePage.locator(`[data-testid="player-card"][data-player-id="${activePlayerId}"]`);
  const beforeScoreText = await activePlayerCard.getAttribute('data-score');
  const beforeScore = parseInt(beforeScoreText || '0', 10);

  // Active player passes — finishTurn checks elapsed > turnTimeMs → penalty
  await activePage.locator('button:has-text("Pass")').click();

  // Wait for score to decrease by PENALTY_POINTS
  const expectedScore = beforeScore - PENALTY_POINTS;
  await expect(activePlayerCard).toHaveAttribute('data-score', String(expectedScore), { timeout: 10000 });
  await expect(activePlayerCard.getByTestId('player-delta')).toHaveText(`-${PENALTY_POINTS}`, { timeout: 10000 });

  // Record score AFTER pass
  const afterScoreText = await activePlayerCard.getAttribute('data-score');
  const afterScore = parseInt(afterScoreText || '0', 10);
  expect(beforeScore - afterScore).toBe(PENALTY_POINTS);

  // Penalty applied once — turn advanced
  await expect(activePage.locator('button:has-text("Pass")')).toBeDisabled();

  // Waiting player's page also shows the penalty
  const waitingPagePlayerCard = waitingPage.locator(`[data-testid="player-card"][data-player-id="${activePlayerId}"]`);
  await expect(waitingPagePlayerCard).toHaveAttribute('data-score', String(expectedScore), { timeout: 10000 });
  await expect(waitingPagePlayerCard.getByTestId('player-delta')).toHaveText(`-${PENALTY_POINTS}`, { timeout: 10000 });

  await player1Context.close();
  await player2Context.close();
});
