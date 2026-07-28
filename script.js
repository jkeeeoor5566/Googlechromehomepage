// ========== DOM 引用 ==========
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchTip = document.getElementById('searchTip');
const wallpaperImage = document.getElementById('wallpaperImage');
const wallpaperVideo = document.getElementById('wallpaperVideo');
const wallpaperFile = document.getElementById('wallpaperFile');
const tabsList = document.getElementById('tabsList');
const addTabModal = document.getElementById('addTabModal');
const confirmAddTab = document.getElementById('confirmAddTab');
const closeModal = document.getElementById('closeModal');
const tabName = document.getElementById('tabName');
const tabUrl = document.getElementById('tabUrl');
const importFile = document.getElementById('importFile');

// ===== 图标设置相关 DOM =====
const iconSettingsModal = document.getElementById('iconSettingsModal');
const iconSettingList = document.getElementById('iconSettingList');
const addIconRowBtn = document.getElementById('addIconRowBtn');
const iconFileInput = document.getElementById('iconFileInput');

// 存储键
const ICON_SETTINGS_KEY = 'iconSettings';

// ========== 1. 必应搜索 ==========
function searchBing() {
  const query = searchInput.value.trim();
  searchTip.textContent = '';
  searchTip.style.opacity = '0';
  if (!query) {
    searchTip.textContent = '输入框内容空白';
    searchTip.style.opacity = '1';
    setTimeout(() => searchTip.style.opacity = '0', 3000);
    return;
  }
  const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}`;
  if (chrome && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.update(tabs[0].id, { url: url });
      } else {
        window.location.href = url;
      }
    });
  } else {
    window.location.href = url;
  }
}

searchBtn.addEventListener('click', searchBing);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchBing();
  }
});

// ========== 2. 壁纸系统 ==========
const DB_NAME = 'WallpaperDB';
const STORE_NAME = 'wallpapers';
const VIDEO_KEY = 'videoData';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function storeVideoData(arrayBuffer, mimeType) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id: VIDEO_KEY, buffer: arrayBuffer, mimeType: mimeType || 'video/mp4' });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getVideoData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(VIDEO_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteVideoData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(VIDEO_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function showImageWallpaper(dataUrl) {
  wallpaperImage.style.backgroundImage = `url('${dataUrl}')`;
  wallpaperImage.classList.add('active');
  wallpaperVideo.classList.remove('active');
  wallpaperVideo.pause();
  localStorage.setItem('wallpaperType', 'image');
  localStorage.setItem('customWallpaper', dataUrl);
  localStorage.removeItem('videoWallpaper');
}

function showVideoWallpaper(url) {
  wallpaperVideo.preload = 'metadata';
  wallpaperVideo.decoding = 'sync';
  wallpaperVideo.src = url;
  wallpaperVideo.load();
  wallpaperVideo.play().catch(() => {});
  wallpaperVideo.classList.add('active');
  wallpaperImage.classList.remove('active');
  wallpaperImage.style.backgroundImage = 'none';
  localStorage.setItem('wallpaperType', 'video');
  localStorage.setItem('videoWallpaper', url);
  localStorage.removeItem('customWallpaper');
}

async function loadSavedWallpaper() {
  const type = localStorage.getItem('wallpaperType');
  if (type === 'video') {
    const videoData = await getVideoData();
    if (videoData) {
      const blob = new Blob([videoData.buffer], { type: videoData.mimeType });
      const url = URL.createObjectURL(blob);
      showVideoWallpaper(url);
    }
  } else if (type === 'image') {
    const dataUrl = localStorage.getItem('customWallpaper');
    if (dataUrl) showImageWallpaper(dataUrl);
  }
}

// 更换壁纸（触发文件选择）
function triggerWallpaperFile() {
  wallpaperFile.click();
}

wallpaperFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      showImageWallpaper(ev.target.result);
      deleteVideoData().catch(() => {});
    };
    reader.readAsDataURL(file);
    return;
  }
  if (file.type.startsWith('video/')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      await storeVideoData(arrayBuffer, file.type);
      const blob = new Blob([arrayBuffer], { type: file.type });
      showVideoWallpaper(URL.createObjectURL(blob));
      localStorage.removeItem('customWallpaper');
    } catch (err) {
      alert('视频保存失败：' + err.message);
    }
    return;
  }
  alert('请选择图片或视频文件');
});

// ========== 3. 标签系统 ==========
const iconCache = new Map();

async function checkIconExists(name) {
  if (iconCache.has(name)) return iconCache.get(name);
  const url = chrome.runtime.getURL(`icon/${name}.png`);
  try {
    const resp = await fetch(url);
    const exists = resp.ok;
    iconCache.set(name, exists);
    return exists;
  } catch {
    iconCache.set(name, false);
    return false;
  }
}

async function loadTabs() {
  const tabs = JSON.parse(localStorage.getItem('customTabs') || '[]');
  const iconSettings = getIconSettings();
  tabsList.innerHTML = '';

  const namesToCheck = [];
  tabs.forEach(tab => {
    const matched = iconSettings.find(item => item.name === tab.name);
    if (!matched || !matched.dataUrl) {
      namesToCheck.push(tab.name);
    }
  });

  const existenceMap = new Map();
  if (namesToCheck.length > 0) {
    const results = await Promise.all(namesToCheck.map(name => checkIconExists(name)));
    namesToCheck.forEach((name, index) => {
      existenceMap.set(name, results[index]);
    });
  }

  tabs.forEach((tab, index) => {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';

    const iconContainer = document.createElement('div');
    iconContainer.className = 'tab-favicon';

    const matched = iconSettings.find(item => item.name === tab.name);
    if (matched && matched.dataUrl) {
      const img = document.createElement('img');
      img.src = matched.dataUrl;
      img.alt = tab.name;
      img.style.width = '65px';
      img.style.height = '65px';
      img.style.objectFit = 'contain';
      iconContainer.appendChild(img);
    } else if (existenceMap.get(tab.name)) {
      const img = document.createElement('img');
      img.src = chrome.runtime.getURL(`icon/${tab.name}.png`);
      img.alt = tab.name;
      img.style.width = '65px';
      img.style.height = '65px';
      img.style.objectFit = 'contain';
      iconContainer.appendChild(img);
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'fallback-icon';
      fallback.textContent = '🈁';
      fallback.style.display = 'flex';
      fallback.style.alignItems = 'center';
      fallback.style.justifyContent = 'center';
      fallback.style.width = '64px';
      fallback.style.height = '64px';
      fallback.style.fontSize = '60px';
      iconContainer.appendChild(fallback);
    }

    tabElement.appendChild(iconContainer);

    const nameSpan = document.createElement('div');
    nameSpan.className = 'tab-name';
    nameSpan.textContent = tab.name;
    tabElement.appendChild(nameSpan);

    tabElement.addEventListener('click', () => window.open(tab.url, '_blank'));
    tabElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTabContextMenu(e.clientX, e.clientY, index, tab.name);
    });
    tabsList.appendChild(tabElement);
  });
}

// ========== 4. 添加标签弹窗 ==========
function openAddTabModal() {
  addTabModal.style.display = 'flex';
  tabName.value = '';
  tabUrl.value = '';
}
closeModal.addEventListener('click', () => addTabModal.style.display = 'none');
addTabModal.addEventListener('click', (e) => {
  if (e.target === addTabModal) addTabModal.style.display = 'none';
});

confirmAddTab.addEventListener('click', async () => {
  const name = tabName.value.trim();
  const url = tabUrl.value.trim();
  if (!name || !url) { alert('请填写完整'); return; }
  try { new URL(url); } catch { alert('请输入有效URL'); return; }
  const tabs = JSON.parse(localStorage.getItem('customTabs') || '[]');
  tabs.push({ name, url });
  localStorage.setItem('customTabs', JSON.stringify(tabs));
  await loadTabs();
  addTabModal.style.display = 'none';
});

// ========== 5. 导出网址 ==========
function exportUrlsToHtml() {
  const tabs = JSON.parse(localStorage.getItem('customTabs') || '[]');
  if (!tabs.length) { alert('暂无标签可导出'); return; }

  function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  function getFaviconUrl2(url) {
    try {
      const urlObj = new URL(url);
      return `https://t1.gstatic.com/faviconV2?client=chrome&size=32&domain=${urlObj.hostname}`;
    } catch { return ''; }
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>我的书签</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{background:linear-gradient(145deg,#1e2b3c,#0f1724);font-family:system-ui,sans-serif}.container{max-width:900px;height:720px;margin:0 auto;background:rgba(255,255,255,0.1);backdrop-filter:blur(12px);border-radius:32px;box-shadow:0 20px 35px rgba(0,0,0,0.3);padding:30px}h1{text-align:center;color:#fff;font-size:2rem}.sub{text-align:center;color:#cbd5e6;padding-bottom:16px}.url-list{display:flex;flex-direction:column;gap:12px;width:100%;height:580px;overflow-y:auto;padding-right:4px}.url-list::-webkit-scrollbar{width:6px}.url-list::-webkit-scrollbar-track{background:rgba(0,0,0,0.08);border-radius:3px}.url-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.4);border-radius:3px}.url-item{background:rgba(255,255,255,0.95);border-radius:20px;display:flex;align-items:center;justify-content:space-between;padding:10px 16px 10px 20px;gap:12px;box-shadow:0 2px 6px rgba(0,0,0,0.1)}.url-item:hover{background:#fff;box-shadow:0 8px 18px rgba(0,0,0,0.15)}.link-area{display:flex;align-items:center;gap:16px;flex:1;overflow:hidden;cursor:pointer}.favicon{width:32px;height:32px;flex-shrink:0;background:#f1f5f9;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px}.favicon img{width:20px;height:20px;object-fit:contain}.link-info{flex:1;overflow:hidden}.link-name{font-weight:700;font-size:1rem;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.link-url{font-size:0.7rem;color:#4b5563;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.copy-btn{background:#e2e8f0;border:none;width:36px;height:36px;border-radius:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all .2s;color:#1e293b;flex-shrink:0}.copy-btn:hover{background:#cbd5e1;transform:scale(1.05)}.copy-btn.copied{background:#22c55e;color:#fff}footer{text-align:center;color:#9ca3af;font-size:.75rem;padding-top:20px}
@media (max-width:550px){.container{padding:20px 16px}.url-item{padding:8px 12px}.link-name{font-size:.9rem}.link-url{font-size:.65rem}}
</style>
</head>
<body>
<div class="container">
<h1>📋 西格莉卡标签</h1>
<div class="sub">共 ${tabs.length} 个书签 · 导出时间 ${new Date().toLocaleString()}</div>
<div class="url-list">
${tabs.map((tab, idx) => `
  <div class="url-item" data-url="${escapeHtml(tab.url)}">
    <div class="link-area" onclick="window.open('${escapeHtml(tab.url)}','_blank')">
      <div class="favicon"><img src="${getFaviconUrl2(tab.url)}" alt="favicon" onerror="this.style.display='none';this.parentElement.innerText='🌐';"></div>
      <div class="link-info"><div class="link-name">${escapeHtml(tab.name)}</div><div class="link-url">${escapeHtml(tab.url)}</div></div>
    </div>
    <button class="copy-btn" data-url="${escapeHtml(tab.url)}" title="复制网址">📋</button>
  </div>
`).join('')}
</div>
<footer>点击选项打开链接 · 点击右侧按钮复制网址</footer>
</div>
<script>
document.querySelectorAll('.copy-btn').forEach(btn=>{
  btn.addEventListener('click', async(e)=>{
    e.stopPropagation();
    const url=btn.getAttribute('data-url');
    if(!url)return;
    try{await navigator.clipboard.writeText(url);btn.innerHTML='✓';btn.classList.add('copied');setTimeout(()=>{btn.innerHTML='📋';btn.classList.remove('copied');},1500);}catch(err){alert('复制失败');}
  });
});
</script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `bookmarks_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function showExportConfirm() {
  document.getElementById('exportConfirmModal').style.display = 'flex';
}

document.getElementById('confirmExportBtn').addEventListener('click', () => {
  document.getElementById('exportConfirmModal').style.display = 'none';
  exportUrlsToHtml();
});
document.getElementById('cancelExportBtn').addEventListener('click', () => {
  document.getElementById('exportConfirmModal').style.display = 'none';
});
document.getElementById('exportConfirmModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});

// ========== 6. 导入网址 ==========
function triggerImportFile() {
  importFile.click();
}

importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const items = doc.querySelectorAll('.url-item');
    if (!items.length) {
      alert('未找到有效书签数据，请确保文件为导出的 HTML 格式。');
      importFile.value = '';
      return;
    }
    const newTabs = [];
    items.forEach(item => {
      const url = item.getAttribute('data-url');
      const nameEl = item.querySelector('.link-name');
      if (url && nameEl) {
        newTabs.push({ name: nameEl.textContent.trim(), url: url.trim() });
      }
    });
    if (!newTabs.length) {
      alert('未解析到任何书签。');
      importFile.value = '';
      return;
    }
    if (confirm(`将导入 ${newTabs.length} 个标签，当前所有标签将被替换。是否继续？`)) {
      localStorage.setItem('customTabs', JSON.stringify(newTabs));
      await loadTabs();
      alert(`成功导入 ${newTabs.length} 个标签！`);
    }
  } catch (err) {
    alert('读取文件失败：' + err.message);
  }
  importFile.value = '';
});

// ========== 7. 右键菜单 ==========
let activeContextMenu = null;
let contextMenuCloseHandler = null;

function removeContextMenu() {
  if (activeContextMenu) { activeContextMenu.remove(); activeContextMenu = null; }
  if (contextMenuCloseHandler) {
    document.removeEventListener('click', contextMenuCloseHandler);
    document.removeEventListener('contextmenu', contextMenuCloseHandler);
    contextMenuCloseHandler = null;
  }
}

function showTabContextMenu(x, y, tabIndex, tabName) {
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'custom-context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const pinItem = document.createElement('div');
  pinItem.className = 'menu-item selected';
  pinItem.innerHTML = `<i>📌</i> 置顶（移到首位）`;

  const renameItem = document.createElement('div');
  renameItem.className = 'menu-item';
  renameItem.innerHTML = `<i>✏️</i> 重命名`;

  const divider = document.createElement('div');
  divider.className = 'menu-divider';

  const deleteItem = document.createElement('div');
  deleteItem.className = 'menu-item';
  deleteItem.innerHTML = `<i>🗑️</i> 删除标签`;

  menu.appendChild(pinItem);
  menu.appendChild(renameItem);
  menu.appendChild(divider);
  menu.appendChild(deleteItem);

  pinItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    const tabs = JSON.parse(localStorage.getItem('customTabs') || '[]');
    if (tabIndex >= 0 && tabIndex < tabs.length) {
      const [movedTab] = tabs.splice(tabIndex, 1);
      tabs.unshift(movedTab);
      localStorage.setItem('customTabs', JSON.stringify(tabs));
      await loadTabs();
    }
    removeContextMenu();
  });

  renameItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    removeContextMenu();
    const newName = prompt('请输入新的标签名称：', tabName);
    if (newName && newName.trim() !== '') {
      const trimmed = newName.trim();
      const tabs = JSON.parse(localStorage.getItem('customTabs') || '[]');
      if (tabIndex >= 0 && tabIndex < tabs.length) {
        tabs[tabIndex].name = trimmed;
        localStorage.setItem('customTabs', JSON.stringify(tabs));
        await loadTabs();
      }
    }
  });

  deleteItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    removeContextMenu();
    if (confirm(`确定删除“${tabName}”标签吗？`)) {
      const tabs = JSON.parse(localStorage.getItem('customTabs') || '[]');
      tabs.splice(tabIndex, 1);
      localStorage.setItem('customTabs', JSON.stringify(tabs));
      await loadTabs();
    }
  });

  contextMenuCloseHandler = (event) => {
    if (menu.contains(event.target)) return;
    removeContextMenu();
  };
  setTimeout(() => {
    document.addEventListener('click', contextMenuCloseHandler);
    document.addEventListener('contextmenu', contextMenuCloseHandler);
  }, 10);

  document.body.appendChild(menu);
  activeContextMenu = menu;

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 10}px`;
  if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 10}px`;
}

// ========== 8. 图标设置功能 ==========
function getIconSettings() {
  try {
    return JSON.parse(localStorage.getItem(ICON_SETTINGS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveIconSettings(settings) {
  localStorage.setItem(ICON_SETTINGS_KEY, JSON.stringify(settings));
}

function renderIconSettings() {
  const settings = getIconSettings();
  iconSettingList.innerHTML = '';
  settings.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'icon-setting-row';
    row.dataset.index = index;

    const previewBtn = document.createElement('div');
    previewBtn.className = 'icon-preview-btn';
    previewBtn.title = '点击上传图标';
    if (item.dataUrl) {
      const img = document.createElement('img');
      img.src = item.dataUrl;
      img.alt = '图标';
      previewBtn.appendChild(img);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'icon-placeholder';
      placeholder.textContent = '+';
      previewBtn.appendChild(placeholder);
    }
    previewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      iconFileInput.dataset.targetIndex = index;
      iconFileInput.click();
    });

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'icon-row-name';
    input.placeholder = '标签名称';
    input.value = item.name || '';
    input.addEventListener('blur', async () => {
      const newName = input.value.trim();
      const settings = getIconSettings();
      if (settings[index]) {
        settings[index].name = newName;
        saveIconSettings(settings);
        await loadTabs();
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-row-delete';
    deleteBtn.textContent = '−';
    deleteBtn.title = '删除该行';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('确定要删除该图标设置吗？')) {
        const settings = getIconSettings();
        settings.splice(index, 1);
        saveIconSettings(settings);
        renderIconSettings();
        await loadTabs();
      }
    });

    row.appendChild(previewBtn);
    row.appendChild(input);
    row.appendChild(deleteBtn);
    iconSettingList.appendChild(row);
  });

  if (settings.length === 0) {
    const emptyTip = document.createElement('div');
    emptyTip.style.cssText = 'text-align:center; color:#64748b; font-size:14px; padding:16px 0;';
    emptyTip.textContent = '暂无图标设置，点击下方 + 添加';
    iconSettingList.appendChild(emptyTip);
  }
}

function openIconSettings() {
  iconSettingsModal.style.display = 'flex';
  renderIconSettings();
}

iconFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件');
    iconFileInput.value = '';
    return;
  }
  const index = parseInt(iconFileInput.dataset.targetIndex);
  if (isNaN(index) || index < 0) {
    alert('请先添加一行');
    iconFileInput.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const dataUrl = ev.target.result;
    const settings = getIconSettings();
    if (settings[index]) {
      settings[index].dataUrl = dataUrl;
      saveIconSettings(settings);
      renderIconSettings();
      await loadTabs();
    }
    iconFileInput.value = '';
  };
  reader.readAsDataURL(file);
});

addIconRowBtn.addEventListener('click', () => {
  const settings = getIconSettings();
  settings.push({ name: '', dataUrl: '' });
  saveIconSettings(settings);
  renderIconSettings();
  iconSettingList.scrollTop = iconSettingList.scrollHeight;
});

iconSettingsModal.addEventListener('click', (e) => {
  if (e.target === iconSettingsModal) iconSettingsModal.style.display = 'none';
});

// ========== 9. 设置下拉菜单事件绑定 ==========
document.querySelectorAll('.dropdown-item').forEach(item => {
  item.addEventListener('click', (e) => {
    const action = item.dataset.action;
    switch (action) {
      case 'addTab':
        openAddTabModal();
        break;
      case 'changeWallpaper':
        triggerWallpaperFile();
        break;
      case 'exportUrls':
        showExportConfirm();
        break;
      case 'importUrls':
        triggerImportFile();
        break;
      case 'iconSettings':
        openIconSettings();
        break;
    }
  });
});

// ========== 10. 初始化 ==========
window.addEventListener('load', async () => {
  await loadSavedWallpaper();
  await loadTabs();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      wallpaperVideo.pause();
    } else {
      if (localStorage.getItem('wallpaperType') === 'video' && wallpaperVideo.classList.contains('active')) {
        wallpaperVideo.play().catch(() => {});
      }
    }
  });
});