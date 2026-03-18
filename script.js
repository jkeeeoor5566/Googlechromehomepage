// DOM元素
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const changeWallpaperBtn = document.getElementById('changeWallpaperBtn');
const wallpaperFile = document.getElementById('wallpaperFile');
const wallpaper = document.querySelector('.wallpaper');
const addTabBtn = document.getElementById('addTabBtn');
const tabsList = document.getElementById('tabsList');
const addTabModal = document.getElementById('addTabModal');
const confirmAddTab = document.getElementById('confirmAddTab');
const closeModal = document.getElementById('closeModal');
const tabName = document.getElementById('tabName');
const tabUrl = document.getElementById('tabUrl');
const tabColor = document.getElementById('tabColor');

// 必应搜索功能
function searchBing() {
  const query = searchInput.value.trim();
  const tip = document.getElementById('searchTip');
  tip.textContent = '';
  tip.style.opacity = '0';
  if (!query) {
    tip.textContent = '输入框内容空白';
    tip.style.opacity = '1';
    setTimeout(() => tip.style.opacity = '0', 3000);
    return;
  }
  window.open(`https://cn.bing.com/search?q=${encodeURIComponent(query)}`, '_self');
}

searchBtn.addEventListener('click', searchBing);
searchInput.addEventListener('keydown', (e) => e.key === 'Enter' && searchBing());

// 本地壁纸功能（无在线壁纸逻辑）
// 点击按钮触发本地文件选择
changeWallpaperBtn.addEventListener('click', () => {
  wallpaperFile.click();
});

// 选择本地图片后设置为壁纸并保存
wallpaperFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // 仅允许图片文件
  if (!file.type.startsWith('image/')) {
    alert('请选择图片格式文件（JPG、PNG、WEBP等）');
    return;
  }

  // 以base64格式读取图片（本地存储，无网络依赖）
  const reader = new FileReader();
  reader.onload = (event) => {
    const localImageUrl = event.target.result;
    wallpaper.style.backgroundImage = `url('${localImageUrl}')`;
    localStorage.setItem('customWallpaper', localImageUrl); // 保存到本地
  };
  reader.readAsDataURL(file);
});

// 页面加载时读取保存的本地壁纸（无默认在线图片）
window.addEventListener('load', () => {
  const savedWallpaper = localStorage.getItem('customWallpaper');
  if (savedWallpaper) {
    wallpaper.style.backgroundImage = `url('${savedWallpaper}')`;
  }
  loadTabs(); // 加载自定义标签
});

// 标签相关功能（无修改）
function loadTabs() {
  const tabs = JSON.parse(localStorage.getItem('customTabs') || '[]');
  tabsList.innerHTML = '';
  tabs.forEach((tab, index) => {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.innerHTML = `<span>${tab.name}</span>`;
    // 点击跳转链接
    tabElement.addEventListener('click', () => window.open(tab.url, '_blank'));
    // 右键删除标签
    tabElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm(`确定删除"${tab.name}"标签？`)) {
        tabs.splice(index, 1);
        localStorage.setItem('customTabs', JSON.stringify(tabs));
        loadTabs();
      }
    });
    tabsList.appendChild(tabElement);
  });
}

// 弹窗控制
addTabBtn.addEventListener('click', () => {
  addTabModal.style.display = 'flex';
  tabName.value = '';
  tabUrl.value = '';
});

closeModal.addEventListener('click', () => {
  addTabModal.style.display = 'none';
});

addTabModal.addEventListener('click', (e) => {
  if (e.target === addTabModal) addTabModal.style.display = 'none';
});

// 添加标签
confirmAddTab.addEventListener('click', () => {
  const name = tabName.value.trim();
  const url = tabUrl.value.trim();
  if (!name || !url) {
    alert('请填写完整标签名称和链接');
    return;
  }
  // 验证URL有效性
  try {
    new URL(url);
  } catch (e) {
    alert('请输入有效的URL（以http://或https://开头）');
    return;
  }
  const tabs = JSON.parse(localStorage.getItem('customTabs') || '[]');
  tabs.push({ name, url });
  localStorage.setItem('customTabs', JSON.stringify(tabs));
  loadTabs();
  addTabModal.style.display = 'none';
});

