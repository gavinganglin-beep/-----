/* Canvas 渲染模块：只读取游戏快照，不参与规则计算或状态修改。 */
(function (global) {
  "use strict";

  const COLORS = { I: "#5fe2d0", O: "#f6d65b", T: "#bd91ff", S: "#9de45b", Z: "#ff6682", J: "#71a8ff", L: "#ffab62" };

  class TetrisRenderer {
    constructor(boardCanvas, nextCanvas, holdCanvas) {
      this.boardCanvas = boardCanvas;
      this.nextCanvas = nextCanvas;
      this.holdCanvas = holdCanvas;
      this.boardContext = boardCanvas.getContext("2d");
      this.resize();
    }

    prepareCanvas(canvas, width, height) {
      // 按设备像素比设置绘图缓冲区，避免高分屏 Canvas 发虚。
      const ratio = global.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const context = canvas.getContext("2d");
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      return context;
    }

    resize() {
      const bounds = this.boardCanvas.getBoundingClientRect();
      this.cellSize = bounds.width / TetrisLogic.COLS;
      this.boardContext = this.prepareCanvas(this.boardCanvas, bounds.width, bounds.height);
    }

    drawBlock(context, x, y, size, color, ghost = false) {
      context.globalAlpha = ghost ? 0.22 : 1;
      context.fillStyle = color;
      context.fillRect(x + 1, y + 1, size - 2, size - 2);
      if (!ghost) {
        context.fillStyle = "#ffffff38";
        context.fillRect(x + 2, y + 2, size - 4, Math.max(2, size * 0.12));
        context.fillStyle = "#00000028";
        context.fillRect(x + 2, y + size - Math.max(4, size * 0.16), size - 4, Math.max(2, size * 0.12));
      }
      context.globalAlpha = 1;
    }

    drawBoard(snapshot) {
      const { cols, rows, grid, current, ghostY } = snapshot;
      const size = this.cellSize;
      const context = this.boardContext;
      context.clearRect(0, 0, size * cols, size * rows);
      context.fillStyle = "#171a15";
      context.fillRect(0, 0, size * cols, size * rows);
      context.strokeStyle = "#ffffff09";
      context.lineWidth = 1;
      for (let x = 0; x <= cols; x++) {
        context.beginPath(); context.moveTo(x * size + 0.5, 0); context.lineTo(x * size + 0.5, size * rows); context.stroke();
      }
      for (let y = 0; y <= rows; y++) {
        context.beginPath(); context.moveTo(0, y * size + 0.5); context.lineTo(size * cols, y * size + 0.5); context.stroke();
      }
      // 绘制顺序为网格、已锁定方块、落点提示、活动方块。
      grid.forEach((row, y) => row.forEach((type, x) => {
        if (type) this.drawBlock(context, x * size, y * size, size, COLORS[type]);
      }));
      current.matrix.forEach((row, y) => row.forEach((filled, x) => {
        if (!filled) return;
        const boardX = current.x + x;
        const boardY = current.y + y;
        const landingY = ghostY + y;
        if (landingY >= 0) this.drawBlock(context, boardX * size, landingY * size, size, COLORS[current.type], true);
        if (boardY >= 0) this.drawBlock(context, boardX * size, boardY * size, size, COLORS[current.type]);
      }));
    }

    drawPreview(canvas, type) {
      const width = canvas.clientWidth || 150;
      const height = canvas.clientHeight || 80;
      const context = this.prepareCanvas(canvas, width, height);
      context.clearRect(0, 0, width, height);
      if (!type) return;
      const matrix = TetrisLogic.SHAPES[type];
      const size = Math.min(22, Math.floor(Math.min((width - 12) / matrix[0].length, (height - 8) / matrix.length)));
      const offsetX = (width - matrix[0].length * size) / 2;
      const offsetY = (height - matrix.length * size) / 2;
      matrix.forEach((row, y) => row.forEach((filled, x) => {
        if (filled) this.drawBlock(context, offsetX + x * size, offsetY + y * size, size, COLORS[type]);
      }));
    }

    render(snapshot) {
      this.drawBoard(snapshot);
      this.drawPreview(this.nextCanvas, snapshot.nextType);
      this.drawPreview(this.holdCanvas, snapshot.heldType);
    }
  }

  global.TetrisRenderer = TetrisRenderer;
})(window);