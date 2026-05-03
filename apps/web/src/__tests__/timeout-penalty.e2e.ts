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
  await activePage.waitForTimeout(SHORT_TURN_TIME_MS + 1500);

  // Record scores BEFORE pass
  const beforeScores = await activePage.locator('.player-score').allTextContents();
  console.log('BEFORE pass scores:', JSON.stringify(beforeScores));

  // Active player passes — finishTurn checks elapsed > turnTimeMs → penalty
  await activePage.locator('button:has-text("Pass")').click();

  // Wait for snapshot to propagate and re-render
  await activePage.waitForTimeout(1500);

  // Record scores AFTER pass
  const afterScores = await activePage.locator('.player-score').allTextContents();
  console.log('AFTER pass scores:', JSON.stringify(afterScores));

  // Assert at least one player score decreased by PENALTY_POINTS
  let penaltyFound = false;
  for (let i = 0; i < afterScores.length; i++) {
    const before = parseInt(beforeScores[i] ?? '999', 10);
    const after = parseInt(afterScores[i] ?? '999', 10);
    console.log(`player ${i}: before=${before} after=${after} diff=${before - after}`);
    if (before - after === PENALTY_POINTS) {
      penaltyFound = true;
    }
  }
  expect(penaltyFound, `Expected one player to lose ${PENALTY_POINTS} points. before=${JSON.stringify(beforeScores)} after=${JSON.stringify(afterScores)}`).toBe(true);

  // Penalty applied once — turn advanced
  await expect(activePage.locator('button:has-text("Pass")')).toBeDisabled();

  // Waiting player's page also shows the penalty in scores
  const waitingScores = await waitingPage.locator('.player-score').allTextContents();
  const waitingHasPenalty = waitingScores.some(s => s.includes(`-${PENALTY_POINTS}`));
  expect(waitingHasPenalty).toBe(true);

  await player1Context.close();
  await player2Context.close();
});
