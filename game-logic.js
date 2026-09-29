/* 游戏规则模块：不读取或修改 DOM，只管理棋盘状态与规则。 */
(function (global) {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };

  function createGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function copyMatrix(matrix) {
    return matrix.map(row => row.slice());
  }

  function rotateMatrix(matrix) {
    return matrix[0].map((_, column) => matrix.map(row => row[column]).reverse());
  }

  class TetrisGame {
    constructor(random = Math.random) {
      this.random = random;
      this.state = "ready";
      this.start();
      this.state = "ready";
    }

    start() {
      // 每局重新创建棋盘和计分状态，但保留注入的随机数来源以便测试。
      this.grid = createGrid();
      this.bag = [];
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.heldType = null;
      this.canHold = true;
      this.dropCounter = 0;
      this.current = this.takePiece();
      this.next = this.takePiece();
      this.state = "playing";
      if (this.collides(this.current)) this.state = "over";
    }

    refillBag() {
      this.bag = Object.keys(SHAPES);
      // Fisher-Yates 洗牌保证每组七种方块各出现一次。
      for (let index = this.bag.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(this.random() * (index + 1));
        [this.bag[index], this.bag[swapIndex]] = [this.bag[swapIndex], this.bag[index]];
      }
    }

    takePiece() {
      if (!this.bag.length) this.refillBag();
      const type = this.bag.pop();
      const matrix = copyMatrix(SHAPES[type]);
      // 深拷贝矩阵，避免旋转活动方块时改写方块的基础定义。
      return { type, matrix, x: Math.floor((COLS - matrix[0].length) / 2), y: -1 };
    }

    collides(candidate) {
      return candidate.matrix.some((row, rowIndex) => row.some((filled, columnIndex) => {
        if (!filled) return false;
        const x = candidate.x + columnIndex;
        const y = candidate.y + rowIndex;
        return x < 0 || x >= COLS || y >= ROWS || (y >= 0 && this.grid[y][x] !== null);
      }));
    }

    move(dx, dy) {
      if (this.state !== "playing") return false;
      const candidate = { ...this.current, x: this.current.x + dx, y: this.current.y + dy };
      if (this.collides(candidate)) return false;
      this.current = candidate;
      return true;
    }

    rotate() {
      if (this.state !== "playing") return false;
      const original = this.current.matrix;
      this.current.matrix = rotateMatrix(original);
      // 靠墙旋转失败时逐步侧移，找不到合法位置则还原矩阵。
      for (const offset of [0, -1, 1, -2, 2]) {
        this.current.x += offset;
        if (!this.collides(this.current)) return true;
        this.current.x -= offset;
      }
      this.current.matrix = original;
      return false;
    }

    lockPiece() {
      this.current.matrix.forEach((row, rowIndex) => row.forEach((filled, columnIndex) => {
        const y = this.current.y + rowIndex;
        if (filled && y >= 0) this.grid[y][this.current.x + columnIndex] = this.current.type;
      }));

      // 移除完整行并在顶部补空行；消行奖励随等级倍增。
      const remainingRows = this.grid.filter(row => !row.every(Boolean));
      const cleared = ROWS - remainingRows.length;
      if (cleared) {
        this.grid = Array.from({ length: cleared }, () => Array(COLS).fill(null)).concat(remainingRows);
        this.score += [0, 100, 300, 500, 800][cleared] * this.level;
        this.lines += cleared;
        this.level = Math.floor(this.lines / 10) + 1;
      }

      if (this.current.y < 0) {
        this.state = "over";
        return;
      }
      // 取出下一枚后立即检查出生位置，堵住顶部也会结束游戏。
      this.current = this.next;
      this.next = this.takePiece();
      this.canHold = true;
      if (this.collides(this.current)) this.state = "over";
    }

    softDrop() {
      if (this.move(0, 1)) {
        this.score += 1;
        this.dropCounter = 0;
        return true;
      }
      this.lockPiece();
      this.dropCounter = 0;
      return false;
    }

    hardDrop() {
      if (this.state !== "playing") return;
      let distance = 0;
      while (this.move(0, 1)) distance++;
      this.score += distance * 2;
      this.lockPiece();
    }

    hold() {
      if (this.state !== "playing" || !this.canHold) return false;
      const currentType = this.current.type;
      if (this.heldType === null) {
        this.heldType = currentType;
        this.current = this.next;
        this.next = this.takePiece();
      } else {
        const replacementType = this.heldType;
        this.heldType = currentType;
        const matrix = copyMatrix(SHAPES[replacementType]);
        this.current = { type: replacementType, matrix, x: Math.floor((COLS - matrix[0].length) / 2), y: -1 };
      }
      this.canHold = false;
      return true;
    }

    tick(delta) {
      if (this.state !== "playing") return;
      // 累积实际帧时长，而非假设设备始终以固定帧率运行。
      this.dropCounter += delta;
      const interval = Math.max(90, 850 - (this.level - 1) * 65);
      if (this.dropCounter >= interval) this.softDrop();
    }

    pause() {
      if (this.state === "playing") this.state = "paused";
      else if (this.state === "paused") this.state = "playing";
    }

    getGhostY() {
      const ghost = { ...this.current, y: this.current.y };
      while (!this.collides({ ...ghost, y: ghost.y + 1 })) ghost.y++;
      return ghost.y;
    }

    snapshot() {
      // 返回副本，渲染器可以读取数据但不能意外修改内部棋盘。
      return {
        cols: COLS,
        rows: ROWS,
        grid: this.grid.map(row => row.slice()),
        current: { ...this.current, matrix: copyMatrix(this.current.matrix) },
        nextType: this.next.type,
        heldType: this.heldType,
        ghostY: this.getGhostY(),
        score: this.score,
        lines: this.lines,
        level: this.level,
        state: this.state
      };
    }
  }

  global.TetrisLogic = { TetrisGame, SHAPES, COLS, ROWS };
})(window);