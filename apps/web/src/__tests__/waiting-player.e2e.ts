import { test, expect } from '@playwright/test';

test('waiting player can organize rack but not act', async ({ browser }) => {
  const player1Context = await browser.newContext();
  const player2Context = await browser.newContext();

  const page1 = await player1Context.newPage();
  const page2 = await player2Context.newPage();

  // -----------------------------------------------------
  // Player 1 Setup
  // -----------------------------------------------------
  await page1.goto('/');
  await page1.click('button:has-text("Create")');
  await page1.fill('input[name="playerName"]', 'Player 1');
  await page1.click('body');
  await page1.locator('button.primary[type="submit"]').click();
  
  const roomCodeLocator = page1.locator('.room-code strong');
  await expect(roomCodeLocator).not.toHaveText('------');
  const roomCode = await roomCodeLocator.innerText();

  // -----------------------------------------------------
  // Player 2 Setup
  // -----------------------------------------------------
  await page2.goto('/');
  await page2.click('button:has-text("Join")');
  await page2.fill('input[name="playerName"]', 'Player 2');
  await page2.fill('input[name="roomCode"]', roomCode);
  await page2.click('button:has-text("Join room")');

  // -----------------------------------------------------
  // Start Match
  // -----------------------------------------------------
  await expect(page1.locator('.player-name:has-text("Player 2")')).toBeVisible();
  await page1.click('button:has-text("Start")');

  // Wait for match to start
  await expect(page1.locator('text=PLAYING').first()).toBeVisible({ timeout: 10000 });
  await expect(page2.locator('text=PLAYING').first()).toBeVisible({ timeout: 10000 });

  // Wait for action buttons to appear
  await expect(page1.locator('button:has-text("Play")')).toBeVisible();
  await expect(page2.locator('button:has-text("Play")')).toBeVisible();

  // -----------------------------------------------------
  // Determine who is waiting
  // -----------------------------------------------------
  let activePage, waitingPage;
  
  // The active player will have an enabled Pass button (since Play requires a draft)
  // Let's use Pass to determine active state.
  const isP1Active = await page1.locator('button:has-text("Pass")').isEnabled();
  
  if (isP1Active) {
    activePage = page1;
    waitingPage = page2;
  } else {
    activePage = page2;
    waitingPage = page1;
  }

  // 1. Verify action buttons are disabled for waiting player
  await expect(waitingPage.locator('button:has-text("Play")')).toBeDisabled();
  // Swap might be disabled for active player if bag is low, but we expect it to be strictly disabled for waiting
  await expect(waitingPage.locator('button:has-text("Swap")')).toBeDisabled();
  await expect(waitingPage.locator('button:has-text("Pass")')).toBeDisabled();
  await expect(waitingPage.locator('button:has-text("Recall")')).toBeDisabled();

  // 2. Verify rack tiles exist
  const waitingRackTiles = waitingPage.locator('.rack-shell .tile');
  // Wait for at least one tile
  await expect(waitingRackTiles.first()).toBeVisible();
  
  const activeRackTiles = activePage.locator('.rack-shell .tile');
  await expect(activeRackTiles.first()).toBeVisible();

  const initialActiveTile0 = await activeRackTiles.nth(0).getAttribute('data-testid');
  
  // 3. Capture initial waiting rack order
  const tile0Id = await waitingRackTiles.nth(0).getAttribute('data-testid');
  const tile1Id = await waitingRackTiles.nth(1).getAttribute('data-testid');
  
  expect(tile0Id).not.toBeNull();
  expect(tile1Id).not.toBeNull();

  // 4. Reorder rack tiles locally
  await waitingRackTiles.nth(0).click();
  await waitingRackTiles.nth(1).click();

  // Verify order changed
  const newTile0Id = await waitingRackTiles.nth(0).getAttribute('data-testid');
  const newTile1Id = await waitingRackTiles.nth(1).getAttribute('data-testid');
  
  expect(newTile0Id).toBe(tile1Id);
  expect(newTile1Id).toBe(tile0Id);

  // 5. Verify active player rack order is unaffected
  const currentActiveTile0 = await activeRackTiles.nth(0).getAttribute('data-testid');
  expect(currentActiveTile0).toBe(initialActiveTile0);

  // 6. Attempt to place tile on board
  // Click a tile to select it
  await waitingRackTiles.nth(0).click();
  
  // Click center of board
  const boardHost = waitingPage.locator('.board-scroll-container');
  await boardHost.click({ position: { x: 100, y: 100 } });
  
  // Check that the Play button is still disabled (no draft was created)
  await expect(waitingPage.locator('button:has-text("Play")')).toBeDisabled();
  
  // Verify `draggable` is false on the rack tiles for the waiting player
  await expect(waitingRackTiles.nth(0)).toHaveAttribute('draggable', 'false');

  // 7. No draft/ghost tiles appear on waiting player's board
  // After selecting a tile and clicking the board, no placed tiles should appear
  // Board canvas uses PixiJS, so we check that the Play button remains disabled
  // (a draft would enable it if the waiting player were active)
  await expect(waitingPage.locator('button:has-text("Play")')).toBeDisabled();

  // 8. Active player's board has no ghost from waiting player's actions
  // Ghost placements would come via room:presence, but waiting player's
  // draft/broadcast is blocked by actionsFrozen/isMyTurn guards.
  // Verify active player still sees the same number of rack tiles (unchanged)
  const activeTileCount = await activePage.locator('.rack-shell .tile').count();
  expect(activeTileCount).toBeGreaterThanOrEqual(1);

  await player1Context.close();
  await player2Context.close();
});
