// テンシ ポータルの Supabase（publishable キーのみ。service_role は絶対に入れない）
// ※ supabase-config.js は古文文法サイト自身のプロジェクト用。こちらはポータル用で、別物。
window.PORTAL_SUPABASE_URL = 'https://ljowllihyetgvuugafam.supabase.co';
window.PORTAL_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_lfvqV1MdT5eioPyLOnM36Q_a1EZGSV0';

// どのページからも2つの学習アプリへ移動できる共通ヘッダー。
(function addAppNavigation() {
  function mount() {
    if (document.querySelector('.app-nav')) return;

    var style = document.createElement('style');
    style.textContent = [
      ':root{--nav-bg:rgba(255,255,255,0.72);--nav-border:rgba(0,0,0,0.08);--nav-pill:rgba(10,132,255,0.08);--nav-text:#1d1d1f;--nav-muted:#5f6368;}',
      '@media (prefers-color-scheme: dark){:root{--nav-bg:rgba(28,28,30,0.72);--nav-border:rgba(255,255,255,0.12);--nav-pill:rgba(99,170,255,0.2);--nav-text:#f5f5f7;--nav-muted:#a1a1a6;}}',
      '.app-nav{position:sticky;top:0;z-index:20;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:4px;padding:8px 16px;border-bottom:1px solid var(--nav-border);background:var(--nav-bg);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);box-shadow:0 1px 0 rgba(0,0,0,.02)}',
      '.app-nav-title{color:var(--nav-text);font-size:1rem;font-weight:650;letter-spacing:-.025em;line-height:1.35}',
      '.app-nav-links{display:flex;justify-content:flex-start;align-items:center;gap:8px}',
      '.app-nav a{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:6px 12px;border:1px solid var(--nav-border);border-radius:6px;color:var(--nav-text);text-decoration:none;font-size:.88rem;font-weight:500;letter-spacing:-.01em;transition:background-color .16s ease,transform .16s ease}',
      '.app-nav a:hover{background:rgba(142,142,147,.12)}',
      '.app-nav a[aria-current=page]{border-color:rgba(10,132,255,.22);background:var(--nav-pill);color:#0a84ff;font-weight:600}',
      '.app-nav a:focus-visible{outline:3px solid rgba(10,132,255,.35);outline-offset:2px}',
      '@media (max-width:480px){.app-nav{gap:3px;padding:7px 10px}.app-nav-links{gap:6px}.app-nav a{min-height:30px;padding:6px 10px;font-size:.82rem}}'
    ].join('');
    document.head.appendChild(style);

    var nav = document.createElement('nav');
    nav.className = 'app-nav';
    nav.setAttribute('aria-label', 'アプリの切り替え');
    nav.innerHTML = '<span class="app-nav-title">Dr.Yの研究室</span>'
      + '<div class="app-nav-links"><a href="https://lightBlueEarphone.github.io/DeleteTaletoNose/">消去しりとり</a>'
      + '<a href="https://lightBlueEarphone.github.io/Kobunbunpou/" aria-current="page">古文文法</a></div>';
    document.body.insertBefore(nav, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
