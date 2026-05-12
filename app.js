const rowsInput = document.getElementById("rows");
const colsInput = document.getElementById("cols");
const buildGridBtn = document.getElementById("buildGridBtn");
const nameInput = document.getElementById("nameInput");
const linkLengthInput = document.getElementById("linkLengthInput");
const highlightBtn = document.getElementById("highlightBtn");
const clearHighlightBtn = document.getElementById("clearHighlightBtn");
const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const cardTemplate = document.getElementById("cardTemplate");
const successModal = document.getElementById("successModal");
const toBuilderPageBtn = document.getElementById("toBuilderPage");
const toMemoryPageBtn = document.getElementById("toMemoryPage");
const builderPage = document.getElementById("builderPage");
const memoryPage = document.getElementById("memoryPage");
const memoryRowsInput = document.getElementById("memoryRows");
const memoryColsInput = document.getElementById("memoryCols");
const buildMemoryGridBtn = document.getElementById("buildMemoryGridBtn");
const memoryGrid = document.getElementById("memoryGrid");
const memoryStatusEl = document.getElementById("memoryStatus");
const shareLinkInput = document.getElementById("shareLinkInput");
const makeShareLinkBtn = document.getElementById("makeShareLinkBtn");
const copyShareLinkBtn = document.getElementById("copyShareLinkBtn");
const shareStatusEl = document.getElementById("shareStatus");
const flipCountEl = document.getElementById("flipCount");
const toggleNamesCheckbox = document.getElementById("toggleNames");
const appRoot = document.querySelector('.app');
const historyListEl = document.getElementById('historyList');
const historyInfoEl = document.getElementById('historyInfo');
const revealAllBtn = document.getElementById('revealAllBtn');
const restoreHistoryBtn = document.getElementById('restoreHistoryBtn');
const openSharedHistoryBtn = document.getElementById('openSharedHistoryBtn');

const IMAGE_DIR = "图片";
let imageNames = [];
let currentRows = Number(rowsInput.value) || 0;
let currentCols = Number(colsInput.value) || 0;
let lastLineSuccess = false;
let modalTimer = null;
let memoryLock = false;
let memoryOpenedCards = [];
let memoryMatchedCount = 0;
let memoryTotalCards = 0;
let memoryResetTimer = null;
let memoryFlipCount = 0;
let lastBuilderDeck = [];
let lastMemoryDeck = [];
let isSharedView = false;
let sharedPage = null;
let memoryLoading = false;
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingCloseBtn = document.getElementById('loadingCloseBtn');
const LOADING_TIMEOUT_MS = 10000; // 超时（毫秒），到时自动关闭遮罩
let loadingTimeout = null;
const HISTORY_KEY = 'bingo_history_v1';
let currentSelectedHistoryId = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#c73811" : "#0f6a5d";
}

function setMemoryStatus(message, isError = false) {
  memoryStatusEl.textContent = message;
  memoryStatusEl.style.color = isError ? "#c73811" : "#0f6a5d";
}

function showLoadingOverlay() {
  if (!loadingOverlay) return;
  loadingOverlay.hidden = false;
  loadingOverlay.style.display = "grid";
}

function hideLoadingOverlay() {
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }
  memoryLoading = false;
  if (!loadingOverlay) return;
  loadingOverlay.hidden = true;
  loadingOverlay.style.display = "none";
}

function setShareStatus(message, isError = false) {
  // 不在分享视图中显示任何分享相关信息
  if (typeof isSharedView !== 'undefined' && isSharedView) return;
  shareStatusEl.textContent = message;
  shareStatusEl.style.color = isError ? "#c73811" : "#0f6a5d";
}

function encodeShareState(state) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

function decodeShareState(value) {
  return JSON.parse(decodeURIComponent(escape(atob(value))));
}

function updateFlipCountText() {
  flipCountEl.textContent = String(memoryFlipCount);
}

function applyNameToggle(checked) {
  if (!appRoot) return;
  if (checked) {
    appRoot.classList.remove('hide-names');
  } else {
    appRoot.classList.add('hide-names');
  }
}

function toImagePath(fileName) {
  try {
    const name = typeof fileName === "string" && fileName.normalize ? fileName.normalize("NFC") : fileName;
    return `${IMAGE_DIR}/${encodeURIComponent(name)}`;
  } catch (e) {
    return `${IMAGE_DIR}/${encodeURIComponent(fileName)}`;
  }
}

function normalizeName(name) {
  return name.trim().toLowerCase();
}

function shuffledCopy(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function stripExtension(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

function getTargetLineLength() {
  const value = Number(linkLengthInput.value);
  if (!Number.isInteger(value) || value < 2) {
    return 3;
  }
  return value;
}

function isInside(row, col, rows, cols) {
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

function getActiveIndexSet() {
  const set = new Set();
  const cells = grid.querySelectorAll(".cell.active");
  cells.forEach((cell) => {
    const index = Number(cell.dataset.index);
    if (Number.isInteger(index)) {
      set.add(index);
    }
  });
  return set;
}

function findConnectedLine(activeSet, rows, cols, targetLen) {
  if (!activeSet.size || rows < 1 || cols < 1) {
    return null;
  }

  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const index of activeSet) {
    const row = Math.floor(index / cols);
    const col = index % cols;

    for (const [dr, dc] of directions) {
      const prevRow = row - dr;
      const prevCol = col - dc;

      if (isInside(prevRow, prevCol, rows, cols)) {
        const prevIndex = prevRow * cols + prevCol;
        if (activeSet.has(prevIndex)) {
          continue;
        }
      }

      let length = 0;
      let r = row;
      let c = col;

      while (isInside(r, c, rows, cols)) {
        const nextIndex = r * cols + c;
        if (!activeSet.has(nextIndex)) {
          break;
        }

        length += 1;
        if (length >= targetLen) {
          return { length, row, col, dr, dc };
        }

        r += dr;
        c += dc;
      }
    }
  }

  return null;
}

function getLineHintText() {
  const targetLen = getTargetLineLength();
  const activeSet = getActiveIndexSet();
  const line = findConnectedLine(activeSet, currentRows, currentCols, targetLen);

  if (line) {
    return `检测到连线：高亮格子可连成至少 ${targetLen} 格。`;
  }

  return `未检测到 ${targetLen} 格连线。`;
}

function hasLineSuccess() {
  const targetLen = getTargetLineLength();
  const activeSet = getActiveIndexSet();
  return Boolean(findConnectedLine(activeSet, currentRows, currentCols, targetLen));
}

function showSuccessModal() {
  if (!successModal) {
    return;
  }

  successModal.classList.add("show");
  successModal.setAttribute("aria-hidden", "false");

  if (modalTimer) {
    clearTimeout(modalTimer);
  }

  modalTimer = setTimeout(() => {
    successModal.classList.remove("show");
    successModal.setAttribute("aria-hidden", "true");
  }, 1400);
}

function updateLineStateAndNotify() {
  const nowSuccess = hasLineSuccess();
  if (nowSuccess && !lastLineSuccess) {
    showSuccessModal();
  }
  lastLineSuccess = nowSuccess;
}

function createCell(fileName, index) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  const image = node.querySelector(".thumb");
  const name = node.querySelector(".name");

  node.dataset.name = fileName;
  node.dataset.index = String(index);
  node.style.animationDelay = `${Math.min(index * 18, 500)}ms`;

  image.src = toImagePath(fileName);
  image.alt = fileName;

  image.addEventListener("error", () => {
    image.alt = `加载失败: ${fileName}`;
    image.removeAttribute("src");
  });

  name.textContent = stripExtension(fileName);

  node.addEventListener("click", () => {
    node.classList.toggle("active");
    updateLineStateAndNotify();
    setStatus(`手动切换高亮。${getLineHintText()}`);
  });

  return node;
}

function buildBuilderGridWithDeck(rows, cols, deck) {
  const total = rows * cols;
  if (!Array.isArray(deck) || deck.length !== total) {
    setStatus("分享数据无效：宫格数据长度不匹配。", true);
    return;
  }

  const fragment = document.createDocumentFragment();

  currentRows = rows;
  currentCols = cols;
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  deck.forEach((imageName, i) => {
    fragment.append(createCell(imageName, i));
  });

  grid.append(fragment);
  lastBuilderDeck = [...deck];
  lastLineSuccess = false;
  setStatus(`宫格已生成：${rows} x ${cols}（共 ${total} 格）。${getLineHintText()}`);
  // 自动生成并填写分享链接（恢复到当前 builder 状态）
  try {
    const state = { page: "builder", rows: currentRows, cols: currentCols, deck: lastBuilderDeck };
    const url = new URL(window.location.href);
    url.searchParams.set("state", encodeShareState(state));
    shareLinkInput.value = url.toString();
    setShareStatus("已为当前宫格自动生成分享链接。可复制发送给他人。", false);
  } catch (e) {
    // ignore
  }
}

function buildGrid() {
  if (isSharedView) {
    setStatus("此页面来自分享链接，当前视图已锁定，无法重新生成。", true);
    return;
  }
  const rows = Number(rowsInput.value);
  const cols = Number(colsInput.value);

  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    setStatus("请输入有效的行数和列数（最小 1）。", true);
    return;
  }

  if (!imageNames.length) {
    setStatus("图片清单为空，无法生成宫格。", true);
    return;
  }

  const total = rows * cols;
  let randomPool = [];
  const deck = [];

  for (let i = 0; i < total; i += 1) {
    if (!randomPool.length) {
      randomPool = shuffledCopy(imageNames);
    }

    const imageName = randomPool.pop();
    deck.push(imageName);
  }

  buildBuilderGridWithDeck(rows, cols, deck);
}

function applyHighlight() {
  const text = nameInput.value.trim();
  if (!text) {
    setStatus("请输入要匹配的名称。", true);
    return;
  }

  const keywords = text
    .split(/[，,\n]+/)
    .map(normalizeName)
    .filter(Boolean);

  if (!keywords.length) {
    setStatus("没有可用的匹配关键词。", true);
    return;
  }

  let count = 0;
  const cells = grid.querySelectorAll(".cell");

  cells.forEach((cell) => {
    const rawName = normalizeName(cell.dataset.name || "");
    const baseName = normalizeName(stripExtension(cell.dataset.name || ""));
    const matched = keywords.some((keyword) => rawName.includes(keyword) || baseName.includes(keyword));
    if (matched) {
      count += 1;
      cell.classList.add("active");
    }
  });

  updateLineStateAndNotify();
  setStatus(`高亮完成：匹配 ${count} 个方格。${getLineHintText()} 再次点击方格可取消选中。`);
}

function clearHighlight() {
  const activeCells = grid.querySelectorAll(".cell.active");
  activeCells.forEach((cell) => cell.classList.remove("active"));
  updateLineStateAndNotify();
  setStatus(`已清空高亮：${activeCells.length} 个方格取消选中。${getLineHintText()}`);
}

function showPage(target) {
  const showBuilder = target === "builder";

  // 在分享视图下阻止切换到非分享页面
  if (isSharedView && target !== sharedPage) {
    if (sharedPage === "builder") {
      setShareStatus("此链接仅展示生成时的宫格（生成页），页面已锁定。", true);
    } else if (sharedPage === "memory") {
      setShareStatus("此链接仅展示生成时的翻牌页，页面已锁定。", true);
    }
    return;
  }

  builderPage.classList.toggle("active", showBuilder);
  memoryPage.classList.toggle("active", !showBuilder);
  builderPage.hidden = !showBuilder;
  memoryPage.hidden = showBuilder;

  toBuilderPageBtn.classList.toggle("active", showBuilder);
  toMemoryPageBtn.classList.toggle("active", !showBuilder);

  if (showBuilder) {
    hideLoadingOverlay();
  }
}

function getMemoryDeck(total) {
  const pairCount = total / 2;
  const selected = [];
  let randomPool = [];

  while (selected.length < pairCount) {
    if (!randomPool.length) {
      randomPool = shuffledCopy(imageNames);
    }
    selected.push(randomPool.pop());
  }

  const deck = [];
  selected.forEach((name) => {
    deck.push(name);
    deck.push(name);
  });

  return shuffledCopy(deck);
}

function updateMemoryProgressText(extra = "") {
  const pairTotal = memoryTotalCards / 2;
  const matchedPairs = memoryMatchedCount / 2;
  const prefix = `已配对 ${matchedPairs}/${pairTotal} 对。`;
  setMemoryStatus(extra ? `${prefix} ${extra}` : prefix);
}

function handleMemoryCardClick(card) {
  if (memoryLoading || memoryLock || card.classList.contains("flipped") || card.classList.contains("matched")) {
    if (memoryLoading) {
      setMemoryStatus('图片仍在加载，请等待加载完成后再翻牌。');
    }
    return;
  }

  card.classList.add("flipped");
  memoryOpenedCards.push(card);

  if (memoryOpenedCards.length < 2) {
    return;
  }

  // 两张牌已被翻开，计为一次翻牌
  memoryFlipCount += 1;
  updateFlipCountText();

  const [first, second] = memoryOpenedCards;
  const matched = first.dataset.name === second.dataset.name;

  if (matched) {
    first.classList.add("matched", "disabled");
    second.classList.add("matched", "disabled");
    memoryMatchedCount += 2;
    memoryOpenedCards = [];

    if (memoryMatchedCount === memoryTotalCards) {
      setMemoryStatus("全部配对完成，恭喜通关！");
      return;
    }

    updateMemoryProgressText("本次翻牌配对成功。");
    return;
  }

  memoryLock = true;
  updateMemoryProgressText("本次不匹配，1 秒后翻回。");

  if (memoryResetTimer) {
    clearTimeout(memoryResetTimer);
  }

  memoryResetTimer = setTimeout(() => {
    first.classList.remove("flipped");
    second.classList.remove("flipped");
    memoryOpenedCards = [];
    memoryLock = false;
    updateMemoryProgressText();
  }, 1000);
}

function createMemoryCard(fileName, index) {
  const card = document.createElement("article");
  card.className = "memory-card";
  card.dataset.name = fileName;
  card.style.animationDelay = `${Math.min(index * 18, 500)}ms`;

  const front = document.createElement("div");
  front.className = "face front";

  const thumbWrap = document.createElement("div");
  thumbWrap.className = "thumb-wrap";

  const image = document.createElement("img");
  image.className = "thumb";
  // 不直接将 src 赋值，改为 data-src 并由外部负责预加载（fetch 或回退赋 src）
  image.dataset.src = toImagePath(fileName);
  image.alt = fileName;

  image.addEventListener("error", () => {
    image.alt = `加载失败: ${fileName}`;
    image.removeAttribute("src");
  });

  const name = document.createElement("p");
  name.className = "name";
  name.textContent = stripExtension(fileName);

  thumbWrap.append(image);
  front.append(thumbWrap, name);

  const back = document.createElement("div");
  back.className = "face back";
  back.textContent = "翻";

  card.append(front, back);
  card.addEventListener("click", () => handleMemoryCardClick(card));

  return card;
}

function buildMemoryGrid() {
  if (isSharedView) {
    setMemoryStatus("此页面来自分享链接，当前视图已锁定，无法重新生成。", true);
    return;
  }
  const rows = Number(memoryRowsInput.value);
  const cols = Number(memoryColsInput.value);

  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    setMemoryStatus("请输入有效的行数和列数（最小 1）。", true);
    return;
  }

  if (!imageNames.length) {
    setMemoryStatus("图片清单为空，无法生成翻牌宫格。", true);
    return;
  }

  const total = rows * cols;
  if (total % 2 !== 0) {
    setMemoryStatus("翻牌配对需要偶数个格子，请调整行列使总数为偶数。", true);
    return;
  }

  if (memoryResetTimer) {
    clearTimeout(memoryResetTimer);
  }
  const deck = getMemoryDeck(total);
  buildMemoryGridWithDeck(rows, cols, deck);
}

function buildMemoryGridWithDeck(rows, cols, deck) {
  const total = rows * cols;
  if (!Array.isArray(deck) || deck.length !== total) {
    setMemoryStatus("分享数据无效：翻牌宫格数据长度不匹配。", true);
    return;
  }
  // 准备渲染并等待所有图片 load/error 完成
  memoryGrid.innerHTML = "";
  memoryGrid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  const fragment = document.createDocumentFragment();
  // 用于统计图片加载完成数量
  let toLoad = deck.length;
  memoryLoading = true;
  showLoadingOverlay();
  // 启动超时保底，防止 lazy loading 或网络问题导致遮罩长期存在
  if (loadingTimeout) { clearTimeout(loadingTimeout); loadingTimeout = null; }
  loadingTimeout = setTimeout(() => {
    loadingTimeout = null;
    hideLoadingOverlay();
    setMemoryStatus('图片加载超时，已自动解除遮罩。');
  }, LOADING_TIMEOUT_MS);

  deck.forEach((name, index) => {
      const card = createMemoryCard(name, index);
      const img = card.querySelector('img.thumb');

      // attach handlers first
      const onEnd = () => {
        img.removeEventListener('load', onEnd);
        img.removeEventListener('error', onEnd);
        toLoad -= 1;
        if (toLoad <= 0) {
          hideLoadingOverlay();
          setMemoryStatus(`图片已加载完毕。${rows} x ${cols}（共 ${total} 格）。`);
        }
      };
      img.addEventListener('load', onEnd);
      img.addEventListener('error', onEnd);

      // 尝试使用 fetch 预加载图片（能触发即时完成），失败则回退到直接赋 src
      (async () => {
        const srcUrl = img.dataset.src;
        if (!srcUrl) {
          setTimeout(onEnd, 0);
          return;
        }

        try {
          const resp = await fetch(srcUrl, { mode: 'cors' });
          if (!resp.ok) throw new Error('fetch failed');
          const blob = await resp.blob();
          const obj = URL.createObjectURL(blob);
          img.src = obj;
        } catch (e) {
          // 回退：直接把 src 赋值，让浏览器尝试加载（可能在 file:// 下也起作用）
          img.src = img.dataset.src;
        } finally {
          // 如果浏览器已缓存且 img.complete 为 true，确保 onEnd 被触发
          if (img.complete) setTimeout(onEnd, 0);
        }
      })();

      fragment.append(card);
  });

  memoryGrid.append(fragment);
  lastMemoryDeck = [...deck];
  memoryLock = false;
  memoryOpenedCards = [];
  memoryMatchedCount = 0;
  memoryTotalCards = total;
  memoryFlipCount = 0;
  updateFlipCountText();
  setMemoryStatus(`正在加载图片：${rows} x ${cols}（共 ${total} 格），请稍候…`);
  // 自动生成并填写分享链接（恢复到当前 memory 状态，只展示翻牌页）
  try {
    const state = { page: "memory", rows, cols, deck: lastMemoryDeck };
    const url = new URL(window.location.href);
    url.searchParams.set("state", encodeShareState(state));
    shareLinkInput.value = url.toString();
    setShareStatus("已为本局自动生成分享链接（仅恢复翻牌页面）。可复制发送给他人。", false);
  } catch (e) {
    // ignore
  }
}

function makeShareLink() {
  let state = null;

  if (!builderPage.hidden && lastBuilderDeck.length) {
    state = {
      page: "builder",
      rows: currentRows,
      cols: currentCols,
      deck: lastBuilderDeck,
    };
  }

  if (!memoryPage.hidden && lastMemoryDeck.length) {
    state = {
      page: "memory",
      rows: Number(memoryRowsInput.value),
      cols: Number(memoryColsInput.value),
      deck: lastMemoryDeck,
    };
  }

  if (!state) {
    setShareStatus("请先在当前页面生成宫格后再创建分享链接。", true);
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("state", encodeShareState(state));
  shareLinkInput.value = url.toString();
  setShareStatus("分享链接已生成，可直接发送给他人。", false);
}

async function copyShareLink() {
  const text = shareLinkInput.value.trim();
  if (!text) {
    setShareStatus("没有可复制的链接，请先生成分享链接。", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setShareStatus("分享链接已复制。", false);
  } catch (error) {
    setShareStatus("复制失败，请手动长按输入框复制。", true);
  }
}

function loadStateFromQuery() {
  const url = new URL(window.location.href);
  const encoded = url.searchParams.get("state");
  if (!encoded) {
    return;
  }

  try {
    const state = decodeShareState(encoded);
    const rows = Number(state.rows);
    const cols = Number(state.cols);

    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
      throw new Error("行列参数无效");
    }

    // 锁定为分享视图，禁用生成与页面切换（先置标志以避免在构建时显示分享提示）
    isSharedView = true;
    sharedPage = state.page;
    try {
      buildGridBtn.disabled = true;
      buildMemoryGridBtn.disabled = true;
      rowsInput.disabled = true;
      colsInput.disabled = true;
      memoryRowsInput.disabled = true;
      memoryColsInput.disabled = true;
      toBuilderPageBtn.disabled = true;
      toMemoryPageBtn.disabled = true;
      // 分享页面直接隐藏生成按钮
      try { buildGridBtn.style.display = 'none'; } catch (e) {}
      try { buildMemoryGridBtn.style.display = 'none'; } catch (e) {}
    } catch (e) {
      // ignore if elements missing
    }

    if (state.page === "memory") {
      memoryRowsInput.value = String(rows);
      memoryColsInput.value = String(cols);
      showPage("memory");
      buildMemoryGridWithDeck(rows, cols, state.deck);
    } else {
      rowsInput.value = String(rows);
      colsInput.value = String(cols);
      showPage("builder");
      buildBuilderGridWithDeck(rows, cols, state.deck);
    }

    shareLinkInput.value = window.location.href;
  } catch (error) {
    setShareStatus("分享链接解析失败，请重新生成。", true);
  }
}

async function init() {
  try {
    const raw = window.IMAGE_NAMES;
    if (!Array.isArray(raw)) {
      throw new Error("images-list.js 结构不是数组");
    }

    imageNames = raw.filter((name) => typeof name === "string" && name.trim() !== "");

    if (!imageNames.length) {
      setStatus("未读取到有效图片名称。", true);
      return;
    }

    setStatus(`图片清单加载成功：${imageNames.length} 张。`);
    buildGrid();
    updateFlipCountText();
    loadStateFromQuery();
    // 名称显示开关，默认关闭（隐藏名称）
    try {
      if (toggleNamesCheckbox) {
        // 默认 unchecked -> 隐藏名称
        toggleNamesCheckbox.checked = false;
        toggleNamesCheckbox.addEventListener('change', (e) => applyNameToggle(e.target.checked));
        applyNameToggle(toggleNamesCheckbox.checked);
      } else {
        // ensure hidden by default
        applyNameToggle(false);
      }
    } catch (e) {
      // ignore
    }
    // 绑定 loading overlay 的手动关闭按钮
    try {
      if (loadingCloseBtn) {
        loadingCloseBtn.addEventListener('click', () => {
          hideLoadingOverlay();
          setMemoryStatus('已手动关闭加载遮罩（可能部分图片未加载完成）。');
        });
      }
      if (loadingOverlay) {
        loadingOverlay.addEventListener('click', (event) => {
          if (event.target === loadingOverlay) {
            hideLoadingOverlay();
            setMemoryStatus('已手动关闭加载（点击背景关闭）。');
          }
        });
      }
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && memoryLoading) {
          hideLoadingOverlay();
          setMemoryStatus('已手动关闭加载（Esc）。');
        }
      });
    } catch (e) {
      // ignore
    }
  } catch (error) {
    setStatus(`加载图片清单失败：${error.message}。请确认 images-list.js 存在。`, true);
  }
}

buildGridBtn.addEventListener("click", buildGrid);
highlightBtn.addEventListener("click", applyHighlight);
clearHighlightBtn.addEventListener("click", clearHighlight);
toBuilderPageBtn.addEventListener("click", () => showPage("builder"));
toMemoryPageBtn.addEventListener("click", () => showPage("memory"));
buildMemoryGridBtn.addEventListener("click", buildMemoryGrid);
makeShareLinkBtn.addEventListener("click", makeShareLink);
copyShareLinkBtn.addEventListener("click", copyShareLink);

nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    applyHighlight();
  }
});

init();
