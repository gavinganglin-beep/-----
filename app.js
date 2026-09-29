/* 页面控制模块：连接游戏规则、Canvas 渲染、按钮与键盘输入。 */
(function () {
  "use strict";

  const game = new TetrisLogic.TetrisGame();
  const renderer = new TetrisRenderer(
    document.getElementById("board"),
    document.getElementById("next"),
    document.getElementById("hold")
  );
  const overlay = document.getElementById("overlay");
  let animationId = 0;
  let lastTime = 0;
  let recordCache = { score: 0, lines: 0 };

  function readRecord() {
    try {
      return {
        score: Number(localStorage.getItem("blocks-best") || 0),
        lines: Number(localStorage.getItem("blocks-best-lines") || 0)
      };
    } catch {
      return { score: 0, lines: 0 };
    }
  }

  function saveRecord(snapshot) {
    if (snapshot.score > recordCache.score) {
      recordCache = { score: snapshot.score, lines: snapshot.lines };
      try {
        localStorage.setItem("blocks-best", String(snapshot.score));
        localStorage.setItem("blocks-best-lines", String(snapshot.lines));
      } catch {
        // 隐私模式可能禁用存储；此时仍可正常完成当前局游戏。
      }
    }
    return recordCache;
  }

  function setOverlay(title, text, buttonText) {
    document.getElementById("overlayTitle").textContent = title;
    document.getElementById("overlayText").textContent = text;
    document.getElementById("overlayButton").textContent = buttonText;
    overlay.hidden = false;
  }

  function updateView() {
    // 页面只消费快照；分数展示、状态提示与画布不直接改游戏规则数据。
    const snapshot = game.snapshot();
    const record = saveRecord(snapshot);
    renderer.render(snapshot);

    document.getElementById("score").textContent = String(snapshot.score).padStart(6, "0");
    document.getElementById("level").textContent = String(snapshot.level).padStart(2, "0");
    document.getElementById("lines").textContent = String(snapshot.lines).padStart(2, "0");
    document.getElementById("best").textContent = String(record.score).padStart(6, "0");
    document.getElementById("bestLines").textContent = String(record.lines);

    const statusText = document.getElementById("statusText");
    const statusDot = document.getElementById("statusDot");
    const states = {
      ready: ["READY TO PLAY", "var(--lime)"],
      playing: ["IN PLAY", "var(--lime)"],
      paused: ["PAUSED", "var(--pink)"],
      over: ["GAME OVER", "var(--pink)"]
    };
    [statusText.textContent, statusDot.style.background] = states[snapshot.state];

    if (snapshot.state === "playing") overlay.hidden = true;
    if (snapshot.state === "ready") setOverlay("准备好了吗？", "把方块排成完整的一行。", "开始游戏");
    if (snapshot.state === "paused") setOverlay("暂停一下", "休息好了，继续叠高。", "继续游戏");
    if (snapshot.state === "over") {
      setOverlay("堆满啦！", `最终得分 ${String(snapshot.score).padStart(6, "0")} · 清除 ${snapshot.lines} 行`, "再玩一局");
    }
    return snapshot;
  }

  function frame(time) {
    if (game.state !== "playing") return;
    // 恢复游戏时首帧 delta 设为 0，避免把暂停时间计入下落。
    const delta = lastTime ? time - lastTime : 0;
    lastTime = time;
    game.tick(delta);
    updateView();
    if (game.state === "playing") animationId = requestAnimationFrame(frame);
  }

  function startGame() {
    cancelAnimationFrame(animationId);
    game.start();
    lastTime = 0;
    updateView();
    animationId = requestAnimationFrame(frame);
  }

  function togglePause() {
    if (game.state !== "playing" && game.state !== "paused") return;
    game.pause();
    if (game.state === "playing") {
      lastTime = 0;
      animationId = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(animationId);
    }
    updateView();
  }

  function perform(action) {
    // 将设备输入转换成规则层提供的动作，再统一刷新页面视图。
    if (action === "left") game.move(-1, 0);
    if (action === "right") game.move(1, 0);
    if (action === "down") game.softDrop();
    if (action === "rotate") game.rotate();
    if (action === "drop") game.hardDrop();
    if (action === "hold") game.hold();
    updateView();
    if (game.state === "playing" && !animationId) animationId = requestAnimationFrame(frame);
  }

  function handleStartOrResume() {
    if (game.state === "paused") togglePause();
    else startGame();
  }

  document.addEventListener("keydown", event => {
    const actions = {
      ArrowLeft: "left", ArrowRight: "right", ArrowDown: "down",
      ArrowUp: "down", " ": "rotate", c: "hold", C: "hold"
    };
    if (actions[event.key]) {
      event.preventDefault();
      perform(actions[event.key]);
    } else if (event.key.toLowerCase() === "p") {
      togglePause();
    } else if (event.key.toLowerCase() === "r") {
      startGame();
    } else if (event.key === "Enter" && game.state !== "playing") {
      handleStartOrResume();
    }
  });

  document.getElementById("startButton").addEventListener("click", handleStartOrResume);
  document.getElementById("overlayButton").addEventListener("click", handleStartOrResume);
  document.getElementById("pauseButton").addEventListener("click", togglePause);
  document.getElementById("restartButton").addEventListener("click", startGame);
  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      perform(button.dataset.action);
    });
  });

  window.addEventListener("resize", () => {
    renderer.resize();
    updateView();
  });

  recordCache = readRecord();
  updateView();
})();