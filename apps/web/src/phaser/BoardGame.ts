import type { BoardScene, RenderParams } from "./BoardScene";

export class BoardGame {
  private game?: any; // Phaser.Game
  private scene?: BoardScene;

  constructor(private readonly parent: HTMLElement, private readonly initialSize: number) {}

  async init(): Promise<void> {
    const Phaser = await import("phaser");
    const { BoardScene } = await import("./BoardScene");

    this.scene = new BoardScene();

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.parent,
      width: this.initialSize,
      height: this.initialSize,
      backgroundColor: "#080A0F",
      scale: {
        mode: Phaser.Scale.RESIZE,
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
    this.game?.destroy(true);
    this.game = undefined;
    this.scene = undefined;
  }
}
