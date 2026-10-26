import { heroes } from '../catalog';

/** Small local vector icons keep the interface usable without external font or image requests. */
export function icon(name: string): string {
  const paths: Record<string, string> = {
    arena: '<path d="m5 3 16 16-2 2L3 5V3h2Zm14 0L3 19l2 2L21 5V3h-2ZM4 14l6 6m4-16 6 6"/>',
    hero: '<path d="m12 3 7 4v6c0 4-7 8-7 8s-7-4-7-8V7l7-4Z"/><path d="m8 10 4 2 4-2M9 16h6"/>',
    history: '<path d="M7 4h13v17H7zM4 7h3M4 12h3M4 17h3M11 8h5M11 12h5M11 16h3"/>',
    settings: '<path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v.1"/>',
    exit: '<path d="M10 4H4v16h6m4-12 4 4-4 4M8 12h12"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v6m-5 2h10"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.hero}</svg>`;
}

export function shell(): string {
  return `
<main class="shell" data-screen="auth" id="client-shell">
  <header class="topbar">
    <a class="brand" href="#" id="brand-home" aria-label="影斗首页"><span class="seal" aria-hidden="true">影</span><span><strong>影斗</strong><small>忍者竞技场</small></span></a>
    <nav class="top-actions" aria-label="账号与设置">
      <span id="connection" class="connection" role="status">尚未连接</span>
      <span class="account-chip" id="account-chip" hidden><span class="account-avatar" aria-hidden="true">忍</span><span id="account-display"></span></span>
      <button id="history-open" class="icon-label" aria-label="我的战绩" disabled>${icon('history')}<span>我的战绩</span></button>
      <button id="settings-open" class="icon-button" aria-label="设置" title="设置">${icon('settings')}</button>
    </nav>
  </header>

  <section id="auth-screen" class="auth-screen" aria-label="登录与注册">
    <div class="auth-world" aria-hidden="true"><div class="moon-ring"></div><span class="world-glyph">影</span></div>
    <div class="auth-story"><div class="chapter-mark"><span></span>忍者竞技场<span></span></div><h1>影斗</h1><p class="story-line">一瞬交锋，决胜于影。</p><div class="story-rule"></div><p class="story-caption">选择你的忍道<br>在刀光与残影之间，迎战下一位对手。</p><span class="story-seal" aria-hidden="true">忍道</span></div>
    <div class="auth-panel">
      <div class="auth-heading"><span class="small-seal" aria-hidden="true">契</span><div><h2 id="auth-title">踏入竞技场</h2><p id="auth-subtitle">登录账号，开启你的下一场对决。</p></div></div>
      <div class="auth-tabs" role="group" aria-label="账号操作"><button type="button" id="auth-login-tab" aria-pressed="true">账号登录</button><button type="button" id="register" aria-pressed="false">创建账号</button></div>
      <form id="auth-form">
        <label for="account">邮箱账号</label><div class="input-wrap">${icon('mail')}<input id="account" type="email" required maxlength="64" autocomplete="username" placeholder="请输入邮箱地址"></div>
        <label for="password">密码</label><div class="input-wrap">${icon('lock')}<input id="password" type="password" required autocomplete="current-password" placeholder="请输入密码"><button type="button" id="password-toggle" class="input-action" aria-label="显示密码" aria-pressed="false">${icon('eye')}</button></div>
        <div id="confirm-field" hidden><label for="confirm-password">确认密码</label><div class="input-wrap">${icon('lock')}<input id="confirm-password" type="password" autocomplete="new-password" placeholder="再次输入密码"></div></div>
        <p class="field-note" id="password-note" hidden>至少 9 位，包含字母、数字和符号。</p>
        <p id="auth-feedback" class="auth-feedback" role="status" aria-live="polite" hidden></p>
        <button id="login" class="primary auth-submit" type="submit"><span id="auth-submit-text">登录竞技场</span>${icon('arrow')}</button>
      </form>
      <p class="auth-note" id="auth-note">初次来到影斗？选择「创建账号」后即可注册。</p>
      <div class="auth-bottom"><span class="diamond" aria-hidden="true"></span><span>双人对决 · 即时格斗</span><span class="diamond" aria-hidden="true"></span></div>
    </div>
    <div class="auth-footer"><span>影斗 · 忍者竞技场</span><button id="auth-help" class="text-button">${icon('help')}操作指南</button></div>
  </section>

  <section id="lobby-screen" class="lobby-screen" aria-label="对战大厅" hidden>
    <nav class="side-nav" aria-label="大厅功能">
      <button id="lobby-home" class="nav-item selected" aria-current="page">${icon('arena')}<span>对战大厅</span></button>
      <button id="heroes-open" class="nav-item">${icon('hero')}<span>忍者图鉴</span></button>
      <button id="lobby-history" class="nav-item">${icon('history')}<span>对战记录</span></button>
      <button id="help-open" class="nav-item">${icon('help')}<span>操作指南</span></button>
      <div class="nav-bottom"><button id="logout" class="nav-item" aria-label="退出登录" title="退出登录">${icon('exit')}<span>退出登录</span></button></div>
    </nav>
    <div class="lobby-main">
      <div class="section-heading"><div><span class="heading-rule"></span><h1>对战大厅</h1><p>准备就绪，迎接下一场交锋。</p></div><span class="mode-tag">双人对决</span></div>
      <div class="lobby-grid">
        <section class="duel-feature" aria-label="对决模式"><div class="feature-art" aria-hidden="true"></div><div class="feature-top"><span class="feature-badge">忍者对决</span><span>1 对 1</span></div><div class="feature-title"><span class="feature-kicker">以技决胜</span><h2>狭路相逢<br>影决高下</h2><p>掌握进退与格挡的时机，<br>用你的招式，定义这场对决。</p></div><div class="feature-bottom"><div class="duel-emblem" aria-hidden="true">${icon('arena')}</div><div><strong>双人竞技</strong><span>两位玩家到齐后开始对决</span></div><span class="feature-number" aria-hidden="true">壹</span></div></section>
        <section class="ready-panel" aria-label="出战准备"><div class="ready-heading"><h2>出战忍者</h2><span id="selection-label">风隐已就绪</span></div>
          <div class="heroes">${heroes.map(h => `<button class="hero-card" data-hero="${h.id}" aria-pressed="${h.id === 101}"><span class="hero-symbol" aria-hidden="true">${h.id === 101 ? '风' : '岩'}</span><span class="hero-copy"><strong>${h.name}</strong><small>${h.id === 101 ? '迅捷突进' : '重击防御'}</small></span><span class="hero-check" aria-hidden="true">✓</span></button>`).join('')}</div>
          <div class="selected-hero"><span class="hero-overprint" id="hero-overprint" aria-hidden="true">风</span><span class="hero-class" id="hero-class">迅捷突进</span><h3 id="selected-name">风隐</h3><p id="selected-description">以灵巧走位寻找破绽，突进出刀，迅速撤离。</p><dl class="hero-stats"><div><dt>生命</dt><dd id="hero-hp">1000</dd></div><div><dt>蓝量</dt><dd id="hero-mana">100</dd></div><div><dt>防御</dt><dd id="hero-guard">100</dd></div></dl></div>
          <div class="equipped-skills" id="equipped-skills" aria-label="已装配技能"></div>
          <button id="hero-detail" class="text-button detail-link">查看忍者与技能 ${icon('arrow')}</button>
          <div id="signed-in" class="signed-in"><strong id="user-name" hidden></strong><p id="session-hint">选择忍者后进入战场。</p></div>
          <label class="nickname-label" for="nickname">本局昵称<span>可选</span></label><input id="nickname" maxlength="32" placeholder="留空使用默认昵称" autocomplete="off">
          <button id="enter" class="primary enter-button" disabled><span id="enter-text">开始对战</span>${icon('arena')}</button><p class="entry-note">进入战场后等待对手，无需手动创建房间。</p>
        </section>
      </div>
      <div class="lobby-bottom"><div>${icon('help')}<p><strong>每一步，都有胜机</strong><span>A / D 移动，空格跳跃，K 格挡，J 普攻，U / I 释放技能。</span></p><button id="lobby-guide" class="text-button">查看操作</button></div><span class="lobby-motto">静如影 · 疾如风</span></div>
    </div>
  </section>

  <section id="battle-screen" class="battle-screen" aria-label="战斗" hidden>
    <div class="battle-toolbar"><button id="leave" class="quiet" hidden>${icon('back')}离开战场</button><button id="battle-fullscreen" class="quiet" aria-label="进入全屏">${icon('fullscreen')}<span id="fullscreen-label">全屏</span></button></div>
    <section class="arena-shell" aria-label="战斗场景"><div class="hud">
      <div class="fighter-info" id="fighter-left"><div class="fighter-name"><span data-name>风隐</span><small data-role>场景预览</small></div><div class="bar" aria-label="左侧角色生命"><span data-hp></span></div><div class="bar-sub"><div class="bar mana"><span data-mana></span></div><div class="bar guard"><span data-guard></span></div></div><div class="meter-text" data-values></div><div class="meter-text" data-status></div></div>
      <div class="match-state"><strong id="match-time">对决</strong><small id="match-label">等待入场</small></div>
      <div class="fighter-info right" id="fighter-right"><div class="fighter-name"><span data-name>岩牙</span><small data-role>场景预览</small></div><div class="bar" aria-label="右侧角色生命"><span data-hp></span></div><div class="bar-sub"><div class="bar mana"><span data-mana></span></div><div class="bar guard"><span data-guard></span></div></div><div class="meter-text" data-values></div><div class="meter-text" data-status></div></div>
    </div><div class="stage" id="stage"><div id="stage-banner" class="stage-banner">正在进入战场…</div><div class="scene-caption" id="scene-caption">樱落天境</div></div>
    <div class="arena-bottom"><div class="stage-selector"><span>场景预览</span><button data-scene="sakura" aria-pressed="true">樱落天境</button><button data-scene="inferno" aria-pressed="false">赤月熔城</button></div><div id="stats" class="stats">正在加载场景…</div></div></section>
    <section class="controls" aria-label="战斗操作"><div class="movement-controls"><button class="control" data-input="left" disabled><kbd>A / ←</kbd><span>向左</span></button><button class="control" data-input="right" disabled><kbd>D / →</kbd><span>向右</span></button><button class="control" data-input="jump" disabled><kbd>空格</kbd><span>跳跃</span></button><button class="control" data-input="block" disabled><kbd>K</kbd><span>按住格挡</span></button></div><div class="skill-controls" id="skill-controls"></div></section>
  </section>
  <footer class="footer"><span>影斗 · 忍者竞技场</span><span>胜负，在一瞬之间。</span></footer>
</main>
<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>

<dialog id="settings" aria-labelledby="settings-title"><div class="dialog-head"><div><span class="dialog-caption">偏好设置</span><h2 id="settings-title">设置</h2></div><button class="icon-button" data-close="settings" aria-label="关闭设置">${icon('close')}</button></div>
  <form id="settings-form"><section class="settings-section"><h3>画面辅助</h3><label class="checkbox"><span><strong>显示判定辅助线</strong><small>显示角色受击范围与地面参考线。</small></span><input id="debug-boxes" type="checkbox" role="switch"></label></section>
    <details class="advanced-settings"><summary>连接设置</summary><label for="gateway-url">服务器地址</label><input id="gateway-url" type="url" required placeholder="ws://127.0.0.1:9001/ws"><p class="footnote">更换地址会退出当前登录和对局。</p></details><div class="dialog-actions"><button class="quiet" type="button" data-close="settings">取消</button><button class="primary" type="submit">保存设置</button></div></form></dialog>
<dialog id="history" class="history-dialog" aria-labelledby="history-title"><div class="dialog-head"><div><span class="dialog-caption">每一次交锋，皆有迹可循</span><h2 id="history-title">对战记录</h2></div><button class="icon-button" data-close="history" aria-label="关闭战绩">${icon('close')}</button></div><div class="history-intro">查看已完成对局的结果与出战忍者。</div><div id="history-content" class="history-content" aria-live="polite"></div><div class="dialog-actions"><button id="history-retry" hidden>重新加载</button><button id="history-next" hidden>加载更多</button></div></dialog>
<dialog id="hero-dialog" class="hero-dialog" aria-labelledby="hero-dialog-title"><div class="dialog-head"><div><span class="dialog-caption">了解你的出战忍者</span><h2 id="hero-dialog-title">忍者图鉴</h2></div><button class="icon-button" data-close="hero-dialog" aria-label="关闭忍者图鉴">${icon('close')}</button></div><div class="roster-tabs" role="group" aria-label="查看忍者">${heroes.map(h => `<button data-inspect-hero="${h.id}" aria-pressed="${h.id === 101}">${h.name}</button>`).join('')}</div><div id="hero-dialog-content"></div></dialog>
<dialog id="help" aria-labelledby="help-title"><div class="dialog-head"><div><span class="dialog-caption">上场之前</span><h2 id="help-title">操作指南</h2></div><button class="icon-button" data-close="help" aria-label="关闭操作指南">${icon('close')}</button></div><div class="guide-list">${[['A / D', '左右移动', '也可使用方向键 ← / →。'], ['空格', '跳跃', '也可使用 W 或方向键 ↑。'], ['K', '格挡', '按住格挡，松开解除。'], ['U / I', '角色技能', '技能消耗蓝量，冷却结束后可再次释放。'], ['J', '普通攻击', '不消耗蓝量，地面释放；命中可触发普攻被动。'], ['L', '训练飞镖', '风隐的训练技能，仅训练模式可用。']].map(([key, title, text]) => `<div class="guide-row"><kbd>${key}</kbd><div><strong>${title}</strong><p>${text}</p></div></div>`).join('')}</div><p class="guide-note">进入对决后，两位玩家到齐即可开战。切换窗口时会自动松开移动和格挡。</p><div class="dialog-actions"><button class="primary" data-close="help">明白了</button></div></dialog>
<dialog id="result" class="result-dialog" aria-labelledby="result-title"><div class="result-emblem" aria-hidden="true">${icon('trophy')}</div><p class="result-caption">此战，已见分晓</p><h2 id="result-title">对决结束</h2><div id="result-content"></div><div class="dialog-actions"><button class="primary" data-close="result">返回大厅</button></div></dialog>`;
}
