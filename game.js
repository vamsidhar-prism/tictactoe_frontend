// frontend/game.js

function playSound(id) {
  const audio = document.getElementById(id);
  if (!audio) return;

  audio.currentTime = 0;
  audio.play().catch(() => { });
}


class TicTacToeClient {
  constructor() {
    this.socket = null;
    this.user = null;
    this.roomId = null;
    this.playerSymbol = null;
    this.board = Array(9).fill(null);
    this.currentTurnSymbol = "X";
    this.gameOver = false;

    this.cacheDom();
    this.setupDomListeners();
    // this.updatePlayerNameLabel(); // Will be called after login
    // this.connectToServer(); // Will be called after login
  }

  createGuestUser() {
    return {
      userId: "user_" + Math.random().toString(36).slice(2, 10),
      username: "Player-" + Math.floor(1000 + Math.random() * 9000),
    };
  }

  cacheDom() {
    this.createRoomBtn = document.getElementById("createRoomBtn");
    this.joinRoomBtn = document.getElementById("joinRoomBtn");
    this.roomInput = document.getElementById("roomInput");
    this.roomCodeInput = document.getElementById("roomCodeInput");
    this.joinWithCodeBtn = document.getElementById("joinWithCodeBtn");
    this.cancelJoinBtn = document.getElementById("cancelJoinBtn");

    this.loginModal = document.getElementById("loginModal");
    this.usernameInput = document.getElementById("usernameInput");
    this.loginBtn = document.getElementById("loginBtn");

    this.playerNameEl = document.getElementById("playerName");
    this.currentRoomLabel = document.getElementById("currentRoomLabel");

    this.waitingRoom = document.getElementById("waitingRoom");
    this.roomCodeEl = document.getElementById("roomCode");

    this.gameBoardContainer = document.getElementById("gameBoardContainer");
    this.gameBoard = document.getElementById("gameBoard");
    this.currentPlayerText = document.getElementById("currentPlayerText");
    this.gameStatus = document.getElementById("gameStatus");
    this.playAgainBtn = document.getElementById("playAgainBtn");
    this.leaveRoomBtn = document.getElementById("leaveRoomBtn");

    this.gameOverEl = document.getElementById("gameOver");
    this.gameOverTitle = document.getElementById("gameOverTitle");
    this.gameOverMessage = document.getElementById("gameOverMessage");
    this.playAgainFromGameOverBtn = document.getElementById("playAgainFromGameOverBtn");
    this.backToLobbyBtn = document.getElementById("backToLobbyBtn");

    this.notifications = document.getElementById("notifications");
  }

  setupDomListeners() {
    this.createRoomBtn.addEventListener("click", () => this.createRoom());
    this.joinRoomBtn.addEventListener("click", () => this.showJoinInput());
    this.joinWithCodeBtn.addEventListener("click", () => this.joinRoom());
    this.cancelJoinBtn.addEventListener("click", () => this.hideJoinInput());

    this.roomCodeInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.joinRoom();
    });

    this.loginBtn.addEventListener("click", () => this.handleLogin());
    this.usernameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.handleLogin();
    });

    this.playAgainBtn.addEventListener("click", () => this.requestRematch());
    this.playAgainFromGameOverBtn.addEventListener("click", () => this.requestRematch());
    this.leaveRoomBtn.addEventListener("click", () => this.leaveRoom());
    this.backToLobbyBtn.addEventListener("click", () => this.leaveRoom());
  }

  updatePlayerNameLabel() {
    this.playerNameEl.textContent = this.user.username;
  }

  connectToServer() {
    const wsUrl = window.WEBSOCKET_URL;
    this.socket = io(wsUrl, { transports: ["websocket", "polling"] });

    this.socket.on("connect", () => {
      this.showNotification("Connected to server", "success");
    });

    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on("roomCreated", (data) => this.handleRoomJoined(data));
    this.socket.on("roomJoined", (data) => this.handleRoomJoined(data));

    this.socket.on("roomUpdate", ({ roomId, status }) => {
      if (roomId !== this.roomId) return;
      if (status === "waiting") this.showWaitingRoom();
    });

    this.socket.on("gameStarted", ({ roomId, board, currentTurnSymbol }) => {
      if (roomId !== this.roomId) return;
      this.board = board;
      this.currentTurnSymbol = currentTurnSymbol;
      this.gameOver = false;
      this.resetVisuals();
      this.showGameBoard();
      this.renderBoard();
      this.updateTurnText();
    });

    this.socket.on("moveMade", ({ roomId, board, currentTurnSymbol }) => {
      if (roomId !== this.roomId) return;
      this.board = board;
      this.currentTurnSymbol = currentTurnSymbol;
      this.renderBoard();
      this.updateTurnText();
    });

    this.socket.on("gameOver", ({ roomId, board, winnerSymbol, isDraw }) => {
      if (roomId !== this.roomId) return;
      this.board = board;
      this.gameOver = true;
      this.renderBoard();
      this.handleGameOver(winnerSymbol, isDraw);
    });

    this.socket.on("gameReset", ({ roomId, board, currentTurnSymbol }) => {
      if (roomId !== this.roomId) return;
      this.board = board;
      this.currentTurnSymbol = currentTurnSymbol;
      this.gameOver = false;
      this.resetVisuals();
      this.showGameBoard();
      this.renderBoard();
      this.updateTurnText();
      this.showNotification("New round started!", "info");
    });
  }

  handleRoomJoined({ roomId, playerSymbol }) {
    this.roomId = roomId;
    this.playerSymbol = playerSymbol;
    this.board = Array(9).fill(null);
    this.gameOver = false;
    this.updateRoomLabels();
    this.showWaitingRoom();
    this.showNotification(`Joined room: ${roomId}`, "success");
  }

  resetVisuals() {
    document.body.classList.remove("shake-hard", "gloomy");
    document.getElementById("gameBoard").classList.remove("glitch-active");
    this.playAgainFromGameOverBtn.classList.remove("pulse-btn");
    document.querySelectorAll(".knife-slash").forEach((el) => el.remove());
    // Remove all temporary effects
    document.querySelectorAll(".rain-drop, .sad-emoji, .firework-particle, .balloon, .confetti").forEach(el => el.remove());

    this.gameOverEl.style.display = "none";
    this.gameOverTitle.className = "";
  }

  updateRoomLabels() {
    this.currentRoomLabel.textContent = this.roomId || "None";
    this.roomCodeEl.textContent = this.roomId || "";
  }

  showJoinInput() {
    this.roomInput.classList.remove("hidden");
    this.roomCodeInput.focus();
  }

  hideJoinInput() {
    this.roomInput.classList.add("hidden");
    this.roomCodeInput.value = "";
  }

  showWaitingRoom() {
    this.waitingRoom.style.display = "block";
    this.gameBoardContainer.style.display = "none";
    this.gameOverEl.style.display = "none";
  }

  showGameBoard() {
    this.waitingRoom.style.display = "none";
    this.gameBoardContainer.style.display = "block";
    this.createBoardCellsIfNeeded();
  }

  createBoardCellsIfNeeded() {
    if (this.gameBoard.children.length === 9) return;
    this.gameBoard.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.index = i;
      cell.addEventListener("click", () => this.handleCellClick(i));
      this.gameBoard.appendChild(cell);
    }
  }

  renderBoard() {
    const cells = this.gameBoard.querySelectorAll(".cell");
    this.board.forEach((val, i) => {
      const cell = cells[i];
      cell.textContent = val || "";
      cell.className = "cell";
      if (val) cell.classList.add("occupied", val.toLowerCase());
    });
  }

  updateTurnText() {
    if (this.gameOver) {
      this.currentPlayerText.textContent = "Game Over";
      this.currentPlayerText.style.color = "#2d3436";
      return;
    }
    if (this.currentTurnSymbol === this.playerSymbol) {
      this.currentPlayerText.textContent = "Your turn";
      this.currentPlayerText.style.color = "#0984e3";
    } else {
      this.currentPlayerText.textContent = "Opponent's turn";
      this.currentPlayerText.style.color = "#ff4757";
    }
  }

  // --- GAME OVER LOGIC ---
  handleGameOver(winnerSymbol, isDraw) {
    let title = "Draw!";
    let msg = "No winner this time.";

    if (!isDraw) {
      if (winnerSymbol === this.playerSymbol) {
        // PLAYER WON
        title = "YOU WON!";
        msg = "Legendary Performance!";
        this.gameOverTitle.className = "win-title";
        playSound("winSound");
        triggerWinEffects();
      } else {
        // PLAYER LOST
        title = "DEFEATED";
        msg = "Don't be sad! Try again one more time?";
        this.gameOverTitle.className = "lose-title";
        this.playAgainFromGameOverBtn.classList.add("pulse-btn");
        playSound("loseSound");
        triggerLossEffects();
      }
    } else {
      this.gameOverTitle.className = "lose-title";
    }

    if (!isDraw && winnerSymbol) {
      const winningCombo = this.getWinningCombination(this.board, winnerSymbol);

      if (winningCombo) {
        setTimeout(() => {
          playSound("knifeSound");
          this.drawKnifeSlash(winningCombo);
          document.body.classList.add("shake-hard");
        }, 200);
      }
    }


    setTimeout(() => {
      this.gameOverTitle.textContent = title;
      this.gameOverMessage.textContent = msg;
      this.gameOverEl.style.display = "flex";
    }, 1800);
  }

  getWinningCombination(board, symbol) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    return lines.find(line => line.every(index => board[index] === symbol));
  }

  // ===========================================
  //  REVERTED: ORIGINAL STRIKE LOGIC + LENGTH FIX
  // ===========================================
  drawKnifeSlash(indices) {
    const boardEl = document.getElementById("gameBoard");
    const slash = document.createElement("div");
    slash.className = "knife-slash";

    const [a, b, c] = indices;

    // Original coordinate logic
    let top = 0, left = 0, width = "100%", rotate = 0, origin = "left center";

    // ROWS
    if (a === 0 && c === 2) { top = "16.5%"; left = "0"; }
    else if (a === 3 && c === 5) { top = "50%"; left = "0"; }
    else if (a === 6 && c === 8) { top = "83.5%"; left = "0"; }

    // COLUMNS
    else if (a === 0 && c === 6) { left = "16.5%"; top = "0"; width = "100%"; rotate = 90; origin = "left top"; }
    else if (a === 1 && c === 7) { left = "50%"; top = "0"; width = "100%"; rotate = 90; origin = "left top"; }
    else if (a === 2 && c === 8) { left = "83.5%"; top = "0"; width = "100%"; rotate = 90; origin = "left top"; }

    // DIAGONALS
    // Fix: Increased width to 155% and added negative offset to cut through corners
    else if (a === 0 && c === 8) {
      top = "65px"; left = "55px"; width = "155%"; rotate = 45; origin = "top left";
    }
    else if (a === 2 && c === 6) {
      top = "45px";
      left = "calc(100% - 55px)";
      width = "155%";
      rotate = 135;
      origin = "top left";
    }

    slash.style.top = top;
    slash.style.left = left;
    slash.style.width = width;
    slash.style.transform = `rotate(${rotate}deg)`;
    slash.style.transformOrigin = origin;

    boardEl.appendChild(slash);
  }

  // --- ACTIONS ---
  createRoom() { this.socket.emit("createRoom", { username: this.user.username }); }
  joinRoom() {
    const roomId = this.roomCodeInput.value.trim().toUpperCase();
    if (!roomId) { this.showNotification("Enter code!", "warning"); return; }
    this.socket.emit("joinRoom", { roomId, username: this.user.username });
    this.hideJoinInput();
  }
  handleCellClick(index) {
    if (!this.roomId || this.gameOver) return;
    if (this.currentTurnSymbol !== this.playerSymbol) { this.showNotification("Not your turn", "warning"); return; }
    if (this.board[index] !== null) { this.showNotification("Taken!", "warning"); return; }
    this.socket.emit("makeMove", { roomId: this.roomId, index });
  }
  requestRematch() { if (!this.roomId) return; this.socket.emit("requestRematch", { roomId: this.roomId }); }
  leaveRoom() { if (this.roomId) { this.socket.emit("leaveRoom", { roomId: this.roomId }); } window.location.reload(); }

  showNotification(message, type = "info") {
    const el = document.createElement("div");
    el.className = `notification ${type}`;
    el.innerHTML = `<span>${message}</span>`;
    this.notifications.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  async handleLogin() {
    const username = this.usernameInput.value.trim();
    if (!username) {
      this.showNotification("Please enter a name", "warning");
      return;
    }

    try {
      const res = await fetch(`${window.WEBSOCKET_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!res.ok) throw new Error("Registration failed");

      const data = await res.json();
      this.user = data;

      this.loginModal.classList.add("hidden");
      this.updatePlayerNameLabel();
      this.connectToServer();
      this.showNotification(`Welcome, ${this.user.username}!`, "success");

    } catch (err) {
      console.error(err);
      this.showNotification("Login failed. Try again.", "error");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => { new TicTacToeClient(); });

// ===========================================
//  VFX ENGINE (BOOSTED EFFECTS)
// ===========================================

function triggerWinEffects() {
  launch3DBalloons();
  launchPhysicsFireworks();
  launch3DConfetti();
}

function triggerLossEffects() {
  // Add gloomy class
  document.body.classList.add("gloomy");

  // Activate Glitch effect (The board jitters)
  const board = document.getElementById("gameBoard");
  board.classList.add("glitch-active");

  setTimeout(() => {
    document.body.classList.remove("gloomy");
    board.classList.remove("glitch-active");
  }, 4000);

  launchRain();
  launchSadEmojis(); // <--- Now calls the Massive version
  triggerThunder();
}

// --- WIN EFFECTS (INTENSIFIED) ---
function launch3DBalloons() {
  const container = document.getElementById("animationsContainer");
  const colors = ["#e84393", "#0984e3", "#00b894", "#fdcb6e", "#6c5ce7", "#ff7675"];

  // INCREASED: 60 balloons (was 40)
  for (let i = 0; i < 60; i++) {
    const b = document.createElement("div");
    b.className = "balloon";
    b.style.left = Math.random() * 95 + "vw";
    b.style.setProperty('--b-color', colors[Math.floor(Math.random() * colors.length)]);
    b.style.animationDuration = (2 + Math.random() * 2) + "s";
    b.style.animationDelay = Math.random() * 1 + "s";
    container.appendChild(b);
    setTimeout(() => b.remove(), 4000);
  }
}

function launchPhysicsFireworks() {
  // INCREASED: 20 Explosions (was 10)
  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      spawnExplosion(Math.random() * window.innerWidth, Math.random() * (window.innerHeight * 0.7));
    }, i * 250);
  }
}

function spawnExplosion(x, y) {
  const container = document.getElementById("animationsContainer");
  const colors = ["#FF0099", "#00FFFF", "#FFFF00", "#33FF00", "#FF6600", "#9D00FF", "#ffffff"];
  const color = colors[Math.floor(Math.random() * colors.length)];

  // INCREASED: 80 particles per explosion (was 50)
  for (let k = 0; k < 80; k++) {
    const p = document.createElement("div");
    p.className = "firework-particle";
    p.style.color = color;
    p.style.left = x + "px"; p.style.top = y + "px";

    const angle = Math.random() * Math.PI * 2;
    const velocity = 60 + Math.random() * 220;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity + 200;
    p.style.setProperty("--tx", `${tx}px`); p.style.setProperty("--ty", `${ty}px`);

    container.appendChild(p);
    setTimeout(() => p.remove(), 1600);
  }
}

function launch3DConfetti() {
  const container = document.getElementById("animationsContainer");
  const colors = ["#d63031", "#e17055", "#0984e3", "#6c5ce7", "#00b894", "#fdcb6e"];

  // INCREASED: 300 Confetti pieces (was 100)
  for (let i = 0; i < 300; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.setProperty('--c-color', colors[Math.floor(Math.random() * colors.length)]);
    c.style.animationDuration = (1.5 + Math.random() * 2.5) + "s";
    container.appendChild(c);
    setTimeout(() => c.remove(), 4000);
  }
}

// --- LOSE EFFECTS (INTENSIFIED) ---
function launchRain() {
  const container = document.getElementById("animationsContainer");
  // INCREASED: 200 Rain drops (was 100)
  for (let i = 0; i < 200; i++) {
    const r = document.createElement("div");
    r.className = "rain-drop";
    r.style.left = Math.random() * 100 + "vw";
    r.style.animationDuration = (0.5 + Math.random() * 0.5) + "s";
    container.appendChild(r);
    setTimeout(() => r.remove(), 3000);
  }
}

function launchSadEmojis() {
  const container = document.getElementById("animationsContainer");

  // ADDED: More "Defeat" specific icons (Clown, Flag, Chart Down)
  const emojis = ["😭", "😢", "💔", "🌧️", "😩", "🥀", "💀", "👎", "🤡", "📉", "🏳️", "🫣"];

  // INCREASED: From 60 -> 200 (Total flood of emojis)
  for (let i = 0; i < 200; i++) {
    const e = document.createElement("div");
    e.className = "sad-emoji";
    e.textContent = emojis[Math.floor(Math.random() * emojis.length)];

    // Spread across the entire width
    e.style.left = Math.random() * 100 + "vw";

    // VARIETY: Some are huge (6rem), some are small (2rem)
    e.style.fontSize = (2 + Math.random() * 4) + "rem";

    // TIMING: Fall at different speeds (1s to 4s)
    e.style.animationDuration = (1.5 + Math.random() * 2.5) + "s";

    // DELAY: Stagger them so they don't all appear at once
    e.style.animationDelay = Math.random() * 2 + "s";

    container.appendChild(e);

    // Cleanup
    setTimeout(() => e.remove(), 5000);
  }
}

function triggerThunder() {
  const flash = document.createElement("div");
  flash.className = "thunder-flash";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 250);

  setTimeout(() => {
    const flash2 = document.createElement("div");
    flash2.className = "thunder-flash";
    document.body.appendChild(flash2);
    setTimeout(() => flash2.remove(), 250);
  }, 400);
}