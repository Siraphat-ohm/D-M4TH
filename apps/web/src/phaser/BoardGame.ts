import type { RenderParams, BoardScene } from "./BoardScene";

export class BoardGame {
  private game?: import("phaser").Game;
  private scene?: BoardScene;

  constructor(private readonly parent: HTMLElement, private readonly initialSize: number) {}

  async init(): Promise<void> {
    const Phaser = await import("phaser");
    const { createBoardSceneClass } = await import("./BoardScene");

    const SceneClass = await createBoardSceneClass();
    this.scene = new SceneClass() as BoardScene;

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.parent,
      width: this.initialSize,
      height: this.initialSize,
      backgroundColor: "#080A0F",
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.NONE,
        width: this.initialSize,
        height: this.initialSize
      },
      scene: [this.scene]
    });
  }

  update(params: RenderParams): void {
    this.scene?.updateBoard(params);
  }

  resize(size: number): void {
    this.scene?.resize(size, size);
  }

  destroy(): void {
    this.scene?.clear();
    this.game?.destroy(true);
    this.game = undefined;
    this.scene = undefined;
  }
}
