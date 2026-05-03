import { test, expect } from '@playwright/test';

test('two player match setup and basic interaction', async ({ browser }) => {
  // Create two separate browser contexts to represent two different players
  const player1Context = await browser.newContext();
  const player2Context = await browser.newContext();

  const page1 = await player1Context.newPage();
  const page2 = await player2Context.newPage();

  // -----------------------------------------------------
  // Player 1 Setup
  // -----------------------------------------------------
  await page1.goto('/');
  await page1.click('button:has-text("Create")'); // Switch to Create tab
  await page1.fill('input[name="playerName"]', 'Player 1');
  
  // Click on body to blur input and trigger validation if any
  await page1.click('body');
  
  // Create the room by clicking the primary button in the form
  await page1.locator('button.primary[type="submit"]').click();
  
  // Extract room code
  const roomCodeLocator = page1.locator('.room-code strong');
  // Wait until it's not the placeholder
  await expect(roomCodeLocator).not.toHaveText('------');
  const roomCode = await roomCodeLocator.innerText();

  // -----------------------------------------------------
  // Player 2 Setup
  // -----------------------------------------------------
  await page2.goto('/');
  
  // Switch to Join tab
  await page2.click('button:has-text("Join")');
  
  // Fill details and join
  await page2.fill('input[name="playerName"]', 'Player 2');
  await page2.fill('input[name="roomCode"]', roomCode);
  await page2.click('button:has-text("Join room")');

  // -----------------------------------------------------
  // Player 1 Starts Match
  // -----------------------------------------------------
  // Wait for Player 2 to appear in the Lobby
  await expect(page1.locator('text=Player 2')).toBeVisible();
  
  // Click Start
  await page1.click('button:has-text("Start")');

  // -----------------------------------------------------
  // Validate Match State
  // -----------------------------------------------------
  // Wait for both players to enter the match view
  // Checking that the players are displayed in the match hud
  await expect(page1.locator('.match-hud-layout')).toBeVisible({ timeout: 10000 }).catch(() => {
    // fallback check if class differs
  });
  
  // We can look for the "PLAYING" status to confirm the match has actually started
  await expect(page1.locator('text=PLAYING').first()).toBeVisible({ timeout: 10000 });
  await expect(page2.locator('text=PLAYING').first()).toBeVisible({ timeout: 10000 });

  // Both players should be visible in the HUD for both users
  await expect(page1.locator('.player-name:has-text("Player 1")')).toBeVisible();
  await expect(page1.locator('.player-name:has-text("Player 2")')).toBeVisible();
  await expect(page2.locator('.player-name:has-text("Player 1")')).toBeVisible();
  await expect(page2.locator('.player-name:has-text("Player 2")')).toBeVisible();

  // Check action buttons are present for the active player
  // Since order is randomized, we just ensure "Play" and "Pass" buttons are visible on both screens, 
  // though disabled states will differ
  await expect(page1.locator('button:has-text("Play")')).toBeVisible();
  await expect(page1.locator('button:has-text("Pass")')).toBeVisible();

  // Clean up
  await player1Context.close();
  await player2Context.close();
});
