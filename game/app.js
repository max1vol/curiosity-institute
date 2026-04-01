const WORLD = {
  width: 1100,
  height: 640,
};

const refs = {
  startButton: document.querySelector("#start-button"),
  openArchiveButton: document.querySelector("#open-archive-button"),
  themeGrid: document.querySelector("#theme-grid"),
  themeHeroImage: document.querySelector("#theme-hero-image"),
  themeRenderStrip: document.querySelector("#theme-render-strip"),
  stageTitle: document.querySelector("#stage-title"),
  museumWorld: document.querySelector("#museum-world"),
  objectiveText: document.querySelector("#objective-text"),
  objectivePills: document.querySelector("#objective-pills"),
  statsGrid: document.querySelector("#stats-grid"),
  roomTitle: document.querySelector("#room-title"),
  roomImage: document.querySelector("#room-image"),
  roomCopy: document.querySelector("#room-copy"),
  roomRenderStrip: document.querySelector("#room-render-strip"),
  roomActions: document.querySelector("#room-actions"),
  trickList: document.querySelector("#trick-list"),
  activityLog: document.querySelector("#activity-log"),
  archiveStrip: document.querySelector("#archive-strip"),
  modalRoot: document.querySelector("#modal-root"),
  phoneIndicator: document.querySelector("#phone-indicator"),
  hotlineButton: document.querySelector("#open-hotline-button"),
  matchPairsButton: document.querySelector("#open-match-pairs-button"),
  estimationButton: document.querySelector("#open-estimation-button"),
  curatorCheckButton: document.querySelector("#open-curator-check-button"),
};

const runtime = {
  keys: new Set(),
  lastFrame: 0,
};

const state = {
  content: null,
  selectedThemeId: null,
  game: null,
};

async function loadContent() {
  const response = await fetch("/game/data/assets.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load game assets: ${response.status}`);
  }
  return response.json();
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function byId(collection) {
  return new Map(collection.map((item) => [item.id, item]));
}

function roomCenter(room) {
  return {
    x: room.position.x + room.position.width / 2,
    y: room.position.y + room.position.height / 2,
  };
}

function isRoomUnlocked(game, roomId) {
  return game.unlockedRoomIds.has(roomId);
}

function canUnlockRoom(game, room) {
  if (isRoomUnlocked(game, room.id)) {
    return false;
  }

  if (game.coins < room.cost) {
    return false;
  }

  return room.requiredRoomIds.every((requiredId) => game.unlockedRoomIds.has(requiredId));
}

function findTheme(themeId) {
  return state.content.themes.find((theme) => theme.id === themeId);
}

function findRoom(roomId) {
  return state.content.roomBlueprints.find((room) => room.id === roomId);
}

function findMiniGame(miniGameId) {
  return state.content.miniGames.find((miniGame) => miniGame.id === miniGameId);
}

function logEvent(message) {
  if (!state.game) {
    return;
  }

  state.game.activity.unshift({
    id: crypto.randomUUID(),
    message,
  });
  state.game.activity = state.game.activity.slice(0, 8);
}

function setTheme(themeId) {
  state.selectedThemeId = themeId;
  const theme = findTheme(themeId);

  document.documentElement.style.setProperty("--accent", theme.palette.accent);
  document.documentElement.style.setProperty("--deep", theme.palette.deep);
  document.documentElement.style.setProperty("--highlight", theme.palette.highlight);
  document.documentElement.style.setProperty("--shadow-color", theme.palette.shadow);

  refs.themeHeroImage.src = theme.heroImage;
  refs.themeHeroImage.alt = theme.label;
  refs.stageTitle.textContent = `${theme.label} Floor`;
  refs.startButton.textContent = `Start ${theme.label}`;

  refs.themeRenderStrip.innerHTML = theme.renderViews
    .map(
      (view) => `
        <figure class="render-thumb">
          <img src="${view.imagePath}" alt="${theme.label} ${view.label}" />
          <span>${view.label}</span>
        </figure>
      `,
    )
    .join("");

  refs.themeGrid.querySelectorAll(".theme-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.themeId === themeId);
  });
}

function buildThemeCards() {
  refs.themeGrid.innerHTML = state.content.themes
    .map(
      (theme) => `
        <button class="theme-card" data-theme-id="${theme.id}" type="button">
          <figure class="theme-card-image">
            <img src="${theme.heroImage}" alt="${theme.label}" />
          </figure>
          <div>
            <p class="eyebrow">Starter Direction</p>
            <h3>${theme.label}</h3>
          </div>
          <p>${theme.description}</p>
        </button>
      `,
    )
    .join("");
}

function buildArchiveStrip() {
  refs.archiveStrip.innerHTML = state.content.conceptArt
    .map(
      (item) => `
        <article class="archive-card">
          <figure>
            <img src="${item.originalPath}" alt="${item.label}" />
          </figure>
          <div>
            <h3>${item.label}</h3>
            <p>${item.category.replace(/-/g, " ")}</p>
          </div>
          <button class="archive-button" data-open-asset="${item.id}" type="button">Inspect</button>
        </article>
      `,
    )
    .join("");
}

function createGame(themeId) {
  const theme = findTheme(themeId);
  const unlockedRoomIds = new Set(
    state.content.roomBlueprints
      .filter((room) => room.startUnlocked)
      .map((room) => room.id)
      .concat(theme.starterRoomId),
  );
  const startingRoom = findRoom(theme.starterRoomId);
  const startingPosition = roomCenter(startingRoom);

  return {
    day: 1,
    timer: 0,
    coins: 34,
    reputation: 52,
    curiosity: 48,
    visitorsServed: 0,
    visitorsSeen: 0,
    selectedRoomId: startingRoom.id,
    unlockedRoomIds,
    visitors: [],
    floorCoins: [],
    curator: {
      x: startingPosition.x,
      y: startingPosition.y,
      target: { ...startingPosition },
      speed: 240,
      radius: 18,
    },
    activity: [],
    nextVisitorSpawnAt: 3,
    nextCallAt: 18,
    pendingCall: null,
    activeModal: null,
    uiRefreshCooldown: 0,
  };
}

function startGame() {
  state.game = createGame(state.selectedThemeId);
  refs.museumWorld.style.setProperty("--world-image", `url(${findTheme(state.selectedThemeId).heroImage})`);
  refs.phoneIndicator.hidden = true;
  logEvent(`The ${findTheme(state.selectedThemeId).label} museum day begins.`);
  renderWorld();
  renderAll();
}

function openModal(modal) {
  if (!state.game) {
    return;
  }
  state.game.activeModal = modal;
  renderModal();
}

function closeModal() {
  if (!state.game) {
    return;
  }
  state.game.activeModal = null;
  renderModal();
}

function award({ coins = 0, reputation = 0, curiosity = 0 }, message) {
  state.game.coins += coins;
  state.game.reputation = clamp(state.game.reputation + reputation, 0, 100);
  state.game.curiosity = clamp(state.game.curiosity + curiosity, 0, 100);
  logEvent(message);
  renderAll();
}

function unlockRoom(roomId) {
  const room = findRoom(roomId);
  if (!room || !canUnlockRoom(state.game, room)) {
    return;
  }

  state.game.coins -= room.cost;
  state.game.unlockedRoomIds.add(room.id);
  state.game.selectedRoomId = room.id;
  logEvent(`${room.label} opened for visitors.`);
  renderWorld();
  renderAll();
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function maybeCollectCoins() {
  const curator = state.game.curator;
  const collected = [];

  state.game.floorCoins = state.game.floorCoins.filter((coin) => {
    if (distance(curator, coin) <= curator.radius + 20) {
      collected.push(coin);
      return false;
    }
    return coin.ttl > 0;
  });

  if (collected.length) {
    const total = collected.reduce((sum, coin) => sum + coin.value, 0);
    state.game.coins += total;
    logEvent(`Collected ${total} museum coins from the floor.`);
  }
}

function moveToward(entity, target, speed, deltaSeconds) {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const distanceToTarget = Math.hypot(dx, dy);

  if (distanceToTarget < 1) {
    entity.x = target.x;
    entity.y = target.y;
    return true;
  }

  const travel = Math.min(speed * deltaSeconds, distanceToTarget);
  entity.x += (dx / distanceToTarget) * travel;
  entity.y += (dy / distanceToTarget) * travel;
  return distanceToTarget - travel <= 1;
}

function updateCurator(deltaSeconds) {
  const curator = state.game.curator;
  let moveX = 0;
  let moveY = 0;

  if (runtime.keys.has("ArrowUp") || runtime.keys.has("w")) {
    moveY -= 1;
  }
  if (runtime.keys.has("ArrowDown") || runtime.keys.has("s")) {
    moveY += 1;
  }
  if (runtime.keys.has("ArrowLeft") || runtime.keys.has("a")) {
    moveX -= 1;
  }
  if (runtime.keys.has("ArrowRight") || runtime.keys.has("d")) {
    moveX += 1;
  }

  if (moveX || moveY) {
    const normal = Math.hypot(moveX, moveY) || 1;
    curator.x += (moveX / normal) * curator.speed * deltaSeconds;
    curator.y += (moveY / normal) * curator.speed * deltaSeconds;
    curator.target = null;
  } else if (curator.target) {
    moveToward(curator, curator.target, curator.speed, deltaSeconds);
  }

  curator.x = clamp(curator.x, 20, WORLD.width - 20);
  curator.y = clamp(curator.y, 20, WORLD.height - 20);
}

function pickUnlockedDestination() {
  const unlockedRooms = state.content.roomBlueprints.filter((room) => state.game.unlockedRoomIds.has(room.id));
  return randomItem(unlockedRooms.filter((room) => room.id !== "foyer")) ?? findRoom("foyer");
}

function spawnVisitor() {
  const targetRoom = pickUnlockedDestination();
  const entrance = {
    x: 54,
    y: 340,
  };

  state.game.visitors.push({
    id: crypto.randomUUID(),
    x: entrance.x,
    y: entrance.y,
    speed: 80 + Math.random() * 35,
    state: "to-room",
    roomId: targetRoom.id,
    dwell: 2.5 + Math.random() * 3,
    coinDropped: false,
  });
  state.game.visitorsSeen += 1;
}

function spawnCoin(position, value) {
  state.game.floorCoins.push({
    id: crypto.randomUUID(),
    x: position.x,
    y: position.y,
    ttl: 9,
    value,
  });
}

function updateVisitors(deltaSeconds) {
  const entrance = { x: 54, y: 340 };
  const survivors = [];

  for (const visitor of state.game.visitors) {
    if (visitor.state === "to-room") {
      const target = roomCenter(findRoom(visitor.roomId));
      if (moveToward(visitor, target, visitor.speed, deltaSeconds)) {
        visitor.state = "dwelling";
      }
    } else if (visitor.state === "dwelling") {
      visitor.dwell -= deltaSeconds;
      if (!visitor.coinDropped && visitor.dwell <= 1.2) {
        visitor.coinDropped = true;
        spawnCoin({ x: visitor.x, y: visitor.y }, 6 + findRoom(visitor.roomId).rewardRate * 2);
      }
      if (visitor.dwell <= 0) {
        visitor.state = "exit";
      }
    } else if (visitor.state === "exit") {
      if (moveToward(visitor, entrance, visitor.speed, deltaSeconds)) {
        state.game.visitorsServed += 1;
        state.game.reputation = clamp(state.game.reputation + 1, 0, 100);
        continue;
      }
    }

    survivors.push(visitor);
  }

  state.game.visitors = survivors;
}

function updateFloorCoins(deltaSeconds) {
  state.game.floorCoins = state.game.floorCoins
    .map((coin) => ({
      ...coin,
      ttl: coin.ttl - deltaSeconds,
    }))
    .filter((coin) => coin.ttl > 0);
}

function triggerCallEvent() {
  const question = randomItem(state.content.callDeck);
  state.game.pendingCall = question;
  refs.phoneIndicator.hidden = false;
}

function updateSimulation(deltaSeconds) {
  if (!state.game || state.game.activeModal) {
    return;
  }

  state.game.timer += deltaSeconds;
  state.game.nextVisitorSpawnAt -= deltaSeconds;
  state.game.nextCallAt -= deltaSeconds;

  if (state.game.nextVisitorSpawnAt <= 0) {
    const maxVisitors = 3 + state.game.unlockedRoomIds.size;
    if (state.game.visitors.length < maxVisitors) {
      spawnVisitor();
    }
    state.game.nextVisitorSpawnAt = Math.max(2.4, 5.4 - state.game.unlockedRoomIds.size * 0.22);
  }

  if (state.game.nextCallAt <= 0 && !state.game.pendingCall) {
    triggerCallEvent();
    state.game.nextCallAt = 28;
  }

  updateCurator(deltaSeconds);
  updateVisitors(deltaSeconds);
  updateFloorCoins(deltaSeconds);
  maybeCollectCoins();
  renderWorldEntities();
  state.game.uiRefreshCooldown -= deltaSeconds;
  if (state.game.uiRefreshCooldown <= 0) {
    renderAll();
    state.game.uiRefreshCooldown = 0.2;
  }
}

function renderWorld() {
  if (!state.game) {
    return;
  }

  const theme = findTheme(state.selectedThemeId);
  refs.museumWorld.innerHTML = "";
  refs.museumWorld.style.setProperty("--world-image", `url(${theme.heroImage})`);

  for (const room of state.content.roomBlueprints) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "room-node";
    button.dataset.roomId = room.id;
    button.style.left = `${((room.position.x + room.position.width / 2) / WORLD.width) * 100}%`;
    button.style.top = `${((room.position.y + room.position.height / 2) / WORLD.height) * 100}%`;
    button.style.width = `${(room.position.width / WORLD.width) * 100}%`;
    button.style.height = `${(room.position.height / WORLD.height) * 100}%`;
    button.style.setProperty("--room-image", `url(${room.artPath})`);
    button.innerHTML = `
      <div class="room-node-header">
        <span class="room-node-title">${room.label}</span>
        <span class="room-node-badge">${isRoomUnlocked(state.game, room.id) ? "Open" : `${room.cost} coins`}</span>
      </div>
    `;

    if (!isRoomUnlocked(state.game, room.id)) {
      button.classList.add("locked");
    }
    if (state.game.selectedRoomId === room.id) {
      button.classList.add("selected");
    }

    refs.museumWorld.appendChild(button);
  }

  const curator = document.createElement("div");
  curator.className = "entity curator";
  curator.id = "curator-node";
  refs.museumWorld.appendChild(curator);

  renderWorldEntities();
}

function renderWorldEntities() {
  if (!state.game) {
    return;
  }

  const roomButtons = refs.museumWorld.querySelectorAll(".room-node");
  roomButtons.forEach((button) => {
    const room = findRoom(button.dataset.roomId);
    button.classList.toggle("locked", !isRoomUnlocked(state.game, room.id));
    button.classList.toggle("selected", state.game.selectedRoomId === room.id);
    button.querySelector(".room-node-badge").textContent = isRoomUnlocked(state.game, room.id)
      ? room.miniGameId
        ? "Open"
        : "Active"
      : `${room.cost} coins`;
  });

  refs.museumWorld.querySelectorAll(".entity.visitor, .coin-node").forEach((node) => node.remove());

  const curatorNode = refs.museumWorld.querySelector("#curator-node");
  curatorNode.style.left = `${(state.game.curator.x / WORLD.width) * 100}%`;
  curatorNode.style.top = `${(state.game.curator.y / WORLD.height) * 100}%`;

  for (const visitor of state.game.visitors) {
    const node = document.createElement("div");
    node.className = "entity visitor";
    node.style.left = `${(visitor.x / WORLD.width) * 100}%`;
    node.style.top = `${(visitor.y / WORLD.height) * 100}%`;
    refs.museumWorld.appendChild(node);
  }

  for (const coin of state.game.floorCoins) {
    const node = document.createElement("div");
    node.className = "coin-node";
    node.style.left = `${(coin.x / WORLD.width) * 100}%`;
    node.style.top = `${(coin.y / WORLD.height) * 100}%`;
    refs.museumWorld.appendChild(node);
  }
}

function currentObjective() {
  const lockedRooms = state.content.roomBlueprints.filter((room) => !state.game.unlockedRoomIds.has(room.id));
  const unlockable = lockedRooms.find((room) => canUnlockRoom(state.game, room));

  if (state.game.pendingCall) {
    return "Answer the incoming hotline question before visitor confidence dips.";
  }

  if (unlockable) {
    return `Collect enough coins to open ${unlockable.label}.`;
  }

  if (lockedRooms.length) {
    return "Grow visitor traffic and reputation until the next branch becomes affordable.";
  }

  return "All wings are open. Keep the floor moving and push for a high-curiosity museum day.";
}

function renderStats() {
  refs.statsGrid.innerHTML = [
    { label: "Coins", value: state.game.coins },
    { label: "Reputation", value: `${state.game.reputation}%` },
    { label: "Curiosity", value: `${state.game.curiosity}%` },
    { label: "Visitors Served", value: state.game.visitorsServed },
    { label: "Visitors On Floor", value: state.game.visitors.length },
    { label: "Rooms Open", value: `${state.game.unlockedRoomIds.size}/${state.content.roomBlueprints.length}` },
  ]
    .map(
      (item) => `
        <div class="stat-card">
          <strong>${item.value}</strong>
          <span>${item.label}</span>
        </div>
      `,
    )
    .join("");
}

function renderObjective() {
  const theme = findTheme(state.selectedThemeId);
  refs.objectiveText.textContent = currentObjective();
  refs.objectivePills.innerHTML = [
    { value: theme.label, label: "Direction" },
    { value: `${Math.floor(state.game.timer)}s`, label: "Day Timer" },
    { value: state.game.pendingCall ? "Live" : "Quiet", label: "Hotline" },
  ]
    .map(
      (pill) => `
        <div class="objective-pill">
          <strong>${pill.value}</strong>
          <span>${pill.label}</span>
        </div>
      `,
    )
    .join("");
}

function renderRoomPanel() {
  const room = findRoom(state.game.selectedRoomId);
  if (!room) {
    refs.roomTitle.textContent = "Choose a wing";
    refs.roomCopy.textContent = "Select a room on the museum floor.";
    refs.roomImage.removeAttribute("src");
    refs.roomRenderStrip.innerHTML = "";
    refs.roomActions.innerHTML = "";
    return;
  }

  refs.roomTitle.textContent = room.label;
  refs.roomImage.src = room.previewPath || room.artPath;
  refs.roomImage.alt = room.label;
  refs.roomCopy.textContent = room.blurb;

  const renderViews = room.previewRenderViews.length ? room.previewRenderViews : room.renderViews;
  refs.roomRenderStrip.innerHTML = renderViews
    .slice(0, 3)
    .map(
      (view) => `
        <figure class="render-thumb">
          <img src="${view.imagePath}" alt="${room.label} ${view.label}" />
          <span>${view.label}</span>
        </figure>
      `,
    )
    .join("");

  const roomButtons = [];

  if (!isRoomUnlocked(state.game, room.id)) {
    const affordable = state.game.coins >= room.cost;
    const prerequisitesMet = room.requiredRoomIds.every((requiredId) => state.game.unlockedRoomIds.has(requiredId));
    if (affordable && prerequisitesMet) {
      roomButtons.push(`
        <button class="room-button primary" data-room-action="unlock" data-room-id="${room.id}" type="button">
          Unlock For ${room.cost} Coins
        </button>
      `);
    } else {
      const reason = !prerequisitesMet
        ? `Open ${room.requiredRoomIds.map((requiredId) => findRoom(requiredId).label).join(" and ")} first`
        : `Need ${room.cost - state.game.coins} more coins`;
      roomButtons.push(`
        <button class="room-button" type="button" disabled>
          ${reason}
        </button>
      `);
    }
  } else if (room.miniGameId) {
    roomButtons.push(`
      <button class="room-button primary" data-room-action="mini-game" data-room-id="${room.id}" type="button">
        Play ${findMiniGame(room.miniGameId).label}
      </button>
    `);
  } else {
    roomButtons.push(`
      <button class="room-button primary" data-room-action="tour" data-room-id="${room.id}" type="button">
        Host Guided Tour
      </button>
    `);
  }

  roomButtons.push(`
    <button class="room-button" data-room-action="move" data-room-id="${room.id}" type="button">
      Move Curator Here
    </button>
  `);

  refs.roomActions.innerHTML = roomButtons.join("");
}

function renderActivity() {
  refs.activityLog.innerHTML = state.game.activity
    .map((entry) => `<li>${entry.message}</li>`)
    .join("");
}

function renderTricks() {
  refs.trickList.innerHTML = state.content.renderLab.tricks
    .map((trick) => `<li>${trick}</li>`)
    .join("");
}

function renderPhoneState() {
  refs.phoneIndicator.hidden = !state.game.pendingCall;
}

function renderAll() {
  if (!state.game) {
    return;
  }

  renderStats();
  renderObjective();
  renderRoomPanel();
  renderActivity();
  renderTricks();
  renderPhoneState();
}

function openCallModal(question = randomItem(state.content.callDeck)) {
  openModal({
    type: "call",
    question,
  });
}

function resolveCall(choiceIndex) {
  const { question } = state.game.activeModal;
  const success = choiceIndex === question.correctIndex;
  state.game.pendingCall = null;
  refs.phoneIndicator.hidden = true;
  closeModal();

  if (success) {
    award({ coins: 14, reputation: 6, curiosity: 8 }, question.success);
  } else {
    award({ reputation: -4, curiosity: -2 }, question.failure);
  }
}

function openMiniGameModal(miniGameId) {
  const miniGame = findMiniGame(miniGameId);

  if (miniGameId === "study-quiz") {
    openCallModal(randomItem(state.content.callDeck));
    return;
  }

  if (miniGameId === "estimation") {
    const scenario = randomItem(state.content.estimationDeck);
    openModal({
      type: "estimation",
      miniGame,
      scenario,
      guess: Math.round((scenario.min + scenario.max) / 2),
    });
    return;
  }

  if (miniGameId === "curator-check") {
    openModal({
      type: "curator-check",
      miniGame,
      scenario: randomItem(state.content.curatorCheckDeck),
    });
    return;
  }

  if (miniGameId === "match-pairs") {
    const deck = shuffle(
      state.content.matchPairsDeck.flatMap((label) => [
        { id: `${label}-a`, pair: label, label },
        { id: `${label}-b`, pair: label, label },
      ]),
    ).map((card) => ({
      ...card,
      matched: false,
      revealed: false,
    }));

    openModal({
      type: "match-pairs",
      miniGame,
      deck,
      attempts: 0,
      locked: false,
    });
  }
}

function finishEstimation() {
  const { scenario, guess } = state.game.activeModal;
  const distanceFromAnswer = Math.abs(guess - scenario.value);
  const range = Math.max(1, scenario.max - scenario.min);
  const accuracy = 1 - distanceFromAnswer / range;
  const coinReward = Math.max(4, Math.round(accuracy * 22));
  const repReward = accuracy > 0.8 ? 5 : 2;
  closeModal();
  award(
    { coins: coinReward, reputation: repReward, curiosity: 4 },
    `Estimation lab completed with ${coinReward} bonus coins.`,
  );
}

function resolveCuratorCheck(choiceIndex) {
  const { scenario } = state.game.activeModal;
  const success = choiceIndex === scenario.correctIndex;
  closeModal();

  if (success) {
    award({ coins: 10, reputation: 8, curiosity: 5 }, "Curator check solved cleanly. Visitor flow improves.");
  } else {
    award({ reputation: -3, curiosity: -1 }, "The curator check slipped. The museum loses a little confidence.");
  }
}

function handleMatchCard(cardId) {
  const modal = state.game.activeModal;
  if (modal.locked) {
    return;
  }

  const card = modal.deck.find((entry) => entry.id === cardId);
  if (!card || card.matched || card.revealed) {
    return;
  }

  card.revealed = true;
  const revealed = modal.deck.filter((entry) => entry.revealed && !entry.matched);

  if (revealed.length === 2) {
    modal.attempts += 1;
    modal.locked = true;

    if (revealed[0].pair === revealed[1].pair) {
      revealed.forEach((entry) => {
        entry.matched = true;
      });
      modal.locked = false;

      if (modal.deck.every((entry) => entry.matched)) {
        const reward = Math.max(8, 22 - modal.attempts);
        closeModal();
        award({ coins: reward, reputation: 5, curiosity: 7 }, `Match Pairs cleared in ${modal.attempts} tries.`);
        return;
      }
    } else {
      window.setTimeout(() => {
        revealed.forEach((entry) => {
          entry.revealed = false;
        });
        modal.locked = false;
        renderModal();
      }, 700);
    }
  }

  renderModal();
}

function openArchiveModal(focusAssetId = null) {
  openModal({
    type: "archive",
    focusAssetId,
  });
}

function renderArchiveModal(focusAssetId) {
  const focusAsset = focusAssetId
    ? state.content.conceptArt.find((item) => item.id === focusAssetId)
    : state.content.conceptArt[0];

  return `
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <p class="eyebrow">Repo Archive</p>
          <h2>Concept Art And Intersecting Libraries</h2>
          <p class="modal-subtitle">Every tracked concept image plus the three-view render library when available.</p>
        </div>
        <button class="modal-close" data-modal-action="close" type="button">Close</button>
      </div>

      <section class="modal-feature">
        <figure class="modal-feature-image">
          <img src="${focusAsset.originalPath}" alt="${focusAsset.label}" />
        </figure>
        <div>
          <p class="eyebrow">${focusAsset.category.replace(/-/g, " ")}</p>
          <h3>${focusAsset.label}</h3>
          <p class="modal-copy">${focusAsset.renderLibrary ? focusAsset.renderLibrary.coverageGoal : "Original concept art only."}</p>
          <div class="archive-render-row">
            ${(focusAsset.renderLibrary?.views ?? [])
              .map(
                (view) => `
                  <img src="${view.imagePath}" alt="${focusAsset.label} ${view.label}" />
                `,
              )
              .join("")}
          </div>
        </div>
      </section>

      <div class="archive-groups">
        ${state.content.conceptGroups
          .map(
            (group) => `
              <section class="archive-group">
                <div>
                  <p class="eyebrow">${group.label}</p>
                  <p class="modal-copy">${group.description}</p>
                </div>
                <div class="archive-card-grid">
                  ${group.items
                    .map(
                      (item) => `
                        <article class="archive-modal-card">
                          <figure>
                            <img src="${item.originalPath}" alt="${item.label}" />
                          </figure>
                          <h4>${item.label}</h4>
                          <p>${group.label}</p>
                          <div class="archive-render-row">
                            ${(item.renderLibrary?.views ?? [])
                              .map(
                                (view) => `
                                  <img src="${view.imagePath}" alt="${item.label} ${view.label}" />
                                `,
                              )
                              .join("")}
                          </div>
                          <button class="archive-button" data-open-asset="${item.id}" type="button">Focus Asset</button>
                        </article>
                      `,
                    )
                    .join("")}
                </div>
              </section>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderModal() {
  if (!state.game?.activeModal) {
    refs.modalRoot.hidden = true;
    refs.modalRoot.innerHTML = "";
    return;
  }

  refs.modalRoot.hidden = false;

  const modal = state.game.activeModal;
  let content = "";

  if (modal.type === "call") {
    const art = findMiniGame("study-quiz");
    content = `
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Live Hotline</p>
            <h2>Call The Curator</h2>
            <p class="modal-subtitle">Answer clearly while the museum floor waits for you.</p>
          </div>
          <button class="modal-close" data-modal-action="close" type="button">Close</button>
        </div>
        <section class="modal-feature">
          <figure class="modal-feature-image">
            <img src="${art.artPath}" alt="${art.label}" />
          </figure>
          <div>
            <h3>${modal.question.prompt}</h3>
            <div class="choice-grid">
              ${modal.question.choices
                .map(
                  (choice, index) => `
                    <button class="choice-button primary" data-call-choice="${index}" type="button">${choice}</button>
                  `,
                )
                .join("")}
            </div>
          </div>
        </section>
      </div>
    `;
  } else if (modal.type === "estimation") {
    content = `
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Mini Game</p>
            <h2>${modal.miniGame.label}</h2>
            <p class="modal-subtitle">${modal.miniGame.description}</p>
          </div>
          <button class="modal-close" data-modal-action="close" type="button">Close</button>
        </div>
        <section class="modal-feature">
          <figure class="modal-feature-image">
            <img src="${modal.miniGame.artPath}" alt="${modal.miniGame.label}" />
          </figure>
          <div>
            <h3>${modal.scenario.prompt}</h3>
            <div class="slider-wrap">
              <input
                id="estimation-slider"
                type="range"
                min="${modal.scenario.min}"
                max="${modal.scenario.max}"
                value="${modal.guess}"
                step="1"
              />
              <div class="slider-value" id="estimation-value">${modal.guess} ${modal.scenario.unit}</div>
            </div>
            <div class="mini-stat-row">
              <span class="pill">Range: ${modal.scenario.min} to ${modal.scenario.max}</span>
              <span class="pill">Reward: up to 22 coins</span>
            </div>
            <div class="choice-grid">
              <button class="choice-button primary" data-modal-action="finish-estimation" type="button">Lock In Guess</button>
            </div>
          </div>
        </section>
      </div>
    `;
  } else if (modal.type === "curator-check") {
    content = `
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Mini Game</p>
            <h2>${modal.miniGame.label}</h2>
            <p class="modal-subtitle">${modal.miniGame.description}</p>
          </div>
          <button class="modal-close" data-modal-action="close" type="button">Close</button>
        </div>
        <section class="modal-feature">
          <figure class="modal-feature-image">
            <img src="${modal.miniGame.artPath}" alt="${modal.miniGame.label}" />
          </figure>
          <div>
            <h3>${modal.scenario.prompt}</h3>
            <div class="choice-grid">
              ${modal.scenario.choices
                .map(
                  (choice, index) => `
                    <button class="choice-button primary" data-curator-choice="${index}" type="button">${choice}</button>
                  `,
                )
                .join("")}
            </div>
          </div>
        </section>
      </div>
    `;
  } else if (modal.type === "match-pairs") {
    content = `
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Mini Game</p>
            <h2>${modal.miniGame.label}</h2>
            <p class="modal-subtitle">${modal.miniGame.description}</p>
          </div>
          <button class="modal-close" data-modal-action="close" type="button">Close</button>
        </div>
        <section class="modal-feature">
          <figure class="modal-feature-image">
            <img src="${modal.miniGame.artPath}" alt="${modal.miniGame.label}" />
          </figure>
          <div>
            <h3>Find the six museum pairs.</h3>
            <p class="modal-copy">Attempts: ${modal.attempts}</p>
            <div class="match-grid">
              ${modal.deck
                .map(
                  (card) => `
                    <button
                      class="match-card ${card.revealed || card.matched ? "revealed" : ""} ${card.matched ? "matched" : ""}"
                      data-match-card="${card.id}"
                      type="button"
                    >
                      ${card.revealed || card.matched ? card.label : "Reveal"}
                    </button>
                  `,
                )
                .join("")}
            </div>
          </div>
        </section>
      </div>
    `;
  } else if (modal.type === "archive") {
    content = renderArchiveModal(modal.focusAssetId);
  }

  refs.modalRoot.innerHTML = `<div class="modal-shell">${content}</div>`;

  const slider = refs.modalRoot.querySelector("#estimation-slider");
  const value = refs.modalRoot.querySelector("#estimation-value");
  if (slider && value) {
    slider.addEventListener("input", () => {
      state.game.activeModal.guess = Number.parseInt(slider.value, 10);
      value.textContent = `${slider.value} ${state.game.activeModal.scenario.unit}`;
    });
  }
}

function tourRoom(roomId) {
  const room = findRoom(roomId);
  if (!isRoomUnlocked(state.game, roomId)) {
    return;
  }
  state.game.reputation = clamp(state.game.reputation + 3, 0, 100);
  state.game.curiosity = clamp(state.game.curiosity + 4, 0, 100);
  spawnCoin(roomCenter(room), 12 + room.rewardRate * 2);
  logEvent(`Guided tour hosted in ${room.label}.`);
  renderAll();
}

function setCuratorTarget(target) {
  state.game.curator.target = {
    x: clamp(target.x, 20, WORLD.width - 20),
    y: clamp(target.y, 20, WORLD.height - 20),
  };
}

function handleWorldPointer(event) {
  if (!state.game) {
    return;
  }

  const roomButton = event.target.closest(".room-node");
  if (roomButton) {
    const room = findRoom(roomButton.dataset.roomId);
    state.game.selectedRoomId = room.id;

    if (!isRoomUnlocked(state.game, room.id) && canUnlockRoom(state.game, room)) {
      unlockRoom(room.id);
      return;
    }

    if (isRoomUnlocked(state.game, room.id)) {
      setCuratorTarget(roomCenter(room));
      renderWorldEntities();
      renderAll();
      return;
    }
  }

  const bounds = refs.museumWorld.getBoundingClientRect();
  const target = {
    x: ((event.clientX - bounds.left) / bounds.width) * WORLD.width,
    y: ((event.clientY - bounds.top) / bounds.height) * WORLD.height,
  };
  setCuratorTarget(target);
  renderWorldEntities();
}

function bindEvents() {
  refs.themeGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".theme-card");
    if (!card) {
      return;
    }
    setTheme(card.dataset.themeId);
  });

  refs.startButton.addEventListener("click", startGame);
  refs.openArchiveButton.addEventListener("click", () => {
    if (!state.game) {
      startGame();
    }
    openArchiveModal();
  });
  refs.museumWorld.addEventListener("click", handleWorldPointer);
  refs.hotlineButton.addEventListener("click", () => openCallModal(state.game?.pendingCall ?? randomItem(state.content.callDeck)));
  refs.matchPairsButton.addEventListener("click", () => openMiniGameModal("match-pairs"));
  refs.estimationButton.addEventListener("click", () => openMiniGameModal("estimation"));
  refs.curatorCheckButton.addEventListener("click", () => openMiniGameModal("curator-check"));

  refs.roomActions.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-room-action]");
    if (!actionButton) {
      return;
    }

    const roomId = actionButton.dataset.roomId;
    const action = actionButton.dataset.roomAction;
    const room = findRoom(roomId);

    if (action === "unlock") {
      unlockRoom(roomId);
    } else if (action === "mini-game") {
      openMiniGameModal(room.miniGameId);
    } else if (action === "tour") {
      tourRoom(roomId);
    } else if (action === "move") {
      setCuratorTarget(roomCenter(room));
    }

    renderAll();
    renderWorldEntities();
  });

  refs.archiveStrip.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-asset]");
    if (!button) {
      return;
    }
    openArchiveModal(button.dataset.openAsset);
  });

  refs.modalRoot.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-modal-action='close']");
    if (closeButton) {
      closeModal();
      return;
    }

    const finishEstimationButton = event.target.closest("[data-modal-action='finish-estimation']");
    if (finishEstimationButton) {
      finishEstimation();
      return;
    }

    const callChoice = event.target.closest("[data-call-choice]");
    if (callChoice) {
      resolveCall(Number.parseInt(callChoice.dataset.callChoice, 10));
      return;
    }

    const curatorChoice = event.target.closest("[data-curator-choice]");
    if (curatorChoice) {
      resolveCuratorCheck(Number.parseInt(curatorChoice.dataset.curatorChoice, 10));
      return;
    }

    const matchCard = event.target.closest("[data-match-card]");
    if (matchCard) {
      handleMatchCard(matchCard.dataset.matchCard);
      return;
    }

    const archiveButton = event.target.closest("[data-open-asset]");
    if (archiveButton) {
      openArchiveModal(archiveButton.dataset.openAsset);
    }
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(key)) {
      runtime.keys.add(key);
      event.preventDefault();
    }
    if (key === "Escape") {
      closeModal();
    }
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    runtime.keys.delete(key);
  });
}

function tick(timestamp) {
  if (!runtime.lastFrame) {
    runtime.lastFrame = timestamp;
  }

  const deltaSeconds = Math.min(0.05, (timestamp - runtime.lastFrame) / 1000);
  runtime.lastFrame = timestamp;

  if (state.game) {
    updateSimulation(deltaSeconds);
  }

  window.requestAnimationFrame(tick);
}

async function init() {
  try {
    state.content = await loadContent();
    buildThemeCards();
    buildArchiveStrip();
    bindEvents();
    setTheme(state.content.themes[0].id);
    refs.trickList.innerHTML = state.content.renderLab.tricks.map((trick) => `<li>${trick}</li>`).join("");
    window.requestAnimationFrame(tick);
  } catch (error) {
    refs.themeGrid.innerHTML = `<p>${error instanceof Error ? error.message : String(error)}</p>`;
  }
}

init();
