// ============================================================
// 共享格式化/通用小工具：数字、成本、耗时配色、HTML 转义、debounce
// ============================================================
(function () {

  /**
   * 防抖函数
   * @param {Function} func - 要防抖的函数
   * @param {number} wait - 等待时间(ms)
   * @returns {Function} 防抖后的函数
   */

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function calculateTokenSpeed(outputTokens, durationSeconds, firstByteSeconds) {
    const output = Number(outputTokens);
    const duration = Number(durationSeconds);
    if (!Number.isFinite(output) || output <= 0 || !Number.isFinite(duration) || duration <= 0) {
      return null;
    }

    let tokenDuration = duration;
    const firstByte = Number(firstByteSeconds);
    if (Number.isFinite(firstByte) && firstByte > 0 && firstByte < duration) {
      const generationDuration = duration - firstByte;
      if (generationDuration >= 1) {
        tokenDuration = generationDuration;
      }
    }

    return output / tokenDuration;
  }

  // 耗时/首字分档返回 tone 名（healthy|warning|critical|''），
  // 由 styles.css 的 .tone-* 共享类着色，调用方拼 class 不写内联色。

  function timingTone(seconds, greenThreshold, warningThreshold) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value <= 0) return '';
    if (value <= greenThreshold) return 'healthy';
    if (value <= warningThreshold) return 'warning';
    return 'critical';
  }

  function getFirstByteTimingTone(seconds) {
    return timingTone(seconds, 5, 10);
  }

  function getDurationTimingTone(seconds) {
    return timingTone(seconds, 30, 60);
  }

  // 成功率分档：≥99 healthy，≥95 warning，其余 critical
  function rateTone(pct) {
    const value = Number(pct);
    if (!Number.isFinite(value)) return '';
    if (value >= 99) return 'healthy';
    if (value >= 95) return 'warning';
    return 'critical';
  }

  // tone 名 → 可拼进 class 的片段（' healthy'→' tone-healthy'），空 tone 返回 ''。
  function toneClass(tone) {
    return tone ? ` tone-${tone}` : '';
  }

  /**
   * 格式化成本（美元）
   * @param {number} cost - 成本值
   * @param {number} [decimalPlaces=3] - 小数位数
   * @returns {string} 格式化后的字符串
   */

  function formatCost(cost, decimalPlaces) {
    const value = Number(cost);
    if (!Number.isFinite(value)) return '';
    const hasExplicitDecimalPlaces = Number.isInteger(decimalPlaces);
    const places = hasExplicitDecimalPlaces
      ? Math.max(0, Math.min(6, decimalPlaces))
      : 3;
    if (value === 0) return hasExplicitDecimalPlaces && places > 0 ? '$0.' + '0'.repeat(places) : '$0';
    return '$' + value.toFixed(places);
  }

  /**
   * 格式化标准成本/倍率后成本对
   * 倍率为 1 或两值相等时仅显示标准成本，否则显示 "标准/倍率后"
   * @param {number} standard - 标准成本
   * @param {number|null|undefined} effective - 倍率后成本
   * @returns {string}
   */

  function formatCostPair(standard, effective) {
    const info = getCostDisplayInfo(standard, effective);
    if (!info.hasMultiplier) return formatCost(info.standardCost);
    return formatCost(info.standardCost) + '/' + formatCost(info.effectiveCost);
  }

  /**
   * 格式化倍率文本
   * @param {number} multiplier - 倍率
   * @returns {string}
   */

  function formatCostMultiplier(multiplier) {
    const value = Number(multiplier);
    if (!Number.isFinite(value) || value < 0 || Math.abs(value - 1) < 1e-9) return '';
    return formatCostMultiplierValue(value);
  }

  // 区间端点必须显式显示 1x；单值倍率为 1 时才由上层整体隐藏。

  function formatCostMultiplierValue(multiplier) {
    const value = Number(multiplier);
    if (!Number.isFinite(value) || value < 0) return '';
    return `${Number(value.toFixed(2)).toString()}x`;
  }

  /**
   * 解析标准成本/倍率后成本显示信息
   * @param {number} standard - 标准成本
   * @param {number|null|undefined} effective - 倍率后成本
   * @returns {{standardCost:number,effectiveCost:number,hasMultiplier:boolean,multiplier:number,multiplierText:string}}
   */

  function getCostDisplayInfo(standard, effective) {
    const standardCost = Number(standard) || 0;
    if (!(standardCost > 0)) {
      return {
        standardCost: 0,
        effectiveCost: 0,
        hasMultiplier: false,
        multiplier: 1,
        multiplierText: ''
      };
    }

    const hasExplicitEffectiveCost = effective !== undefined && effective !== null;
    const effectiveValue = hasExplicitEffectiveCost ? (Number(effective) || 0) : standardCost;
    const effectiveCost = hasExplicitEffectiveCost ? effectiveValue : standardCost;
    const hasMultiplier = Math.abs(effectiveCost - standardCost) >= 1e-9;
    const multiplier = hasMultiplier ? (effectiveCost / standardCost) : 1;

    return {
      standardCost,
      effectiveCost,
      hasMultiplier,
      multiplier,
      multiplierText: formatCostMultiplier(multiplier)
    };
  }

  /**
   * 构建两行成本显示HTML
   * @param {number} standard - 标准成本
   * @param {number|null|undefined} effective - 倍率后成本
   * @param {{inline?: boolean, decimalPlaces?: number}} options - 样式配置
   * @returns {string}
   */

  function buildCostStackHtml(standard, effective, options = {}) {
    const info = getCostDisplayInfo(standard, effective);
    if (!(info.standardCost > 0)) return '';

    const inline = options.inline === true;
    const classes = ['cost-stack'];
    if (inline) {
      classes.push('cost-stack--inline');
    }

    const format = cost => formatCost(cost, options.decimalPlaces);

    if (!info.hasMultiplier) {
      return `<span class="${classes.join(' ')}"><span class="cost-stack-effective">${format(info.effectiveCost)}</span></span>`;
    }

    if (inline) {
      return `<span class="${classes.join(' ')}"><span class="cost-stack-standard">${format(info.standardCost)}</span><span class="cost-stack-effective">${format(info.effectiveCost)}</span></span>`;
    }

    return `<span class="${classes.join(' ')}"><span class="cost-stack-standard">${format(info.standardCost)}</span><span class="cost-stack-effective">${format(info.effectiveCost)}</span></span>`;
  }

  // 格式化数字显示（通用：K/M缩写）；非有限值显 '—'，坏数据不画成 0。
  // 档位阈值按显示精度进位后取值，避免 999950 渲成 "1000.0K"。

  function formatNumber(num) {
    const n = Number(num);
    if (!Number.isFinite(n)) return '—';
    const abs = Math.abs(n);
    if (abs >= 999.5e6) return (n / 1e9).toFixed(1) + 'B';
    if (abs >= 999.5e3) return (n / 1e6).toFixed(1) + 'M';
    if (abs >= 999.5) return (n / 1e3).toFixed(1) + 'K';
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }

  // RPM 数值文本（1000+ 缩写 K、1+ 一位小数、其余两位）；<0.01 的兜底展示由调用方定

  function formatRpmValue(rpm) {
    if (rpm >= 1000) return (rpm / 1000).toFixed(1) + 'K';
    if (rpm >= 1) return rpm.toFixed(1);
    return rpm.toFixed(2);
  }

  // ── 管线前拒绝 reason → 人性化标签 ─────────────────────────
  // wire 值是 internal/obs/metrics.go 的 RejectReason 枚举；服务端
  // rejects.labels 下发英文基准名，这里按 locale 键优先本地化。
  const REJECT_REASON_LABELS = {
    draining:             ['common.rejectReason.draining', 'Draining'],
    concurrency_limit:    ['common.rejectReason.concurrencyLimit', 'Concurrency limit'],
    ws_connection_limit:  ['common.rejectReason.wsConnectionLimit', 'WS connection limit'],
    missing_api_key:      ['common.rejectReason.missingApiKey', 'Missing API key'],
    invalid_api_key:      ['common.rejectReason.invalidApiKey', 'Invalid API key'],
    http_read:            ['common.rejectReason.httpRead', 'Body read failed']
  };

  // 兜底链：locale 键 → 服务端 labels 表 → 原值。未知 reason 保持原样
  // 以便排障核对（词汇新增时 wire 值永远可见）。
  function rejectReasonLabel(reason, serverLabel) {
    const key = String(reason || '');
    const item = REJECT_REASON_LABELS[key];
    if (item) return window.i18nText(item[0], item[1]);
    return serverLabel || key;
  }

  /**
   * HTML转义（防XSS）
   * @param {string} str - 需要转义的字符串
   * @returns {string} 转义后的安全字符串
   */

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 导出到全局作用域

  // 站内图标统一用 Lucide（描边风格，stroke=currentColor）；
  // inner 只含 path/图形元素，由 iconSVG 包成完整 <svg> 字符串。
  const ICON_PATHS = {
    'x': '<path d="M18 6 6 18M6 6l12 12"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    'trash-2': '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    'key': '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'menu': '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    'monitor': '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    'languages': '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
    'layout-dashboard': '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    'scroll-text': '<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
    'chart-column': '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    'trending-up': '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
    'key-round': '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
    'layers': '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevrons-left': '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>',
    'chevrons-right': '<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>',
    'chevron-first': '<path d="m17 18-6-6 6-6"/><path d="M7 6v12"/>',
    'chevron-last': '<path d="m7 18 6-6-6-6"/><path d="M17 6v12"/>',
    'table': '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
    'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    'server': '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/>',
    'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    'columns-3': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    'chart-pie': '<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>',
    'activity': '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'sliders-horizontal': '<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/><path d="M8 18H3"/><path d="M8 6H3"/>',
    'zap': '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    'lock': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'arrow-right-to-bracket': '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
    'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'
  };

  /**
   * 生成 Lucide 描边图标 <svg> 串：尺寸交给 CSS（width/height）控制。
   * @param {string} name - ICON_PATHS 键名
   * @param {string} [cls] - 附加 class
   * @returns {string}
   */
  function iconSVG(name, cls) {
    const inner = ICON_PATHS[name];
    if (!inner) return '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${inner}</svg>`;
  }

  window.debounce = debounce;
  window.calculateTokenSpeed = calculateTokenSpeed;
  window.formatCost = formatCost;
  window.formatCostPair = formatCostPair;
  window.getCostDisplayInfo = getCostDisplayInfo;
  window.buildCostStackHtml = buildCostStackHtml;
  window.getFirstByteTimingTone = getFirstByteTimingTone;
  window.getDurationTimingTone = getDurationTimingTone;
  window.rateTone = rateTone;
  window.toneClass = toneClass;
  window.formatNumber = formatNumber;
  window.formatRpmValue = formatRpmValue;
  window.rejectReasonLabel = rejectReasonLabel;
  window.escapeHtml = escapeHtml;
  window.esc = escapeHtml;
  window.ICON_PATHS = ICON_PATHS;
  window.iconSVG = iconSVG;

})();
