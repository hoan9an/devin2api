// ============================================================

// 共享UI：顶部导航与背景动画（KISS/DRY）

// 使用方式：在页面底部引入本文件，并调用 initTopbar('index'|'configs'|'stats'|'trend'|'errors')

// ============================================================

(function () {

  const NAVS = [

    { key: 'index', labelKey: 'nav.overview', href: '/web/index.html', icon: iconHome },

    { key: 'logs', labelKey: 'nav.logs', href: '/web/logs.html', icon: iconAlert, group: 'observe' },

    { key: 'stats', labelKey: 'nav.stats', href: '/web/stats.html', icon: iconBars, group: 'observe' },

    { key: 'trend', labelKey: 'nav.trend', href: '/web/trend.html', icon: iconTrend, group: 'observe' },

    { key: 'tokens', labelKey: 'nav.tokens', href: '/web/tokens.html', icon: iconKey, group: 'manage' },

    { key: 'models', labelKey: 'nav.models', href: '/web/models.html', icon: iconLayers, group: 'manage' },

    { key: 'accounts', labelKey: 'nav.accounts', href: '/web/accounts.html', icon: iconUsers, group: 'manage' },

    { key: 'settings', labelKey: 'nav.settings', href: '/web/settings.html', icon: iconSettings, group: 'manage' },

  ];

  // 分组标题（i18n key）——按代理网关语义分：监控 / 管理
  const NAV_GROUPS = [

    { key: 'observe', labelKey: 'nav.group.observe' },

    { key: 'manage', labelKey: 'nav.group.manage' },

  ];

  const THEME_STORAGE_KEY = 'ccload_theme';

  const THEME_MODES = ['system', 'light', 'dark'];

  let systemThemeQuery = null;

  let currentThemeMode = 'system';



  function h(tag, attrs = {}, children = []) {

    const el = document.createElement(tag);

    Object.entries(attrs).forEach(([k, v]) => {

      if (k === 'class') el.className = v;

      else if (k === 'style') el.style.cssText = v;

      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);

      else el.setAttribute(k, v);

    });

    (Array.isArray(children) ? children : [children]).forEach((c) => {

      if (c == null) return;

      if (typeof c === 'string') el.appendChild(document.createTextNode(c));

      else el.appendChild(c);

    });

    return el;

  }



  // 导航/主题图标统一取 Lucide path（ui-format.js 的 ICON_PATHS 同一套源）

  function iconHome() {

    return svg(window.ICON_PATHS['layout-dashboard']);

  }

  function iconSettings() {

    return svg(window.ICON_PATHS['settings']);

  }

  function iconBars() {

    return svg(window.ICON_PATHS['chart-column']);

  }

  function iconTrend() {

    return svg(window.ICON_PATHS['trending-up']);

  }

  function iconAlert() {

    return svg(window.ICON_PATHS['scroll-text']);

  }

  function iconKey() {

    return svg(window.ICON_PATHS['key-round']);

  }

  function iconLayers() {

    return svg(window.ICON_PATHS['layers']);

  }

  function iconUsers() {

    return svg(window.ICON_PATHS['users']);

  }

  function iconThemeSystem() {

    return svg(window.ICON_PATHS['monitor']);

  }

  function iconThemeLight() {

    return svg(window.ICON_PATHS['sun']);

  }

  function iconThemeDark() {

    return svg(window.ICON_PATHS['moon']);

  }

  function svg(inner) {

    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    el.setAttribute('fill', 'none');

    el.setAttribute('stroke', 'currentColor');

    el.setAttribute('viewBox', '0 0 24 24');

    el.classList.add('w-5', 'h-5');

    el.innerHTML = inner;

    return el;

  }



  function getStoredTheme() {

    if (window.ccLoadTheme && typeof window.ccLoadTheme.getStoredTheme === 'function') {

      return window.ccLoadTheme.getStoredTheme();

    }

    try {

      const saved = localStorage.getItem(THEME_STORAGE_KEY);

      const mode = typeof saved === 'string' ? saved.split(':', 1)[0] : null;

      return THEME_MODES.includes(mode) ? mode : 'dark';

    } catch (_) {

      return 'dark';

    }

  }



  function resolveTheme(mode) {

    if (mode !== 'system') return mode;

    return systemThemeQuery && systemThemeQuery.matches ? 'dark' : 'light';

  }



  function setThemeMetaColor(resolvedTheme) {

    const meta = document.querySelector('meta[name="theme-color"]');

    if (meta) meta.setAttribute('content', resolvedTheme === 'dark' ? '#11120f' : '#b87333');

  }



  function getThemeCssVar(style, name, fallback) {

    const value = style ? style.getPropertyValue(name).trim() : '';

    return value || fallback;

  }



  function getChartTheme() {

    const root = document.documentElement;

    const style = window.getComputedStyle ? getComputedStyle(root) : null;

    const resolvedTheme = root.dataset.resolvedTheme || root.dataset.theme || 'light';

    const isDark = resolvedTheme === 'dark';



    return {

      text: getThemeCssVar(style, '--neutral-700', isDark ? '#e5e7eb' : '#374151'),

      mutedText: getThemeCssVar(style, '--neutral-500', isDark ? '#9ca3af' : '#6b7280'),

      strongText: getThemeCssVar(style, '--neutral-900', isDark ? '#f9fafb' : '#111827'),

      axisLine: getThemeCssVar(style, '--surface-border-strong', isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(17, 24, 39, 0.16)'),

      splitLine: getThemeCssVar(style, '--surface-border', isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(17, 24, 39, 0.10)'),

      surface: getThemeCssVar(style, '--surface-bg-strong', isDark ? 'rgba(17, 24, 39, 0.94)' : 'rgba(255, 255, 255, 0.98)'),

      surfaceMuted: getThemeCssVar(style, '--surface-bg-muted', isDark ? 'rgba(31, 41, 55, 0.78)' : 'rgba(243, 244, 246, 0.90)'),

      tooltipBg: getThemeCssVar(style, '--surface-bg-strong', isDark ? 'rgba(17, 24, 39, 0.94)' : 'rgba(255, 255, 255, 0.98)'),

      tooltipBorder: getThemeCssVar(style, '--surface-border-strong', isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(17, 24, 39, 0.16)'),

      tooltipText: getThemeCssVar(style, '--neutral-900', isDark ? '#f9fafb' : '#111827')

    };

  }



  function refreshThemeSwitcher(root = document) {

    const trigger = root.querySelector ? root.querySelector('.theme-trigger') : null;

    if (trigger) {

      trigger.replaceChildren(getThemeIcon(currentThemeMode));

    }

    root.querySelectorAll && root.querySelectorAll('.theme-option').forEach((option) => {

      const active = option.getAttribute('data-theme-mode') === currentThemeMode;

      option.setAttribute('aria-pressed', active ? 'true' : 'false');

      option.classList.toggle('active', active);

    });

  }



  function applyThemeMode(mode) {

    currentThemeMode = THEME_MODES.includes(mode) ? mode : 'system';

    const resolvedTheme = resolveTheme(currentThemeMode);

    document.documentElement.dataset.theme = currentThemeMode;

    document.documentElement.dataset.resolvedTheme = resolvedTheme;

    document.documentElement.style.colorScheme = resolvedTheme;

    setThemeMetaColor(resolvedTheme);

    refreshThemeSwitcher();

    window.dispatchEvent(new CustomEvent('ccload:themechange', {

      detail: { mode: currentThemeMode, resolvedTheme }

    }));

  }



  function applyStoredTheme() {

    applyThemeMode(getStoredTheme());

  }



  function setThemeMode(mode) {

    if (!THEME_MODES.includes(mode)) return;

    if (window.ccLoadTheme && typeof window.ccLoadTheme.setStoredTheme === 'function') {

      window.ccLoadTheme.setStoredTheme(mode);

    } else {

      try {

        localStorage.setItem(THEME_STORAGE_KEY, `${mode}:${Date.now()}`);

      } catch (_) { /* 存储失败时只应用当前页面 */ }

    }

    applyThemeMode(mode);

  }



  function initTheme() {

    systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    applyStoredTheme();

    if (systemThemeQuery && !systemThemeQuery._ccloadThemeBound) {

      systemThemeQuery.addEventListener('change', applyStoredTheme);

      systemThemeQuery._ccloadThemeBound = true;

    }

  }



  function setThemeSwitcherOpen(switcher, open) {

    if (!switcher) return;

    if (open) switcher.classList.add('open');

    else switcher.classList.remove('open');

    const trigger = switcher.querySelector('.theme-trigger');

    if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');

  }



  function closeThemeSwitchers(except = null) {

    document.querySelectorAll('.theme-switcher.open').forEach((switcher) => {

      if (switcher !== except) setThemeSwitcherOpen(switcher, false);

    });

  }



  initTheme();

  document.addEventListener('click', () => closeThemeSwitchers());



  function isLoggedIn() {

    const token = localStorage.getItem('ccload_token');

    const expiry = localStorage.getItem('ccload_token_expiry');

    return token && (!expiry || Date.now() <= parseInt(expiry));

  }



  // GitHub仓库地址

  const GITHUB_REPO_URL = 'https://github.com/WncFht/devin2api';

  const GITHUB_RELEASES_URL = 'https://github.com/WncFht/devin2api/releases';



  // 版本信息

  let versionInfo = null;



  // 获取版本信息（后端已包含新版本检测结果）

  async function fetchVersionInfo() {

    try {

      const res = await fetch('/public/version');

      const resp = await res.json();

      versionInfo = resp.data;

      return versionInfo;

    } catch (e) {

      console.error('Failed to fetch version info:', e);

      return null;

    }

  }



  // 更新版本显示

  function updateVersionDisplay() {

    const versionEl = document.getElementById('version-display');

    const badgeEl = document.getElementById('version-badge');

    if (!versionInfo) return;



    if (versionEl) {

      versionEl.textContent = versionInfo.version;

    }

    if (badgeEl) {

      if (versionInfo.has_update && versionInfo.latest_version) {

        badgeEl.title = t('version.hasUpdate', { version: versionInfo.latest_version });

        badgeEl.classList.add('has-update');

      } else {

        badgeEl.title = t('version.checkUpdate');

        badgeEl.classList.remove('has-update');

      }

    }

  }



  // 初始化版本显示

  function initVersionDisplay() {

    fetchVersionInfo().then(() => updateVersionDisplay());

  }



  // GitHub图标

  function iconGitHub() {

    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    el.setAttribute('fill', 'currentColor');

    el.setAttribute('viewBox', '0 0 24 24');

    el.classList.add('w-5', 'h-5');

    el.innerHTML = '<path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>';

    return el;

  }





  // ---- 活动请求指示器（favicon 角标 + 标题闪烁）----
  // 全站唯一轮询源：拉取完整 payload 后自己消费 count，同时推送 data 给订阅者（如 logs.js）

  const ACTIVE_POLL_MS = 2000;
  const ACTIVE_TITLE_FLASH_MS = 900;

  let activeTimer = null;
  let faviconBaseImg = null;
  let origFavicons = null;
  let lastBadgeCount = -1;
  let faviconPulseOn = false;
  let activeCount = 0;
  const activeDataListeners = [];
  let lastActiveData = null;
  let titleBase = '';
  let titleFlashTimer = null;
  let titleFlashVisible = false;
  let titleFlashEnabled = false;

  function snapshotFavicons() {
    if (origFavicons) return;
    origFavicons = Array.from(document.querySelectorAll('link[rel~="icon"]'))
      .filter((link) => link.dataset.dynamicFavicon !== '1')
      .map((link) => ({
        rel: link.getAttribute('rel') || 'icon',
        href: link.getAttribute('href') || '',
        type: link.getAttribute('type') || '',
        sizes: link.getAttribute('sizes') || ''
      }));
    if (!origFavicons.length) {
      origFavicons = [{ rel: 'icon', href: '/web/favicon.svg', type: 'image/svg+xml', sizes: '' }];
    }
  }

  function applyFavicons(descriptors, dynamic) {
    document.querySelectorAll('link[rel~="icon"]').forEach((link) => link.remove());
    descriptors.forEach((d) => {
      const link = document.createElement('link');
      link.rel = d.rel;
      if (d.type) link.type = d.type;
      if (d.sizes) link.sizes = d.sizes;
      link.href = d.href;
      if (dynamic) link.dataset.dynamicFavicon = '1';
      document.head.appendChild(link);
    });
  }

  // 底图右上画呼吸色点 + 计数角标（1~9 单字符 / 9+ 双字符两档字号）
  function drawFaviconBadge(count, pulse) {
    if (!faviconBaseImg) return;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(faviconBaseImg, 0, 0, 64, 64);
    const cx = 50, cy = 14, r = pulse ? 13 : 11;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
    ctx.fillStyle = pulse ? 'rgba(249,115,22,0.28)' : 'rgba(249,115,22,0.12)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = pulse ? '#fb923c' : '#f97316';
    ctx.fill();
    const label = count > 9 ? '9+' : String(count);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${label.length >= 2 ? 14 : 18}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
    try {
      applyFavicons([
        { rel: 'shortcut icon', href: canvas.toDataURL('image/png'), type: 'image/png', sizes: '' },
        { rel: 'icon', href: canvas.toDataURL('image/png'), type: 'image/png', sizes: '' }
      ], true);
    } catch (_) { /* 编码失败：保持原 favicon */ }
  }

  function refreshActiveFavicon() {
    if (activeCount <= 0) {
      applyFavicons(origFavicons);
      return;
    }
    if (!faviconBaseImg) {
      const img = new Image();
      img.onload = () => { faviconBaseImg = img; drawFaviconBadge(activeCount, faviconPulseOn); };
      img.src = '/web/favicon.svg';
      return;
    }
    drawFaviconBadge(activeCount, faviconPulseOn);
  }

  function activeTitleLabel() {
    const label = activeCount > 999 ? '999+' : String(activeCount);
    if (typeof t === 'function') {
      const translated = t('nav.activeRequestsTitle', { count: label });
      if (translated && translated !== 'nav.activeRequestsTitle') return translated;
    }
    return `Active[${label}]-`;
  }

  function stopTitleFlash() {
    if (titleFlashTimer !== null) {
      clearInterval(titleFlashTimer);
      titleFlashTimer = null;
    }
    titleFlashVisible = false;
    if (titleBase) document.title = titleBase;
  }

  function syncTopbarActivePill(count) {

    const pill = document.getElementById('topbar-active-pill');

    if (!pill) return;

    const shown = Number(count) > 0;

    pill.hidden = !shown;

    if (shown) {

      const countEl = document.getElementById('topbar-active-count');

      if (countEl) countEl.textContent = count > 99 ? '99+' : String(count);

      pill.setAttribute('title', t('nav.activeRequestsTitle', { count }));

      pill.setAttribute('aria-label', t('nav.activeRequestsTitle', { count }));

    }

  }



  function updateActiveIndicator(count, titleEnabled) {
    if (titleFlashTimer === null) {
      titleBase = document.title || titleBase || '';
    }
    activeCount = count;
    titleFlashEnabled = titleEnabled === true;
    syncTopbarActivePill(count);

    // favicon 角标仅在数量变化时重绘，省 toDataURL 开销
    if (count !== lastBadgeCount) {
      lastBadgeCount = count;
      snapshotFavicons();
      faviconPulseOn = false;
      refreshActiveFavicon();
    }

    if (count <= 0) {
      stopTitleFlash();
      return;
    }
    if (titleFlashTimer === null) {
      if (titleFlashEnabled) {
        document.title = activeTitleLabel() + titleBase;
        titleFlashVisible = true;
      }
      titleFlashTimer = setInterval(() => {
        faviconPulseOn = !faviconPulseOn;
        if (faviconBaseImg) drawFaviconBadge(activeCount, faviconPulseOn);
        if (!titleFlashEnabled) return;
        document.title = titleFlashVisible ? titleBase : activeTitleLabel() + titleBase;
        titleFlashVisible = !titleFlashVisible;
      }, ACTIVE_TITLE_FLASH_MS);
      return;
    }
    if (!titleFlashEnabled && titleFlashVisible) {
      document.title = titleBase;
      titleFlashVisible = false;
    }
    if (titleFlashEnabled && titleFlashVisible) {
      document.title = activeTitleLabel() + titleBase;
    }
  }

  async function pollActiveRequests() {
    try {
      const payload = await fetchAPIWithAuth('/admin/active-requests');
      const count = typeof payload.count === 'number' ? payload.count : 0;
      updateActiveIndicator(count, payload.active_request_title_enabled === true);
      const data = (payload.success && Array.isArray(payload.data)) ? payload.data : [];
      lastActiveData = data;
      for (const cb of activeDataListeners) {
        try { cb(data, count); } catch (_) { /* 订阅者异常不影响主逻辑 */ }
      }
    } catch (_) { /* 静默：未登录或网络异常不打断页面 */ }
  }

  function startActiveRequestsPolling() {
    if (activeTimer) return;
    pollActiveRequests();
    activeTimer = setInterval(() => {
      if (!document.hidden) pollActiveRequests();
    }, ACTIVE_POLL_MS);
    document.addEventListener('visibilitychange', onActiveVisibilityChange);
  }

  function stopActiveRequestsPolling() {
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }
  }

  function onActiveVisibilityChange() {
    if (document.hidden) stopActiveRequestsPolling();
    else startActiveRequestsPolling();
  }

  // 供其他页面模块（如 logs.js）订阅活动请求数据，避免重复轮询；
  // 已有最近数据则立即回调，规避新订阅者干等一个周期的时序竞争
  function onActiveRequestsData(callback) {
    if (typeof callback !== 'function') return;
    activeDataListeners.push(callback);
    if (lastActiveData !== null) {
      try { callback(lastActiveData); } catch (_) { /* 订阅者异常不影响主逻辑 */ }
    }
  }

  // 品牌行：logo + 名称 + 标语（嵌在顶栏左端，与下方侧栏同宽分界对齐）
  function buildBrand() {

    const img = document.createElement('img');

    img.className = 'topbar-brand-icon';

    img.src = '/web/favicon-192.png';

    img.alt = '';

    img.setAttribute('aria-hidden', 'true');

    return h('a', { class: 'topbar-brand', href: '/web/index.html' }, [

      img,

      h('span', { class: 'topbar-brand-text' }, [

        h('span', { class: 'topbar-brand-name' }, 'Devin2API'),

        h('span', { class: 'topbar-brand-tag' }, 'API Gateway')

      ])

    ]);

  }



  // 左侧导航栏（proxy gateway 标准布局）
  function buildSidebar(active) {

    const visibleNavKeys = navKeysForRole();



    // title/aria-label 供收合态使用：轨道里只剩图标，标签由悬浮提示补回
    const linkFor = (n) => h('a', {

      class: `sidebar-link ${n.key === active ? 'active' : ''}`,

      href: n.href,

      'data-nav-key': n.key,

      title: t(n.labelKey),

      'aria-label': t(n.labelKey)

    }, [n.icon(), h('span', { 'data-i18n': n.labelKey }, t(n.labelKey))]);



    const sections = NAV_GROUPS.map(g => {

      const items = NAVS.filter(n => n.group === g.key && visibleNavKeys.has(n.key));

      if (!items.length) return null;

      return h('div', { class: 'sidebar-group' }, [

        h('div', { class: 'sidebar-group-label', 'data-i18n': g.labelKey }, t(g.labelKey)),

        ...items.map(linkFor)

      ]);

    }).filter(Boolean);



    // 未分组项（index 放在最顶部，不挂组标）

    const headLinks = NAVS.filter(n => !n.group && visibleNavKeys.has(n.key)).map(linkFor);



    const nav = h('nav', { class: 'sidebar-nav', 'aria-label': 'Main navigation' }, [

      ...headLinks,

      ...sections

    ]);



    // 版本信息组件（点击跳转到GitHub releases页面）

    const versionBadge = h('a', {

      id: 'version-badge',

      class: 'version-badge',

      href: GITHUB_RELEASES_URL,

      target: '_blank',

      rel: 'noopener noreferrer',

      title: t('version.checkUpdate')

    }, [

      h('span', { id: 'version-display' }, 'v...')

    ]);



    // GitHub链接

    const githubLink = h('a', {

      href: GITHUB_REPO_URL,

      target: '_blank',

      rel: 'noopener noreferrer',

      class: 'github-link',

      title: t('nav.githubRepo')

    }, [iconGitHub()]);



    // 语言切换器



    const foot = h('div', { class: 'sidebar-foot' }, [

      h('div', { class: 'sidebar-meta' }, [versionBadge, githubLink]),

    ]);



    return h('aside', { id: 'sidebar', class: 'sidebar' }, [nav, foot]);

  }



  // 快速导航（Ctrl/⌘+K）：只在当前角色可见的页面里过滤，回车跳转
  function navKeysForRole() {
    return new Set(window.WebAuth.filterNavigation(NAVS.map((n) => n.key), window.getWebRole()));
  }

  let quickNav = null;
  let quickNavIndex = 0;
  let quickNavMatches = [];

  /** 按输入过滤导航项并重绘列表，index 始终落在有效项上 */
  function renderQuickNav(query) {
    const q = query.trim().toLowerCase();
    const allowed = navKeysForRole();
    quickNavMatches = NAVS.filter((n) => allowed.has(n.key))
      .filter((n) => !q || t(n.labelKey).toLowerCase().includes(q) || n.key.includes(q));
    quickNavIndex = Math.min(quickNavIndex, Math.max(quickNavMatches.length - 1, 0));
    if (!quickNavMatches.length) {
      quickNav.list.replaceChildren(h('div', { class: 'quick-nav-empty' }, t('topbar.quickNavEmpty')));
      return;
    }
    quickNav.list.replaceChildren(...quickNavMatches.map((n, i) => h('button', {
      type: 'button',
      class: `quick-nav-item${i === quickNavIndex ? ' active' : ''}`,
      role: 'option',
      'aria-selected': i === quickNavIndex ? 'true' : 'false',
      onclick: () => goQuickNav(n.href)
    }, [n.icon(), h('span', {}, t(n.labelKey))])));
  }

  /** 关闭浮层后跳转；顺序不能反，否则 overlay 会跟着页面卸载 */
  function goQuickNav(href) {
    closeQuickNav();
    location.href = href;
  }

  /** 惰性创建浮层，只建一次：结果列表随输入重绘，浮层本身复用 */
  function ensureQuickNav() {
    if (quickNav) return quickNav;
    const input = h('input', {
      type: 'text',
      class: 'quick-nav-input',
      placeholder: t('topbar.quickNav'),
      'aria-label': t('topbar.quickNav'),
      autocomplete: 'off'
    });
    const list = h('div', { class: 'quick-nav-list', role: 'listbox' });
    const overlay = h('div', { class: 'quick-nav-overlay', hidden: '' }, [
      h('div', { class: 'quick-nav-dialog', role: 'dialog', 'aria-modal': 'true' }, [input, list])
    ]);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeQuickNav();
    });
    input.addEventListener('input', () => {
      quickNavIndex = 0;
      renderQuickNav(input.value);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeQuickNav();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const count = quickNavMatches.length;
        if (count) quickNavIndex = (quickNavIndex + step + count) % count;
        renderQuickNav(input.value);
      } else if (event.key === 'Enter' && quickNavMatches[quickNavIndex]) {
        event.preventDefault();
        goQuickNav(quickNavMatches[quickNavIndex].href);
      }
    });
    document.body.appendChild(overlay);
    quickNav = { overlay, input, list };
    return quickNav;
  }

  /** 打开浮层并聚焦输入框——hidden 属性控制可见性，不进布局 */
  function openQuickNav() {
    const { overlay, input } = ensureQuickNav();
    overlay.hidden = false;
    input.value = '';
    quickNavIndex = 0;
    renderQuickNav('');
    input.focus();
  }

  /** 关闭浮层；从未打开过则无事可做 */
  function closeQuickNav() {
    if (quickNav) quickNav.overlay.hidden = true;
  }

  // 顶部细条：移动端汉堡唤回抽屉侧栏；桌面端同键收放侧栏并记忆选择
  function buildTopbar(active) {

    const activeNav = NAVS.find(n => n.key === active);

    const menuBtn = h('button', {

      type: 'button',

      class: 'topbar-menu-btn',

      'aria-label': t('topbar.toggleMenu'),

      onclick: () => {

        if (window.matchMedia('(max-width: 768px)').matches) {

          document.body.classList.toggle('sidebar-open');

        } else {

          const collapsed = document.body.classList.toggle('sidebar-collapsed');

          try { localStorage.setItem('ccload_sidebar_collapsed', collapsed ? '1' : '0'); } catch (_) {}

        }

      }

    }, [svg(window.ICON_PATHS['menu'])]);



    const title = h('div', { class: 'topbar-title' }, [

      h('span', {

        class: 'topbar-title-text',

        ...(activeNav ? { 'data-i18n': activeNav.labelKey } : {})

      }, activeNav ? t(activeNav.labelKey) : 'Devin2API')

    ]);



    // 网关状态胶囊：展示 in-flight 请求数（隐藏于无请求/未登录时）

    const pill = h('div', {

      id: 'topbar-active-pill',

      class: 'topbar-active-pill',

      hidden: ''

    }, [

      h('span', { class: 'topbar-active-dot' }),

      h('span', { class: 'topbar-active-count', id: 'topbar-active-count' }, '0')

    ]);



    // 快速导航入口：图标 + 文案 + 快捷键提示，窄屏只留图标
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    const searchBtn = h('button', {
      type: 'button',
      class: 'topbar-search',
      title: t('topbar.quickNav'),
      'aria-label': t('topbar.quickNav'),
      'data-i18n-title': 'topbar.quickNav',
      'data-i18n-aria-label': 'topbar.quickNav',
      'aria-haspopup': 'dialog',
      onclick: () => openQuickNav()
    }, [
      svg(window.ICON_PATHS['search']),
      h('span', { class: 'topbar-search-label', 'data-i18n': 'topbar.quickNav' }, t('topbar.quickNav')),
      h('kbd', { class: 'topbar-search-kbd' }, isMac ? '⌘' : 'Ctrl'),
      h('kbd', { class: 'topbar-search-kbd' }, 'K')
    ]);

    // 顶栏右侧工具组：主题 / 语言 / 登录退出——全局控件从侧栏搬上来，
    // 侧栏收合或抽屉开关都不再让它们消失
    const loggedIn = isLoggedIn();
    const authLabelKey = loggedIn ? 'common.logout' : 'common.login';
    const authBtn = h('button', {
      id: 'auth-btn',
      type: 'button',
      class: 'topbar-menu-btn topbar-auth-btn',
      title: t(authLabelKey),
      'aria-label': t(authLabelKey),
      'data-i18n-title': authLabelKey,
      'data-i18n-aria-label': authLabelKey,
      onclick: loggedIn ? onLogout : () => location.href = window.getLoginUrl()
    }, [svg(window.ICON_PATHS['arrow-right-to-bracket'])]);

    const tools = h('div', { class: 'topbar-tools' }, [
      buildThemeSwitcher(),
      window.i18n ? window.i18n.createLanguageSwitcher() : null,
      authBtn
    ]);

    return h('header', { class: 'topbar' }, [buildBrand(), menuBtn, title, searchBtn, h('div', { class: 'topbar-spacer' }), tools, pill]);

  }



  function buildThemeSwitcher() {

    const modes = [

      { mode: 'system', labelKey: 'theme.system', icon: iconThemeSystem },

      { mode: 'light', labelKey: 'theme.light', icon: iconThemeLight },

      { mode: 'dark', labelKey: 'theme.dark', icon: iconThemeDark },

    ];

    const trigger = h('button', {

      type: 'button',

      class: 'theme-trigger',

      title: t('theme.label'),

      'aria-label': t('theme.label'),

      'aria-expanded': 'false',

      'aria-haspopup': 'menu',

      onclick: (event) => {

        event.stopPropagation();

        const switcher = event.currentTarget.closest('.theme-switcher');

        const nextOpen = !switcher.classList.contains('open');

        closeThemeSwitchers(switcher);

        setThemeSwitcherOpen(switcher, nextOpen);

        if (nextOpen) focusThemeOption(switcher);

      },

      onkeydown: (event) => {

        if (event.key !== 'ArrowDown' && event.key !== 'Enter') return;

        const switcher = event.currentTarget.closest('.theme-switcher');

        if (switcher.classList.contains('open')) return;

        event.preventDefault();

        closeThemeSwitchers(switcher);

        setThemeSwitcherOpen(switcher, true);

        focusThemeOption(switcher);

      }

    }, [getThemeIcon(currentThemeMode)]);

    const menu = h('div', {

      class: 'theme-menu',

      role: 'menu',

      onclick: (event) => event.stopPropagation()

    }, modes.map(({ mode, labelKey, icon }) => h('button', {

      type: 'button',

      class: 'theme-option',

      role: 'menuitemradio',

      'data-theme-mode': mode,

      'aria-pressed': mode === currentThemeMode ? 'true' : 'false',

      onclick: (event) => {

        setThemeMode(mode);

        setThemeSwitcherOpen(event.currentTarget.closest('.theme-switcher'), false);

        trigger.focus();

      }

    }, [icon(), h('span', { 'data-i18n': labelKey }, t(labelKey))])));

    // 菜单键盘导航：方向键循环、Esc 关并回焦 trigger、Tab 关

    menu.addEventListener('keydown', (event) => {

      const options = Array.from(menu.querySelectorAll('.theme-option'));

      const idx = options.indexOf(document.activeElement);

      if (event.key === 'Escape') {

        event.preventDefault();

        setThemeSwitcherOpen(switcher, false);

        trigger.focus();

        return;

      }

      if (event.key === 'Tab') {

        setThemeSwitcherOpen(switcher, false);

        return;

      }

      let next = -1;

      if (event.key === 'ArrowDown') next = idx < 0 ? 0 : (idx + 1) % options.length;

      else if (event.key === 'ArrowUp') next = idx <= 0 ? options.length - 1 : idx - 1;

      else if (event.key === 'Home') next = 0;

      else if (event.key === 'End') next = options.length - 1;

      if (next >= 0) {

        event.preventDefault();

        options[next] && options[next].focus();

      }

    });

    const switcher = h('div', { class: 'theme-switcher' }, [trigger, menu]);

    refreshThemeSwitcher(switcher);

    return switcher;

  }

  function focusThemeOption(switcher) {

    const menu = switcher && switcher.querySelector('.theme-menu');

    if (!menu) return;

    const target = menu.querySelector('.theme-option[aria-pressed="true"]') || menu.querySelector('.theme-option');

    if (target) target.focus();

  }



  function getThemeIcon(mode) {

    if (mode === 'light') return iconThemeLight();

    if (mode === 'dark') return iconThemeDark();

    return iconThemeSystem();

  }



  async function onLogout() {

    if (!(await window.Modal.confirm(t('confirm.logout')))) return;



    // 先清理本地Token，避免后续请求触发token检查

    const token = localStorage.getItem('ccload_token');

    window.WebAuth.clearWebSession(localStorage);



    // 如果有token，尝试调用后端登出接口（使用普通fetch，不触发token检查）

    if (token) {

      try {

        await fetch('/logout', {

          method: 'POST',

          headers: { 'Authorization': `Bearer ${token}` }

        });

      } catch (error) {

        console.error('Logout error:', error);

      }

    }



    // 跳转到登录页

    location.href = '/web/login.html';

  }



  window.initTopbar = function initTopbar(activeKey) {

    document.body.classList.add('top-layout');

    // 桌面端记忆侧栏收合——boot-pending 遮着首帧，恢复类在构建前落位不闪

    try {

      if (localStorage.getItem('ccload_sidebar_collapsed') === '1' &&

          !window.matchMedia('(max-width: 768px)').matches) {

        document.body.classList.add('sidebar-collapsed');

      }

    } catch (_) {}

    // Ctrl/⌘+K 开合快速导航；浮层内 Escape 由输入框自己处理
    document.addEventListener('keydown', (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      if (quickNav && !quickNav.overlay.hidden) closeQuickNav();
      else openQuickNav();
    });

    document.body.classList.toggle('web-role-api-token', window.isAPITokenRole());

    const app = document.querySelector('.app-container') || document.body;

    // 侧边导航 + 移动端遮罩 + 顶部细条

    const sidebar = buildSidebar(activeKey);

    const backdrop = h('div', {

      class: 'sidebar-backdrop',

      onclick: () => document.body.classList.remove('sidebar-open')

    });

    const topbar = buildTopbar(activeKey);

    document.body.appendChild(sidebar);

    document.body.appendChild(backdrop);

    document.body.appendChild(topbar);



    // 移动端：Esc 或点链接后收起侧栏

    document.addEventListener('keydown', (e) => {

      if (e.key === 'Escape') document.body.classList.remove('sidebar-open');

    });

    sidebar.addEventListener('click', (e) => {

      if (e.target.closest && e.target.closest('a.sidebar-link')) {

        document.body.classList.remove('sidebar-open');

      }

    });

    const skipLink = document.createElement('a');
    skipLink.className = 'skip-link';
    skipLink.href = '#main';
    skipLink.textContent = t('common.skipToContent');
    document.body.prepend(skipLink);



    // 初始化版本显示

    initVersionDisplay();



    // 启动活动请求指示器轮询

    if (isLoggedIn() && !window.isAPITokenRole()) startActiveRequestsPolling();

  }



  // 供其他模块订阅活动请求数据（全站唯一轮询源，避免重复请求）

  window.onActiveRequestsData = onActiveRequestsData;

  window.getChartTheme = getChartTheme;



})();
