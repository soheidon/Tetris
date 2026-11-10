import { translations } from '../i18n/translations';
import type { GameStateSnapshot, TetrominoType } from '../types/game';
import type { UserSettings } from '../types/settings';

const TETROMINO_COLORS: Record<TetrominoType, string> = {
  I: '#00f0f0', // Cyan
  O: '#f0f000', // Yellow
  T: '#a000f0', // Purple
  S: '#00f000', // Green
  Z: '#f00000', // Red
  J: '#0050f0', // Blue
  L: '#f0a000', // Orange
};

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to acquire 2D canvas context');
    }
    this.ctx = context;
  }

  public render(snapshot: GameStateSnapshot, settings: UserSettings): void {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const logicalWidth = this.canvas.width / dpr;
    const logicalHeight = this.canvas.height / dpr;
    const ctx = this.ctx;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear entire canvas in logical coordinates
    ctx.fillStyle = '#0d0d12';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // Dynamic layout sizing based on logical height & width
    const boardHeight = Math.min(logicalHeight * 0.88, 640);
    const blockSize = Math.floor(boardHeight / 20);
    const boardWidth = blockSize * 10;
    const sidePanelWidth = Math.max(140, blockSize * 4.5);

    const totalLayoutWidth = sidePanelWidth + boardWidth + sidePanelWidth + 40;
    const startX = Math.max(20, (logicalWidth - totalLayoutWidth) / 2);
    const startY = (logicalHeight - (blockSize * 20)) / 2;

    const leftPanelX = startX;
    const boardX = startX + sidePanelWidth + 20;
    const rightPanelX = boardX + boardWidth + 20;

    // 1. Left Panel: HOLD & Mode
    this.renderLeftPanel(ctx, leftPanelX, startY, sidePanelWidth, snapshot, settings, blockSize);

    // 2. Center Panel: 10x20 Board, Grid, Ghost, Active, Locked
    this.renderBoard(ctx, boardX, startY, blockSize, snapshot, settings);

    // 3. Right Panel: NEXT (5), Stats (Score, Level, Lines, Time)
    this.renderRightPanel(ctx, rightPanelX, startY, sidePanelWidth, snapshot, settings, blockSize);

    // 4. Overlays (Ready Countdown, Paused)
    this.renderOverlays(ctx, boardX, startY, boardWidth, blockSize * 20, snapshot, settings);

    ctx.restore();
  }

  private renderLeftPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    snapshot: GameStateSnapshot,
    settings: UserSettings,
    blockSize: number,
  ): void {
    const t = translations[settings.language ?? 'ja'];

    if (settings.show_hold) {
      // HOLD Box
      ctx.fillStyle = '#161622';
      ctx.strokeStyle = '#2a2a3e';
      ctx.lineWidth = 2;
      this.roundRect(ctx, x, y, w, 110, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#8e8ea0';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(t.hud.hold, x + 16, y + 26);

      if (snapshot.hold_piece) {
        ctx.save();
        if (!snapshot.can_hold) {
          ctx.globalAlpha = 0.45;
        }
        this.renderMiniPiece(ctx, snapshot.hold_piece, x + w / 2, y + 68, blockSize * 0.7);
        ctx.restore();
      }
    }

    // MODE display
    const modeY = y + 130;
    ctx.fillStyle = '#161622';
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 2;
    this.roundRect(ctx, x, modeY, w, 70, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#8e8ea0';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(t.hud.mode, x + 16, modeY + 24);

    const modeName =
      snapshot.mode === 'Marathon'
        ? t.modes.marathon.name
        : snapshot.mode === 'Sprint'
          ? t.modes.sprint.name
          : t.modes.ultra.name;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(modeName, x + 16, modeY + 50);

    // Notification Banner (Tetris / T-Spin / Combo / B2B)
    if (snapshot.last_action) {
      const notifY = modeY + 90;
      ctx.fillStyle = '#222238';
      this.roundRect(ctx, x, notifY, w, 80, 8);
      ctx.fill();

      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(snapshot.last_action.action_name, x + 12, notifY + 28);

      if (snapshot.last_action.b2b) {
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText('Back-to-Back', x + 12, notifY + 48);
      }

      if (snapshot.last_action.combo > 1) {
        ctx.fillStyle = '#ff7700';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillText(`Combo x${snapshot.last_action.combo - 1}`, x + 12, notifY + 68);
      }
    }
  }

  private renderBoard(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    blockSize: number,
    snapshot: GameStateSnapshot,
    settings: UserSettings,
  ): void {
    const bw = blockSize * 10;
    const bh = blockSize * 20;

    // Board background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(bx, by, bw, bh);

    // Grid lines
    if (settings.show_grid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 0; c <= 10; c++) {
        ctx.moveTo(bx + c * blockSize, by);
        ctx.lineTo(bx + c * blockSize, by + bh);
      }
      for (let r = 0; r <= 20; r++) {
        ctx.moveTo(bx, by + r * blockSize);
        ctx.lineTo(bx + bw, by + r * blockSize);
      }
      ctx.stroke();
    }

    // Border around board
    ctx.strokeStyle = '#383852';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    // 1. Fixed blocks
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = snapshot.board[r]?.[c];
        if (cell) {
          this.renderBlock(ctx, bx + c * blockSize, by + r * blockSize, blockSize, TETROMINO_COLORS[cell]);
        }
      }
    }

    // 2. Ghost piece
    if (settings.show_ghost && snapshot.ghost_blocks && snapshot.active_piece) {
      const color = TETROMINO_COLORS[snapshot.active_piece.piece_type];
      for (const [gx, gy] of snapshot.ghost_blocks) {
        if (gy >= 0 && gy < 20) {
          this.renderGhostBlock(ctx, bx + gx * blockSize, by + gy * blockSize, blockSize, color);
        }
      }
    }

    // 3. Active piece
    if (snapshot.active_piece) {
      const color = TETROMINO_COLORS[snapshot.active_piece.piece_type];
      for (const [ax, ay] of snapshot.active_piece.blocks) {
        if (ay >= 0 && ay < 20) {
          this.renderBlock(ctx, bx + ax * blockSize, by + ay * blockSize, blockSize, color);
        }
      }
    }
  }

  private renderRightPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    snapshot: GameStateSnapshot,
    settings: UserSettings,
    blockSize: number,
  ): void {
    let currentY = y;

    const t = translations[settings.language ?? 'ja'];

    // NEXT queue
    if (settings.show_next_queue) {
      const nextBoxHeight = 310;
      ctx.fillStyle = '#161622';
      ctx.strokeStyle = '#2a2a3e';
      ctx.lineWidth = 2;
      this.roundRect(ctx, x, currentY, w, nextBoxHeight, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#8e8ea0';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(t.hud.next, x + 16, currentY + 24);

      snapshot.next_queue.slice(0, 5).forEach((p, idx) => {
        this.renderMiniPiece(ctx, p, x + w / 2, currentY + 58 + idx * 52, blockSize * 0.55);
      });

      currentY += nextBoxHeight + 14;
    }

    // STATS Box (Score, Level, Lines, Time)
    const statsHeight = 220;
    ctx.fillStyle = '#161622';
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 2;
    this.roundRect(ctx, x, currentY, w, statsHeight, 8);
    ctx.fill();
    ctx.stroke();

    const drawStat = (label: string, value: string | number, offsetY: number) => {
      ctx.fillStyle = '#8e8ea0';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(label, x + 16, currentY + offsetY);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(String(value), x + 16, currentY + offsetY + 22);
    };

    drawStat(t.hud.score, snapshot.score.toLocaleString(), 24);
    drawStat(t.hud.level, snapshot.level, 76);
    drawStat(t.hud.lines, snapshot.lines, 128);

    const timeFormatted = this.formatTime(
      snapshot.remaining_time_ms !== null ? snapshot.remaining_time_ms : snapshot.elapsed_time_ms,
    );
    drawStat(snapshot.remaining_time_ms !== null ? t.hud.timeLeft : t.hud.time, timeFormatted, 180);
  }

  private renderOverlays(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    bw: number,
    bh: number,
    snapshot: GameStateSnapshot,
    settings: UserSettings,
  ): void {
    const t = translations[settings.language ?? 'ja'];

    if (snapshot.status === 'Ready' && snapshot.countdown_seconds !== null) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(bx, by, bw, bh);

      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 64px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(snapshot.countdown_seconds), bx + bw / 2, by + bh / 2);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    } else if (snapshot.status === 'Paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(bx, by, bw, bh);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.hud.paused, bx + bw / 2, by + bh / 2);
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = '#a0a0b0';
      ctx.fillText(t.hud.escToPause, bx + bw / 2, by + bh / 2 + 40);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }
  }

  private renderBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

    // Bevel highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x + 1, y + 1, size - 2, 2);
    ctx.fillRect(x + 1, y + 1, 2, size - 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(x + 1, y + size - 3, size - 2, 2);
    ctx.fillRect(x + size - 3, y + 1, 2, size - 2);
  }

  private renderGhostBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
    ctx.globalAlpha = 1.0;
  }

  private renderMiniPiece(
    ctx: CanvasRenderingContext2D,
    piece: TetrominoType,
    centerX: number,
    centerY: number,
    miniSize: number,
  ): void {
    const color = TETROMINO_COLORS[piece];
    const offsets: Record<TetrominoType, [number, number][]> = {
      I: [[-1.5, -0.5], [-0.5, -0.5], [0.5, -0.5], [1.5, -0.5]],
      O: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]],
      T: [[0, -0.5], [-1, 0.5], [0, 0.5], [1, 0.5]],
      S: [[0, -0.5], [1, -0.5], [-1, 0.5], [0, 0.5]],
      Z: [[-1, -0.5], [0, -0.5], [0, 0.5], [1, 0.5]],
      J: [[-1, -0.5], [-1, 0.5], [0, 0.5], [1, 0.5]],
      L: [[1, -0.5], [-1, 0.5], [0, 0.5], [1, 0.5]],
    };

    for (const [ox, oy] of offsets[piece]) {
      const bx = centerX + ox * miniSize - miniSize / 2;
      const by = centerY + oy * miniSize - miniSize / 2;
      this.renderBlock(ctx, bx, by, miniSize, color);
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private formatTime(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const centis = Math.floor((ms % 1000) / 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  }
}
