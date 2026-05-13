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
const flipCountEl = document.getElementById("flipCount");
const toggleNamesCheckbox = document.getElementById("toggleNames");
const appRoot = document.querySelector('.app');
const generationBadge = document.getElementById("generationBadge");
const generationTimeExact = document.getElementById("generationTimeExact");
const generationTimeRelative = document.getElementById("generationTimeRelative");
const preloadBtn = document.getElementById('preloadBtn');
const clearCacheBtn = document.getElementById('clearCacheBtn');

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
let memoryLoading = false;
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingCloseBtn = document.getElementById('loadingCloseBtn');
const loadingTextEl = document.getElementById('loadingText');
const LOADING_TIMEOUT_MS = 10000; // 超时（毫秒），到时自动关闭遮罩
let loadingTimeout = null;
let lastGeneratedAt = null;
let generationBadgeTimer = null;
const BINGO_COLORS = ['大红','金','紫','蓝','白'];

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

function formatGenerationTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const millis = String(date.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${millis}`;
}

function formatRelativeGenerationTime(date) {
  const diff = Date.now() - date.getTime();
  if (diff < 1000) {
    return "刚刚生成";
  }

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) {
    return `${seconds} 秒前`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} 小时前`;
  }

  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

function updateGenerationBadge() {
  if (!generationBadge || !generationTimeExact || !generationTimeRelative || !lastGeneratedAt) {
    return;
  }

  generationBadge.hidden = false;
  generationTimeExact.textContent = `生成时间 ${formatGenerationTime(lastGeneratedAt)}`;
  generationTimeRelative.textContent = formatRelativeGenerationTime(lastGeneratedAt);
}

function markGeneratedNow() {
  lastGeneratedAt = new Date();
  updateGenerationBadge();

  if (generationBadgeTimer) {
    clearInterval(generationBadgeTimer);
  }

  generationBadgeTimer = setInterval(updateGenerationBadge, 1000);
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

function createCell(item, index) {
  // item 可以是字符串（旧格式）或对象 { rawName, src }
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  const image = node.querySelector(".thumb");
  const name = node.querySelector(".name");

  const rawName = typeof item === 'string' ? item : (item.rawName || item.name || '');
  node.dataset.name = rawName;
  node.dataset.index = String(index);
  node.style.animationDelay = `${Math.min(index * 18, 500)}ms`;

  const src = (typeof item === 'string') ? toImagePath(item) : (item.src || toImagePath(rawName));
  image.src = src;
  image.alt = rawName;

  image.addEventListener("error", () => {
    image.alt = `加载失败: ${rawName}`;
    image.removeAttribute("src");
  });

  name.textContent = stripExtension(rawName);

  node.addEventListener("click", () => {
    node.classList.toggle("active");
    updateLineStateAndNotify();
    setStatus(`手动切换高亮。${getLineHintText()}`);
  });

  return node;
}

function buildBuilderGridWithDeck(rows, cols, deck) {
  const total = rows * cols;
  if (!Array.isArray(deck) || deck.length < total) {
    setStatus("宫格数据长度不匹配或可用图片不足。", true);
    return;
  }

  const fragment = document.createDocumentFragment();

  currentRows = rows;
  currentCols = cols;
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  deck.slice(0, total).forEach((item, i) => {
    fragment.append(createCell(item, i));
  });

  grid.append(fragment);
  lastLineSuccess = false;
  setStatus(`bingo 已生成：${rows} x ${cols}（共 ${total} 格）。${getLineHintText()}`);
  markGeneratedNow();
}

async function findImagePathForNameAndColors(name, colors) {
  // 返回第一个能加载成功的路径（尝试颜色文件夹），失败返回 null
  if (!name) return null;
  const candidates = [];
  const encodedName = encodeURIComponent(name);
  for (const color of colors) {
    // 尝试多种路径形式：raw color/raw name, raw color/encoded name,
    // encoded color/raw name, encoded color/encoded name
    const rawColor = color;
    const encColor = encodeURIComponent(color);
    // 先尝试根目录下的颜色文件夹（例如 大红/文件.png），再尝试 图片/颜色/文件.png
    candidates.push(`${rawColor}/${name}`);
    candidates.push(`${rawColor}/${encodedName}`);
    candidates.push(`${encColor}/${name}`);
    candidates.push(`${encColor}/${encodedName}`);
    candidates.push(`${IMAGE_DIR}/${rawColor}/${name}`);
    candidates.push(`${IMAGE_DIR}/${rawColor}/${encodedName}`);
    candidates.push(`${IMAGE_DIR}/${encColor}/${name}`);
    candidates.push(`${IMAGE_DIR}/${encColor}/${encodedName}`);
  }

  // 去重
  const uniq = Array.from(new Set(candidates));

  for (const path of uniq) {
    // 尝试加载图片，短超时（使用相对路径以兼容 GitHub Pages 子路径）
    // eslint-disable-next-line no-await-in-loop
    const tryPath = path; // 保持相对路径，不强制前导斜杠
    const ok = await new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const onOk = () => { if (!done) { done = true; resolve(true); } };
      const onErr = () => { if (!done) { done = true; resolve(false); } };
      img.onload = onOk;
      img.onerror = onErr;
      setTimeout(() => { if (!done) { done = true; resolve(false); } }, 1200);
      img.src = tryPath;
    });
    if (ok) return path;
  }

  return null;
}

async function preloadAllColors() {
  if (!Array.isArray(imageNames) || !imageNames.length) {
    setStatus('图片清单为空，无法预加载。', true);
    return;
  }

  // 等待 service worker 就绪（若有）以便命中缓存
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.ready; } catch (e) { /* ignore */ }
  }

  showLoadingOverlay();
  if (loadingTextEl) loadingTextEl.textContent = '开始预加载所有颜色图片...';
  setStatus('已开始后台预加载（进度显示在加载遮罩中）。');

  const colors = BINGO_COLORS;
  const total = colors.length * imageNames.length;
  let doneCount = 0;

  const concurrency = 12;
  const tasks = [];
  for (const color of colors) {
    for (const name of imageNames) {
      const enc = encodeURIComponent(name);
      const cand = [
        `${color}/${name}`,
        `${color}/${enc}`,
        `${enc}/${name}`,
        `${IMAGE_DIR}/${color}/${name}`,
        `${IMAGE_DIR}/${color}/${enc}`,
      ];
      tasks.push(cand);
    }
  }

  async function fetchCandidates(candidates) {
    for (const p of candidates) {
      try {
        // 尝试普通 fetch（允许跨域由浏览器控制），这里不等待响应体
        fetch(p).catch(() => {});
        break;
      } catch (e) {
        // ignore
      }
    }
    doneCount += 1;
    if (loadingTextEl) loadingTextEl.textContent = `预加载进度：${doneCount}/${total}`;
  }

  // 并发执行
  while (tasks.length) {
    const batch = tasks.splice(0, concurrency);
    await Promise.all(batch.map(c => fetchCandidates(c)));
  }

  hideLoadingOverlay();
  setStatus(`预加载完成（触发请求 ${total} 次，实际可用项由浏览器/Service Worker 决定）。`);
}

async function clearImageCache() {
  setStatus('正在清空图片缓存...');
  try {
    // 尝试通过 SW 收到消息后清理
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ action: 'clear-cache' });
    } else if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.active) reg.active.postMessage({ action: 'clear-cache' });
    }
    // 也尝试直接清除 CacheStorage（主线程）以防 SW 未响应
    if (window.caches && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    setStatus('已清空图片缓存。');
  } catch (e) {
    setStatus('清空图片缓存失败，请查看控制台。', true);
    console.warn('clearImageCache error', e);
  }
}

async function buildGrid() {
  try {
    setStatus('正在生成 bingo，请稍候...');
  } catch (e) {}
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
  const colorCheckboxes = Array.from(document.querySelectorAll('.color-checkbox'));
  let selectedColors = colorCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
  if (!selectedColors.length) selectedColors = ['大红'];

  showLoadingOverlay();
  if (loadingTextEl) loadingTextEl.textContent = '正在为 bingo 查找图片...';
  const deck = [];
  const used = new Set();
  // 为了性能，从随机化的 imageNames 中尝试填满 deck
  const pool = shuffledCopy(imageNames);
  let attempts = 0;
  while (deck.length < total && attempts < imageNames.length * 3) {
    attempts += 1;
    if (!pool.length) {
      pool.push(...shuffledCopy(imageNames));
    }
    const candidate = pool.pop();
    if (used.has(candidate)) continue;
    // 尝试在所选颜色文件夹中寻找图片
    // findImagePathForNameAndColors 会返回第一个存在的颜色路径
    // 若找不到则跳过，避免用错颜色
    // 允许较短超时时间
    // eslint-disable-next-line no-await-in-loop
    let path = null;
    try {
      // eslint-disable-next-line no-await-in-loop
      path = await findImagePathForNameAndColors(candidate, selectedColors);
    } catch (e) {
      console.warn('probe path failed', candidate, e);
      path = null;
    }
    if (path) {
      deck.push({ rawName: candidate, src: path });
      used.add(candidate);
    }
  }

  // 当找到的可用图片不足时，允许重复使用已找到的图片以填满 bingo
  if (deck.length < total) {
    if (deck.length === 0) {
      hideLoadingOverlay();
      setStatus('所选颜色文件夹中没有可用图片，请检查文件夹或选择其他颜色。', true);
      return;
    }
    // 允许重复：从已找到的候选中随机采样以补齐
    while (deck.length < total) {
      const pick = deck[Math.floor(Math.random() * deck.length)];
      deck.push({ rawName: pick.rawName, src: pick.src });
    }
  }

  hideLoadingOverlay();
  try {
    buildBuilderGridWithDeck(rows, cols, deck);
  } catch (e) {
    console.error('buildBuilderGridWithDeck error', e);
    setStatus('生成 bingo 时发生错误，请查看控制台。', true);
  }
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

  // 点击本轮第一张牌时就计为一次翻牌
  if (memoryOpenedCards.length === 1) {
    memoryFlipCount += 1;
    updateFlipCountText();
  }

  if (memoryOpenedCards.length < 2) {
    return;
  }

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
    setMemoryStatus("翻牌宫格数据长度不匹配。", true);
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
  memoryLock = false;
  memoryOpenedCards = [];
  memoryMatchedCount = 0;
  memoryTotalCards = total;
  memoryFlipCount = 0;
  updateFlipCountText();
  setMemoryStatus(`正在加载图片：${rows} x ${cols}（共 ${total} 格），请稍候…`);
  markGeneratedNow();
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
    // 不在初始化时自动生成翻牌或 bingo，等待用户手动点击生成
    updateFlipCountText();
    // 默认启动：预加载所有颜色图片并缓存（在 Service Worker 就绪后运行）
    try { preloadAllColors().catch(() => {}); } catch (e) { /* ignore */ }
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

buildGridBtn.addEventListener("click", () => { buildGridBtn.disabled = true; buildGrid().finally(() => { buildGridBtn.disabled = false; }); });
highlightBtn.addEventListener("click", applyHighlight);
clearHighlightBtn.addEventListener("click", clearHighlight);
toBuilderPageBtn.addEventListener("click", () => showPage("builder"));
toMemoryPageBtn.addEventListener("click", () => showPage("memory"));
buildMemoryGridBtn.addEventListener("click", buildMemoryGrid);
if (preloadBtn) preloadBtn.addEventListener('click', () => { preloadBtn.disabled = true; preloadAllColors().finally(() => { preloadBtn.disabled = false; }); });
if (clearCacheBtn) clearCacheBtn.addEventListener('click', () => { clearCacheBtn.disabled = true; clearImageCache().finally(() => { clearCacheBtn.disabled = false; }); });

nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    applyHighlight();
  }
});

init();
// Register service worker for image caching (stale-while-revalidate)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then((reg) => {
      console.log('ServiceWorker registered', reg);
      setStatus('已启用图片离线缓存（Service Worker）。');
    })
    .catch((err) => {
      console.warn('ServiceWorker register failed', err);
    });
}
