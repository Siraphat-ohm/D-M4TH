import { test, expect } from '@playwright/test';

test('lobby preview board renders non-empty', async ({ page }) => {
  await page.goto('/');

  const boardHost = page.locator('[data-testid="board-host"]');
  await expect(boardHost).toBeVisible({ timeout: 10000 });

  // Board host has non-zero dimensions
  const hostBox = await boardHost.boundingBox();
  expect(hostBox).not.toBeNull();
  expect(hostBox!.width).toBeGreaterThan(50);
  expect(hostBox!.height).toBeGreaterThan(50);

  // Render overlay should disappear once PixiJS initializes the canvas
  const overlay = boardHost.locator('.board-render-overlay');
  await expect(overlay).not.toBeVisible({ timeout: 15000 });

  // Canvas element exists and has non-zero dimensions
  const canvas = boardHost.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 10000 });
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(canvasBox!.width).toBeGreaterThan(0);
  expect(canvasBox!.height).toBeGreaterThan(0);
});

test('lobby preview board keeps canvas across repeated reloads', async ({ page }) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.goto('/');

    const boardHost = page.locator('[data-testid="board-host"]');
    await expect(boardHost, `reload ${attempt + 1}: board host visible`).toBeVisible({ timeout: 10000 });

    const overlay = boardHost.locator('.board-render-overlay');
    await expect(overlay, `reload ${attempt + 1}: loading overlay clears`).not.toBeVisible({ timeout: 15000 });

    const canvas = boardHost.locator('canvas');
    await expect(canvas, `reload ${attempt + 1}: canvas visible`).toBeVisible({ timeout: 10000 });

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox, `reload ${attempt + 1}: canvas box exists`).not.toBeNull();
    expect(canvasBox!.width, `reload ${attempt + 1}: canvas width`).toBeGreaterThan(0);
    expect(canvasBox!.height, `reload ${attempt + 1}: canvas height`).toBeGreaterThan(0);
  }
});

test('match board renders non-empty after starting', async ({ browser }) => {
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

  // Check match board
  const boardHost = page1.locator('[data-testid="board-host"]');
  await expect(boardHost).toBeVisible({ timeout: 10000 });

  const overlay = boardHost.locator('.board-render-overlay');
  await expect(overlay).not.toBeVisible({ timeout: 15000 });

  const canvas = boardHost.locator('canvas');
  await expect(canvas).toBeVisible();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(canvasBox!.width).toBeGreaterThan(0);
  expect(canvasBox!.height).toBeGreaterThan(0);

  await player1Context.close();
  await player2Context.close();
});

test('board remains non-empty after viewport resize', async ({ browser }) => {
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

  const boardHost = page1.locator('[data-testid="board-host"]');
  await expect(boardHost).toBeVisible({ timeout: 10000 });

  const overlay = boardHost.locator('.board-render-overlay');
  await expect(overlay).not.toBeVisible({ timeout: 15000 });

  // Resize to tablet portrait
  await page1.setViewportSize({ width: 768, height: 1024 });
  await page1.waitForTimeout(1000);

  // Board should still be rendered
  await expect(boardHost).toBeVisible();
  const canvas = boardHost.locator('canvas');
  await expect(canvas).toBeVisible();

  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(canvasBox!.width).toBeGreaterThan(0);
  expect(canvasBox!.height).toBeGreaterThan(0);

  // No loading overlay after resize
  await expect(overlay).not.toBeVisible({ timeout: 10000 });

  await player1Context.close();
  await player2Context.close();
});
