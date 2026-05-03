import type { PremiumMapId } from "@d-m4th/config";
import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import { renderBoard, createInitialCache, type BoardRenderCache } from "../board/board-renderer";

export interface PixiRenderParams {
  boardPixelSize: number;
  boardSize: number;
  premiumMapId: PremiumMapId;
  boardTiles: BoardTile[];
  draft: readonly Placement[];
  ghostTiles: BoardTile[];
  players: PublicSnapshot["players"];
  rack: Tile[];
  draftOwnerId?: string;
  selectedTileId?: string;
}

type PixiApplication = import("pixi.js").Application;
type PixiContainer = import("pixi.js").Container;

const BOARD_BACKGROUND_COLOR = 0x080a0f;
const MAX_RENDER_RESOLUTION = 3;
const MAX_BACKING_STORE_PIXELS = 4096;
let silkscreenBitmapFontInstalled = false;

function debugPixiBoard(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.debug("[PixiBoardGame]", ...args);
  }
}

function installSilkscreenBitmapFont(BitmapFont: typeof import("pixi.js").BitmapFont): void {
  if (silkscreenBitmapFontInstalled) {
    debugPixiBoard("BitmapFont.install skipped");
    return;
  }

  debugPixiBoard("BitmapFont.install start");
  BitmapFont.install({
    name: "Silkscreen",
    style: { fontFamily: "Silkscreen", fontSize: 64 },
    chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~★×÷±≤≥"
  });
  silkscreenBitmapFontInstalled = true;
  debugPixiBoard("BitmapFont.install done");
}

export class PixiBoardGame {
  private app?: PixiApplication;
  private root?: PixiContainer;
  private canvas?: HTMLCanvasElement;
  private latestParams?: PixiRenderParams;
  private cache: BoardRenderCache = createInitialCache();
  private currentSize = 0;
  private currentResolution = 1;
  private recreatePromise: Promise<void> | null = null;
  private queuedRecreate?: { size: number; resolution: number };
  private disposed = false;

  constructor(private readonly parent: HTMLElement, private readonly initialSize: number) {}

  async init(): Promise<void> {
    debugPixiBoard("init:start", { initialSize: this.initialSize });
    const { Application, BitmapFont, Container } = await import("pixi.js");
    debugPixiBoard("dynamic import pixi done");
    const fontWaitResult = await waitForFonts();
    debugPixiBoard(`fonts:wait:${fontWaitResult}`);

    installSilkscreenBitmapFont(BitmapFont);

    const app = new Application();
    const bootSize = sanitizeSize(this.initialSize);
    const resolution = renderResolutionForSize(bootSize);

    debugPixiBoard("app:init:start", { bootSize, resolution });
    await app.init({
      width: bootSize,
      height: bootSize,
      backgroundColor: BOARD_BACKGROUND_COLOR,
      antialias: false,
      autoDensity: true,
      autoStart: false,
      preference: "webgl",
      resolution,
      roundPixels: true
    });
    debugPixiBoard("app:init:done");

    if (this.disposed) {
      debugPixiBoard("disposed after app init");
      app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true, texture: true, textureSource: true });
      return;
    }

    const root = new Container();
    app.stage.addChild(root);
    app.canvas.className = "board-pixi-canvas";
    app.canvas.style.display = "block";
    app.canvas.style.width = `${bootSize}px`;
    app.canvas.style.height = `${bootSize}px`;

    debugPixiBoard("canvas:append", { size: bootSize });
    this.parent.replaceChildren(app.canvas);
    this.canvas = app.canvas;
    this.app = app;
    this.root = root;
    this.currentResolution = resolution;
    this.applyRendererSize(bootSize);
  }

  update(params: PixiRenderParams): void {
    this.latestParams = params;

    if (!this.app || !this.root || this.disposed) {
      debugPixiBoard("update skipped because app/root missing/disposed", {
        hasApp: Boolean(this.app),
        hasRoot: Boolean(this.root),
        disposed: this.disposed
      });
      return;
    }

    debugPixiBoard("update renderBoard start", { boardPixelSize: params.boardPixelSize, boardSize: params.boardSize });
    renderBoard(this.root, this.cache, params);
    debugPixiBoard("update renderBoard end");
    this.app.render();
  }

  resize(size: number): void {
    debugPixiBoard("resize called", { size, hasApp: Boolean(this.app), disposed: this.disposed });
    if (this.disposed) {
      return;
    }

    const nextSize = Math.max(1, Math.floor(size));
    const nextResolution = renderResolutionForSize(nextSize);

    if (!this.app) {
      debugPixiBoard("resize before app exists", { nextSize });
      this.currentSize = nextSize;
      return;
    }

    if (Math.abs(nextResolution - this.currentResolution) >= 0.25) {
      this.queueRecreate(nextSize, nextResolution);
      return;
    }

    this.applyRendererSize(nextSize);

    if (this.latestParams) {
      this.update({ ...this.latestParams, boardPixelSize: nextSize });
    }
  }

  destroy(): void {
    debugPixiBoard("destroy");
    this.disposed = true;
    this.destroyApplication();
  }

  private async createApplication(size: number, resolution: number): Promise<void> {
    debugPixiBoard("createApplication start", { size, resolution });
    const { Application, Container } = await import("pixi.js");
    const app = new Application();

    debugPixiBoard("createApplication app:init:start", { size, resolution });
    await app.init({
      width: size,
      height: size,
      backgroundColor: BOARD_BACKGROUND_COLOR,
      antialias: false,
      autoDensity: true,
      autoStart: false,
      preference: "webgl",
      resolution,
      roundPixels: true
    });
    debugPixiBoard("createApplication app:init:done");

    if (this.disposed) {
      app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true, texture: true, textureSource: true });
      return;
    }

    const root = new Container();
    app.stage.addChild(root);
    app.canvas.className = "board-pixi-canvas";
    app.canvas.style.display = "block";
    app.canvas.style.width = `${size}px`;
    app.canvas.style.height = `${size}px`;

    debugPixiBoard("createApplication canvas:append", { size });
    this.parent.replaceChildren(app.canvas);
    this.canvas = app.canvas;
    this.app = app;
    this.root = root;
    this.currentResolution = resolution;
    this.applyRendererSize(size);
  }

  private destroyApplication(): void {
    debugPixiBoard("destroyApplication", { hasApp: Boolean(this.app), hasCanvas: Boolean(this.canvas) });
    const app = this.app;
    const canvas = this.canvas;
    this.app = undefined;
    this.root = undefined;
    this.canvas = undefined;
    this.cache = createInitialCache();

    if (!app) {
      if (canvas && canvas.parentElement === this.parent) {
        debugPixiBoard("parent.replaceChildren clear");
        this.parent.replaceChildren();
      }
      return;
    }

    try {
      app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true, texture: true, textureSource: true });
    } catch {
      // Pixi destroy signatures have changed across v8 minors.
    }

    if (canvas && canvas.parentElement === this.parent) {
      debugPixiBoard("parent.replaceChildren clear");
      this.parent.replaceChildren();
    }
  }

  private queueRecreate(size: number, resolution: number): void {
    debugPixiBoard("queueRecreate start", { size, resolution });
    this.queuedRecreate = { size, resolution };

    if (this.recreatePromise) {
      return;
    }

    this.recreatePromise = this.flushRecreateQueue().finally(() => {
      this.recreatePromise = null;
    });
  }

  private async flushRecreateQueue(): Promise<void> {
    debugPixiBoard("flushRecreateQueue start");
    while (!this.disposed && this.queuedRecreate) {
      const next = this.queuedRecreate;
      this.queuedRecreate = undefined;
      debugPixiBoard("recreate destroy old", next);
      this.destroyApplication();

      try {
        await this.createApplication(next.size, next.resolution);
      } catch (error) {
        debugPixiBoard("recreate failed", error);
        throw error;
      }

      if (this.latestParams) {
        debugPixiBoard("recreate update latest params", { size: next.size });
        this.update({ ...this.latestParams, boardPixelSize: next.size });
      }
    }
  }

  private applyRendererSize(size: number): void {
    if (!this.app) {
      return;
    }

    this.currentSize = size;
    this.app.renderer.resize(size, size);
    this.app.canvas.style.width = `${size}px`;
    this.app.canvas.style.height = `${size}px`;
  }
}

function renderResolutionForSize(size: number): number {
  const dpr = Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
  const desired = Math.max(1, Math.min(MAX_RENDER_RESOLUTION, dpr));
  const backingStoreCap = Math.max(1, MAX_BACKING_STORE_PIXELS / Math.max(1, size));
  const resolution = Math.max(1, Math.min(desired, backingStoreCap));

  return Math.round(resolution * 100) / 100;
}

function sanitizeSize(size: number): number {
  if (!Number.isFinite(size)) return 1;
  return Math.max(1, Math.floor(size));
}

async function waitForFonts(): Promise<"ready" | "unavailable"> {
  debugPixiBoard("fonts:wait:start");
  if (!document.fonts?.ready) {
    debugPixiBoard("fonts:wait:done");
    return "unavailable";
  }

  try {
    await document.fonts.ready;
    debugPixiBoard("fonts:wait:done");
    return "ready";
  } catch {
    // If fonts API is unavailable or rejects, Pixi can still render with fallback.
    debugPixiBoard("fonts:wait:done");
    return "unavailable";
  }
}
