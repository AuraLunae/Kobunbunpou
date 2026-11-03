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
      '.app-nav{display:flex;justify-content:center;gap:8px;padding:10px 16px;border-bottom:1px solid #d2d2d7;background:var(--paper,#fff);font:500 .9rem/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif}',
      '.app-nav a{padding:8px 14px;border-radius:999px;color:var(--accent,#0071e3);text-decoration:none}',
      '.app-nav a[aria-current=page]{background:var(--soft,#eaf3ff);font-weight:700}',
      '.app-nav a:focus-visible{outline:3px solid var(--accent,#0071e3);outline-offset:2px}',
      '@media(max-width:380px){.app-nav{gap:2px;padding:8px}.app-nav a{padding:8px 10px}}'
    ].join('');
    document.head.appendChild(style);

    var nav = document.createElement('nav');
    nav.className = 'app-nav';
    nav.setAttribute('aria-label', 'アプリの切り替え');
    nav.innerHTML = '<a href="https://lightBlueEarphone.github.io/DeleteTaletoNose/">消去しりとり</a>'
      + '<a href="https://lightBlueEarphone.github.io/Kobunbunpou/" aria-current="page">古文文法</a>';
    document.body.insertBefore(nav, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
