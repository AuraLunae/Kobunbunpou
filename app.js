/* Dr.Yの古典文法
 * ・問題は data/ から最初に一括でダウンロードし、localStorage に保存（次回からは保存分を使う）
 * ・プリントの「回」(助動詞①など)ごとに、ステップ(= 回の半分)のボタンを用意。押すと、そのステップの問題がいっきに始まる
 * ・出す順番は、まだ解いていない問題が最優先
 * ・Supabase は「テンシ ポータル」のものだけを使う（連携しなくても、すべて遊べる）
 */
(() => {
'use strict';

/* ============================== 設定 ============================== */
const KEYS = {
	data: 'kobunbunpou-data-v1',             // ダウンロードした問題（キャッシュ）
	progress: 'kobunbunpou-progress-v1',     // 問題ごとの記録
	session: 'kobunbunpou-session-v1',       // 途中の回
	daily: 'kobunbunpou-daily-counts'        // ポータルに送る、日ごとの回答数
};
const FORMS_SHORT = ['未然', '連用', '終止', '連体', '已然', '命令'];
const CIRC = '①②③④⑤⑥⑦⑧⑨';
const PRAISE = ['せいかい！', 'ばっちり！', 'その調子！', 'いいね！', 'すごい！'];
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================== 保存 ============================== */
const mem = {};
const store = {
	get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] === undefined ? null : mem[k]; } },
	set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
	del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
};
function readJSON(k, fallback) {
	try { const v = store.get(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
}
function writeJSON(k, v) { store.set(k, JSON.stringify(v)); }

/* ============================== 小道具 ============================== */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function shuffle(a) {
	a = a.slice();
	for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
	return a;
}
function jstDay(ms) { return new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10); }

/* ---- 問題文の記法（data/ の文字列）を HTML にする ---- */
const RE = {
	ruby: /\{([^|}]+)\|([^}]+)\}/y,
	ul: /\[\[(?:(\d+):)?(.+?)\]\]/y,
	bk: /<<(?:(\d+):)?(.+?)>>/y,
	fn: /〔(.+?)〕/y
};
function rich(str, notes) {
	let out = '', i = 0, m;
	while (i < str.length) {
		const c = str[i];
		m = null;
		if (c === '{') {
			RE.ruby.lastIndex = i; m = RE.ruby.exec(str);
			if (m) out += `<ruby>${esc(m[1])}<rp>（</rp><rt>${esc(m[2])}</rt><rp>）</rp></ruby>`;
		} else if (c === '[' && str[i + 1] === '[') {
			RE.ul.lastIndex = i; m = RE.ul.exec(str);
			if (m) out += m[1]
				? `<span class="blank" data-blank="${m[1]}"><b class="bn">${CIRC[m[1] - 1]}</b>${esc(m[2])}</span>`
				: `<span class="ul">${esc(m[2])}</span>`;
		} else if (c === '<' && str[i + 1] === '<') {
			RE.bk.lastIndex = i; m = RE.bk.exec(str);
			if (m) out += m[1]
				? `<span class="blank" data-blank="${m[1]}"><b class="bn">${CIRC[m[1] - 1]}</b>${esc(m[2])}</span>`
				: `<span class="bk">《${esc(m[2])}》</span>`;
		} else if (c === '〔') {
			RE.fn.lastIndex = i; m = RE.fn.exec(str);
			if (m) {
				const k = m[1].lastIndexOf('|');
				const word = m[1].slice(0, k), note = m[1].slice(k + 1);
				notes.push({ word: plain(word), note });
				out += `<span class="fn">${rich(word, [])}<sup>※${notes.length}</sup></span>`;
			}
		}
		if (m) { i += m[0].length; continue; }
		out += esc(c); i++;
	}
	return out;
}
function plain(str) {
	return str
		.replace(/\{([^|}]+)\|[^}]+\}/g, '$1')
		.replace(/〔([^|〕]+)\|[^〕]*〕/g, '$1')
		.replace(/\[\[(?:\d+:)?(.+?)\]\]/g, '$1')
		.replace(/<<(?:\d+:)?(.+?)>>/g, '《$1》');
}
function notesHTML(notes) {
	return notes.map((n, i) => `<li><b>※${i + 1}</b><span class="w">${esc(n.word)}</span>　${esc(n.note)}</li>`).join('');
}

/* ---- マスコット(せんせい) ---- */
function mascot(mood, size) {
	const eyes = mood === 'happy'
		? '<path d="M36 66 Q42 57 48 66 M72 66 Q78 57 84 66" fill="none" stroke="#2f2745" stroke-width="3.2" stroke-linecap="round"/>'
		: '<circle cx="42" cy="64" r="3.6" fill="#2f2745"/><circle cx="78" cy="64" r="3.6" fill="#2f2745"/>';
	const mouth = {
		smile: '<path d="M52 80 Q60 88 68 80" fill="none" stroke="#2f2745" stroke-width="3" stroke-linecap="round"/>',
		happy: '<path d="M50 78 Q60 97 70 78 Z" fill="#e2578a" stroke="#2f2745" stroke-width="3" stroke-linejoin="round"/>',
		oops: '<path d="M51 86 Q55.5 79 60 86 T69 86" fill="none" stroke="#2f2745" stroke-width="3" stroke-linecap="round"/>'
	}[mood || 'smile'];
	const sweat = mood === 'oops' ? '<path d="M100 40 Q104 48 100 52 Q96 48 100 40Z" fill="#a9d8ff" stroke="#2f2745" stroke-width="2"/>' : '';
	return `<svg class="mascot" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">
		<path d="M60 20 C92 20 110 42 110 70 C110 98 90 110 60 110 C30 110 10 98 10 70 C10 42 28 20 60 20Z" fill="#fff" stroke="#2f2745" stroke-width="3.2" stroke-linejoin="round"/>
		<path d="M52 21 C47 8 61 3 66 12 C60 11 58 16 60 21Z" fill="#2f2745"/>
		<g transform="translate(92 30)"><circle r="4.2" cx="0" cy="-6.5" fill="#ffc3d6" stroke="#2f2745" stroke-width="1.6"/><circle r="4.2" cx="6.2" cy="-2" fill="#ffc3d6" stroke="#2f2745" stroke-width="1.6"/><circle r="4.2" cx="3.8" cy="5.3" fill="#ffc3d6" stroke="#2f2745" stroke-width="1.6"/><circle r="4.2" cx="-3.8" cy="5.3" fill="#ffc3d6" stroke="#2f2745" stroke-width="1.6"/><circle r="4.2" cx="-6.2" cy="-2" fill="#ffc3d6" stroke="#2f2745" stroke-width="1.6"/><circle r="2.4" fill="#ffd24d"/></g>
		<circle cx="42" cy="64" r="14" fill="rgba(190,215,255,.28)" stroke="#2f2745" stroke-width="3"/>
		<circle cx="78" cy="64" r="14" fill="rgba(190,215,255,.28)" stroke="#2f2745" stroke-width="3"/>
		<path d="M56 63 H64" stroke="#2f2745" stroke-width="3" stroke-linecap="round"/>
		${eyes}
		<ellipse cx="25" cy="82" rx="8" ry="5" fill="#ffc3d6" opacity=".85"/><ellipse cx="95" cy="82" rx="8" ry="5" fill="#ffc3d6" opacity=".85"/>
		${mouth}${sweat}
	</svg>`;
}

/* ============================== 日ごとの回答数(ポータル用) ============================== */
let dailyMemory = {};
function loadDaily() {
	try {
		const parsed = JSON.parse(store.get(KEYS.daily) || '{}');
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
	} catch (e) { return { ...dailyMemory }; }
	return {};
}
function recordDaily() {
	const days = loadDaily();
	const today = jstDay(Date.now());
	days[today] = (Number.isInteger(days[today]) && days[today] >= 0 ? days[today] : 0) + 1;
	Object.keys(days).sort().slice(0, -400).forEach(d => { delete days[d]; });
	dailyMemory = days;
	writeJSON(KEYS.daily, days);
	if (window.PortalClient) window.PortalClient.kick();
}
function calcStreak() {
	const daily = loadDaily();
	let d = Date.now(), n = 0;
	if (!(daily[jstDay(d)] > 0)) d -= 864e5;
	while (daily[jstDay(d)] > 0) { n++; d -= 864e5; }
	return n;
}

/* ============================== 問題データ(一括ダウンロード + キャッシュ) ============================== */
let DATA = null;          // { version, prints, questions, byId }
let pendingRaw = null;    // 新しい版を見つけたが、クイズ中なので保留

function isValidRaw(d) {
	return !!d && typeof d.version === 'string' && Array.isArray(d.prints) && d.prints.length > 0 &&
		d.prints.every(p => p && p.id && Array.isArray(p.questions) && p.questions.length > 0);
}
function buildIndex(raw) {
	const questions = [], byId = new Map();
	raw.prints.forEach(p => {
		if (!p.round || !p.step) {
			const parts = String(p.title || '').split(/\s+/);
			p.round = p.round || parts[0] || p.id;
			p.step = p.step || parts.slice(1).join(' ') || p.id;
		}
		p.questions.forEach(q => {
			q.printId = p.id; q.order = questions.length;
			questions.push(q); byId.set(q.id, q);
		});
	});
	return { version: raw.version, prints: raw.prints, questions, byId };
}
async function fetchJSON(url, opts) {
	const r = await fetch(url, opts);
	if (!r.ok) throw new Error(`HTTP ${r.status}`);
	return r.json();
}
async function downloadAll(onProgress) {
	const manifest = await fetchJSON('data/manifest.json', { cache: 'no-cache' });
	let done = 0;
	const prints = await Promise.all(manifest.prints.map(p =>
		fetchJSON(`data/${p.file}?v=${encodeURIComponent(manifest.version)}`).then(j => {
			done++; if (onProgress) onProgress(done, manifest.prints.length);
			return j;
		})));
	const raw = { version: manifest.version, savedAt: Date.now(), prints };
	if (!isValidRaw(raw)) throw new Error('問題データの形式が正しくありません。');
	return raw;
}
function saveData(raw) { try { store.set(KEYS.data, JSON.stringify(raw)); } catch (e) { console.error('問題データを保存できませんでした。', e); } }

async function checkForUpdate(currentVersion) {
	try {
		const manifest = await fetchJSON('data/manifest.json', { cache: 'no-cache' });
		if (manifest.version === currentVersion) return;
		const raw = await downloadAll();
		saveData(raw);
		pendingRaw = raw;
		if (view === 'home') applyPending();
	} catch (e) { /* オフラインなど。保存済みの問題で続ける */ }
}
function applyPending() {
	if (!pendingRaw) return;
	DATA = buildIndex(pendingRaw);
	pendingRaw = null;
	renderHome();
	toast('問題を新しくしました');
}

/* ============================== 記録 ============================== */
let progress = readJSON(KEYS.progress, {});
if (!progress || typeof progress !== 'object' || Array.isArray(progress)) progress = {};

const isSeen = q => !!(progress[q.id] && progress[q.id].n > 0);
function coverage() {
	let touched = 0;
	DATA.questions.forEach(q => { if (isSeen(q)) touched++; });
	return { touched, total: DATA.questions.length };
}
function totalAnswers() {
	let n = 0;
	DATA.questions.forEach(q => { if (progress[q.id]) n += progress[q.id].n || 0; });
	return n;
}
function recordResult(q, ok) {
	const p = progress[q.id] || { n: 0, c: 0 };
	const wasNew = !p.n;
	p.n++; if (ok) p.c++;
	p.last = Date.now(); p.ok = ok;
	progress[q.id] = p;
	writeJSON(KEYS.progress, progress);
	recordDaily();
	return wasNew;
}

/* ============================== 出題 ============================== */
// そのステップの問題を全部出す。順番は、まだ解いていない問題 → まちがえた問題 → いちばん前に解いた問題。
// 同じ古文・同じ文の問題は、続けて出す。
function pickSession(printId) {
	const groups = new Map();
	DATA.questions.filter(q => q.printId === printId).forEach(q => {
		const key = q.group || q.id;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(q);
	});
	const rank = g => {
		const seen = g.filter(isSeen);
		const unseen = g.length - seen.length;
		if (unseen > 0) return [0, -unseen / g.length];
		const wrong = seen.filter(q => progress[q.id].ok === false).length;
		if (wrong > 0) return [1, -wrong];
		return [2, Math.min(...seen.map(q => progress[q.id].last || 0))];
	};
	const list = shuffle(Array.from(groups.values())).map(g => ({ g: g.sort((a, b) => a.order - b.order), r: rank(g) }));
	list.sort((a, b) => (a.r[0] - b.r[0]) || (a.r[1] - b.r[1]));   // 同じ順位は、シャッフルのまま
	const ordered = [];
	list.forEach(x => ordered.push(...x.g));
	return ordered;
}

let session = null;       // { printId, ids, i, results, newIds }
function saveSession() { if (session) writeJSON(KEYS.session, session); }
function loadSession() {
	const s = readJSON(KEYS.session, null);
	if (!s || !Array.isArray(s.ids) || !s.results || typeof s.i !== 'number') return null;
	const ids = s.ids.filter(id => DATA.byId.has(id));
	if (!ids.length) return null;
	const results = {}, newIds = [];
	ids.forEach(id => { if (id in s.results) results[id] = s.results[id]; });
	(s.newIds || []).forEach(id => { if (ids.includes(id)) newIds.push(id); });
	let i = Math.min(s.i, ids.length - 1);
	if (ids[i] in results && i < ids.length - 1) i++;
	if (Object.keys(results).length >= ids.length) return null;
	return { printId: s.printId || null, ids, i, results, newIds };
}

/* ============================== 画面の切り替え ============================== */
let view = 'loading';
function show(name) {
	view = name;
	['loading', 'home', 'quiz', 'result'].forEach(v => { $(v + '-view').hidden = v !== name; });
	window.scrollTo(0, 0);
}
let toastTimer = 0;
function toast(msg) {
	const t = $('toast');
	t.textContent = msg; t.hidden = false;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

/* ============================== ホーム ============================== */
let justTouched = new Set();
function renderHome() {
	const { touched, total } = coverage();
	$('hero-total').textContent = total;
	$('hero-total2').textContent = total;
	$('hero-touched').textContent = touched;
	$('hero-mascot').innerHTML = mascot('smile', 86);
	$('stat-streak').textContent = calcStreak();
	$('stat-total').textContent = totalAnswers();

	// 点の地図：1問 = 1つの点
	const dm = $('dotmap');
	dm.innerHTML = '';
	let popIndex = 0;
	DATA.prints.forEach(p => {
		const qs = p.questions;
		const done = qs.filter(isSeen).length;
		const g = document.createElement('div');
		g.className = 'dg';
		g.innerHTML = `<div class="dg-label"><span>${esc(p.title)}</span><span>${done} / ${qs.length}</span></div>`;
		const dots = document.createElement('div');
		dots.className = 'dg-dots';
		qs.forEach(q => {
			const d = document.createElement('i');
			const pr = progress[q.id];
			d.className = 'dot' + (pr && pr.n ? (pr.ok === false ? ' ng' : ' ok') : '');
			if (justTouched.has(q.id) && !REDUCED) { d.classList.add('pop'); d.style.setProperty('--d', (popIndex++ * 22) + 'ms'); }
			dots.appendChild(d);
		});
		g.appendChild(dots);
		dm.appendChild(g);
	});
	justTouched = new Set();

	// 回ごとのボタン
	const rounds = [];
	DATA.prints.forEach(p => {
		let r = rounds.find(x => x.name === p.round);
		if (!r) { r = { name: p.round, prints: [] }; rounds.push(r); }
		r.prints.push(p);
	});
	$('rounds').innerHTML = rounds.map(r => {
		const all = r.prints.reduce((n, p) => n + p.questions.length, 0);
		const done = r.prints.reduce((n, p) => n + p.questions.filter(isSeen).length, 0);
		const steps = r.prints.map(p => {
			const d = p.questions.filter(isSeen).length;
			const pct = Math.round(d / p.questions.length * 100);
			return `<button class="step-btn${d >= p.questions.length ? ' done' : ''}" type="button" data-print="${esc(p.id)}">
				<span class="step-name">${esc(p.step)}</span>
				<span class="step-prog">${d >= p.questions.length ? 'ぜんぶ解いた！' : `${d} / ${p.questions.length}問`}</span>
				<span class="step-bar"><i style="width:${pct}%"></i></span>
			</button>`;
		}).join('');
		return `<div class="round-card"><div class="round-head"><h3 class="round-name">${esc(r.name)}</h3><span class="round-num"><b>${done}</b> / ${all}問</span></div><div class="steps">${steps}</div></div>`;
	}).join('');

	const s = loadSession();
	$('resume-area').hidden = !s;
	if (s) {
		const first = DATA.byId.get(s.ids[0]);
		const pr = first && DATA.prints.find(p => p.id === first.printId);
		$('resume-count').textContent = `${pr ? pr.title + '　' : ''}${Object.keys(s.results).length} / ${s.ids.length}問`;
	}
}

/* ============================== クイズ ============================== */
let cur = null, locked = false, praiseIndex = 0, shownPassage = null;

function startSession(printId) {
	const ids = pickSession(printId).map(q => q.id);
	if (!ids.length) return;
	session = { printId, ids, i: 0, results: {}, newIds: [] };
	saveSession();
	show('quiz');
	renderQuestion();
}
function resumeSession() {
	const s = loadSession();
	if (!s) return;
	session = s;
	show('quiz');
	renderQuestion();
}

function stripHTML(q) {
	if (!q.row) return '';
	const hit = q.hit || [];
	const cells = q.row.map((v, i) =>
		`<div class="cs-cell${hit.includes(i) ? ' hit' : ''}"><small>${FORMS_SHORT[i]}</small><b>${esc(v)}</b></div>`).join('');
	return `<div class="conj-strip"><p class="cs-title">「${esc(q.verb)}」の活用</p><div class="cs-grid">${cells}</div></div>`;
}

function renderPassage(q) {
	const box = $('passage');
	if (!q.passage) { box.hidden = true; shownPassage = null; return; }
	const print = DATA.prints.find(p => p.id === q.printId);
	const ps = print && print.passages && print.passages[q.passage];
	if (!ps) { box.hidden = true; shownPassage = null; return; }
	box.hidden = false;
	const key = q.printId + ':' + q.passage;
	if (shownPassage !== key) {
		const notes = [];
		$('passage-text').innerHTML = rich(ps.text, notes);
		$('passage-notes').innerHTML = notesHTML(notes);
		$('passage-title').textContent = '古文　' + ps.title;
		$('passage-scroll').scrollTop = 0;
		shownPassage = key;
	}
	const scroller = $('passage-scroll');
	scroller.querySelectorAll('.blank').forEach(el => el.classList.toggle('is-active', el.dataset.blank === String(q.blank)));
	const el = scroller.querySelector(`.blank[data-blank="${q.blank}"]`);
	if (el) {
		const top = el.offsetTop - scroller.clientHeight / 2 + el.offsetHeight / 2;
		scroller.scrollTo({ top: Math.max(0, top), behavior: REDUCED ? 'auto' : 'smooth' });
	}
}

function renderQuestion() {
	const id = session.ids[session.i];
	const q = DATA.byId.get(id);
	cur = q; locked = false;
	const n = session.ids.length;

	// 進み具合
	const done = Object.keys(session.results).length;
	const pct = Math.round(done / n * 100);
	$('progress-fill').style.width = pct + '%';
	$('progress-petal').style.left = pct + '%';
	$('progress').setAttribute('aria-valuenow', pct);
	$('quiz-count').textContent = `${session.i + 1} / ${n}`;

	renderPassage(q);

	$('q-tag').textContent = q.tag;
	$('q-new').hidden = isSeen(q);
	const print = DATA.prints.find(p => p.id === q.printId);
	$('q-ref').textContent = `${print ? print.title : ''}　${q.ref || ''}`;
	$('q-prompt').textContent = q.prompt;

	// 問題の見せ方
	const vis = $('q-visual');
	if (q.type === 'table') {
		vis.innerHTML = `<div class="tbl-q"><div class="tbl-wrap"><p class="tbl-cap">${esc(q.caption)}</p><div class="tbl-row"><div class="tbl-cell"><small>基本形</small><b>${esc(q.verb)}</b></div><span class="tbl-arrow" aria-hidden="true">→</span><div class="tbl-cell ask"><small>${esc(q.form)}</small><b>？</b></div></div></div></div>`;
	} else if (q.sentence) {
		const notes = [];
		vis.innerHTML = `<p class="q-sentence">${rich(q.sentence, notes)}</p><ol class="notes">${notesHTML(notes)}</ol>`;
	} else {
		vis.innerHTML = '';
	}

	// 選択肢
	const ch = $('choices');
	ch.innerHTML = '';
	q.choices.forEach((c, idx) => {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'choice';
		b.dataset.idx = idx;
		b.innerHTML = `<span class="key">${idx + 1}</span><span class="ctext">${esc(c)}</span>`;
		b.addEventListener('click', () => choose(idx));
		ch.appendChild(b);
	});

	$('feedback').hidden = true;
	$('feedback').innerHTML = '';
	$('next-bar').hidden = true;
	$('fx').innerHTML = '';
	$('next-btn').textContent = session.i + 1 < n ? 'つぎへ' : 'けっかを見る';
	window.scrollTo({ top: 0 });
}

function choose(idx) {
	if (locked || !cur) return;
	locked = true;
	const q = cur;
	const picked = q.choices[idx];
	const ok = picked === q.answer;
	const wasNew = recordResult(q, ok);
	session.results[q.id] = ok;
	if (wasNew && !session.newIds.includes(q.id)) session.newIds.push(q.id);
	saveSession();

	const done = Object.keys(session.results).length;
	const pct = Math.round(done / session.ids.length * 100);
	$('progress-fill').style.width = pct + '%';
	$('progress-petal').style.left = pct + '%';
	$('progress').setAttribute('aria-valuenow', pct);

	document.querySelectorAll('#choices .choice').forEach((b, i) => {
		b.disabled = true;
		const isAns = q.choices[i] === q.answer;
		if (isAns) b.classList.add('is-correct');
		else if (i === idx) { b.classList.add('is-wrong'); if (!REDUCED) b.classList.add('shake'); }
		else b.classList.add('is-dim');
	});

	const fb = $('feedback');
	fb.className = 'feedback ' + (ok ? 'ok' : 'ng');
	const title = ok ? PRAISE[praiseIndex++ % PRAISE.length] : 'おしい！';
	fb.innerHTML = `<div class="fb-face">${mascot(ok ? 'happy' : 'oops', 56)}</div>
		<div class="fb-body">
			<p class="fb-title">${title}</p>
			${ok ? '' : `<p class="fb-ans">正解は <b>${esc(q.answer)}</b></p>`}
			<p class="fb-note">${esc(q.note || '')}</p>
			${stripHTML(q)}
		</div>`;
	fb.hidden = false;
	$('next-bar').hidden = false;
	if (ok) burst();
	const nb = $('next-btn');
	nb.focus({ preventScroll: true });
	fb.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
}

function burst() {
	if (REDUCED) return;
	const fx = $('fx');
	fx.innerHTML = '';
	for (let i = 0; i < 12; i++) {
		const el = document.createElement('span');
		el.className = 'petal-fx';
		el.style.setProperty('--x', (8 + Math.random() * 84) + '%');
		el.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
		el.style.setProperty('--rot', (Math.random() * 360 - 180) + 'deg');
		el.style.setProperty('--d', (i * 45) + 'ms');
		el.innerHTML = '<svg viewBox="-24 -24 48 48" width="14" height="14"><use href="#sakura"/></svg>';
		fx.appendChild(el);
	}
	setTimeout(() => { fx.innerHTML = ''; }, 1800);
}

function next() {
	if (!locked) return;
	if (session.i + 1 < session.ids.length) {
		session.i++;
		saveSession();
		renderQuestion();
	} else {
		finish();
	}
}

/* ============================== 結果 ============================== */
function finish() {
	const ids = session.ids;
	const printId = session.printId || (DATA.byId.get(ids[0]) || {}).printId;
	const correct = ids.filter(id => session.results[id]).length;
	const wrong = ids.filter(id => session.results[id] === false);
	const newCount = session.newIds.length;
	justTouched = new Set(session.newIds);
	store.del(KEYS.session);
	session = null;

	const { touched, total } = coverage();
	const order = DATA.prints.map(p => p.id);
	const nextPrint = DATA.prints[(order.indexOf(printId) + 1) % order.length];
	const ratio = ids.length ? correct / ids.length : 0;
	const C = 2 * Math.PI * 60;
	const msg = ratio >= 0.9 ? 'かんぺき！' : ratio >= 0.7 ? 'よくできました！' : ratio >= 0.5 ? 'あと少し！' : 'ここからのびます！';
	const wrongHTML = wrong.length ? `<details class="wrong-list"><summary>まちがえた問題 ${wrong.length}問を見る</summary><ul>${wrong.map(id => {
		const q = DATA.byId.get(id);
		const s = q.sentence ? `<p class="wl-s">${esc(plain(q.sentence))}</p>` : '';
		return `<li><p class="wl-ref">${esc(q.ref || '')}　${esc(q.tag)}</p><p class="wl-q">${esc(q.prompt)}</p>${s}<p class="wl-a">正解は <b>${esc(q.answer)}</b></p></li>`;
	}).join('')}</ul></details>` : '';

	$('result-box').innerHTML = `
		<div class="result-hero">
			${mascot(ratio >= 0.5 ? 'happy' : 'smile', 96)}
			<h2>${msg}</h2>
			<div class="score-ring">
				<svg viewBox="0 0 140 140" aria-hidden="true"><circle class="bg" cx="70" cy="70" r="60" fill="none" stroke-width="14"/><circle class="fg" id="ring-fg" cx="70" cy="70" r="60" fill="none" stroke-width="14" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/></svg>
				<div class="num"><span>${correct} / ${ids.length}</span><small>せいかい</small></div>
			</div>
			<div class="result-lines">
				<p>はじめて解いた問題　<b>${newCount}</b>問</p>
				<p>ぜんぶで　<b>${touched}</b> / ${total}問に、ふれました</p>
			</div>
		</div>
		${wrongHTML}
		<div class="result-actions">
			<button class="btn-sticker" id="again-btn" type="button"><span class="btn-label">${esc(nextPrint.round)}　${esc(nextPrint.step)}へ</span><span class="btn-count">${nextPrint.questions.length}問</span></button>
			<button class="btn-ghost" id="home-btn" type="button">ホームにもどる</button>
		</div>`;
	show('result');
	$('again-btn').addEventListener('click', () => startSession(nextPrint.id));
	$('home-btn').addEventListener('click', () => { renderHome(); show('home'); });
	requestAnimationFrame(() => requestAnimationFrame(() => {
		const fg = $('ring-fg');
		if (fg) fg.style.strokeDashoffset = (C * (1 - ratio)).toFixed(1);
	}));
}

/* ============================== イベント ============================== */
function goHome() { renderHome(); show('home'); if (pendingRaw) applyPending(); }

function bindEvents() {
	$('rounds').addEventListener('click', e => {
		const b = e.target.closest('.step-btn');
		if (b) startSession(b.dataset.print);
	});
	$('resume-btn').addEventListener('click', resumeSession);
	$('restart-btn').addEventListener('click', () => {
		const s = loadSession();
		store.del(KEYS.session);
		const first = s && DATA.byId.get(s.ids[0]);
		if (first) startSession(first.printId); else renderHome();
	});
	$('next-btn').addEventListener('click', next);
	$('quit-btn').addEventListener('click', () => {
		const d = $('quit-dialog');
		if (typeof d.showModal === 'function') d.showModal();
		else if (window.confirm('ここでやめますか？ここまでの答えは保存されています。')) goHome();
	});
	$('quit-stay').addEventListener('click', () => $('quit-dialog').close());
	$('quit-go').addEventListener('click', () => { $('quit-dialog').close(); goHome(); });
	$('loading-retry').addEventListener('click', boot);

	document.addEventListener('keydown', e => {
		if (view !== 'quiz' || e.ctrlKey || e.metaKey || e.altKey) return;
		if (document.querySelector('dialog[open]')) return;
		if (/^[1-9]$/.test(e.key) && !locked) {
			const i = Number(e.key) - 1;
			if (cur && i < cur.choices.length) { e.preventDefault(); choose(i); }
		} else if (e.key === 'Enter' && locked && !(e.target.closest && e.target.closest('button'))) {
			e.preventDefault(); next();
		}
	});
}

/* ============================== テンシ ポータル連携 ============================== */
const PORTAL_KEY_HASH = /^#portal-link=([0-9A-Fa-f-]{8,64})$/;

function openPortalCard() {
	if (view === 'quiz' || view === 'result') goHome();
	const card = $('portal-card');
	card.hidden = false;
	setTimeout(() => {
		card.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
		const input = document.querySelector('#portal-link input');
		if (input) input.focus({ preventScroll: true });
	}, 250);
}

async function runPortalLinkDialog(key) {
	const dialog = $('portal-confirm');
	const text = $('portal-confirm-text');
	const ok = $('portal-confirm-ok');
	const cancel = $('portal-confirm-cancel');
	const defaultMessage = 'テンシ ポータルと連携しますか？ 送られるのは日ごとの回答数だけで、ポータルのランキングに反映されます。';
	const statusPromise = window.PortalClient.linkStatus().catch(error => {
		console.error('連携の状態を確認できませんでした。', error);
		return null;
	});
	const linkedMessage = status => status && status.linked
		? `この端末はすでに「${status.nickname || ''}」として連携しています。このキーで連携し直しますか？`
		: defaultMessage;
	if (typeof dialog.showModal !== 'function') {
		if (!window.confirm(linkedMessage(await statusPromise))) return;
		try {
			await window.PortalClient.link(key);
			window.PortalClient.syncNow();
			window.alert('連携しました。ポータルに戻って、画面を更新してください。');
		} catch (error) {
			window.alert(`連携できませんでした：${error.message}`);
		}
		return;
	}
	let busy = false;
	text.textContent = defaultMessage;
	ok.hidden = false; ok.disabled = true; ok.textContent = '連携する';
	cancel.disabled = false; cancel.textContent = 'キャンセル';
	statusPromise.then(status => {
		if (busy || !dialog.open) return;
		text.textContent = linkedMessage(status);
		ok.disabled = false;
	});
	await new Promise(resolve => {
		const finishDialog = () => {
			dialog.removeEventListener('close', finishDialog);
			ok.onclick = null; cancel.onclick = null;
			resolve();
		};
		dialog.addEventListener('close', finishDialog);
		cancel.onclick = () => dialog.close();
		ok.onclick = async () => {
			busy = true;
			ok.disabled = true; cancel.disabled = true;
			text.textContent = '連携しています…';
			try {
				const result = await window.PortalClient.link(key);
				window.PortalClient.syncNow();
				text.textContent = `連携しました（${(result && result.nickname) || ''}）。ポータルに戻って、画面を更新してください。`;
				ok.hidden = true;
				cancel.textContent = '閉じる';
			} catch (error) {
				text.textContent = `連携できませんでした：${error.message}`;
				ok.disabled = false; ok.textContent = 'もう一度';
			}
			cancel.disabled = false;
		};
		dialog.showModal();
	});
}

async function handlePortalHash() {
	const match = PORTAL_KEY_HASH.exec(location.hash);
	if (match) {
		const key = match[1];
		history.replaceState(null, '', location.pathname + location.search);   // キーをURLに残さない
		try {
			await runPortalLinkDialog(key);
		} catch (error) {
			console.error('ポータル連携の確認画面でエラーが出ました。', error);
			window.alert(`ポータル連携を始められませんでした：${error.message}`);
		}
		return;
	}
	if (location.hash === '#portal-link') openPortalCard();
}

function initPortal() {
	try {
		if (!window.PortalClient) throw new Error('portal-client.js を読み込めませんでした。');
		window.PortalClient.init({
			url: window.PORTAL_SUPABASE_URL,
			key: window.PORTAL_SUPABASE_PUBLISHABLE_KEY,
			site: 'kobunbunpou',
			syncRpc: 'kobunbunpou_sync_daily',
			rankRpc: 'kobunbunpou_get_ranking',
			getDailyCounts: async () => loadDaily()
		});
		window.PortalClient.mountLinkBox('#portal-link');
		window.addEventListener('hashchange', handlePortalHash);
		handlePortalHash();
	} catch (error) {
		console.error('ポータル連携を開始できませんでした。', error);
		$('portal-card').hidden = true;
		if (location.hash.startsWith('#portal-link')) {
			history.replaceState(null, '', location.pathname + location.search);
			window.alert(`ポータル連携を開始できませんでした：${error.message}`);
		}
	}
}

/* ============================== 起動 ============================== */
async function boot() {
	show('loading');
	$('loading-retry').hidden = true;
	$('loading-title').textContent = '問題を準備しています';
	$('loading-sub').textContent = 'はじめだけ、すべての問題をダウンロードします。';
	$('loading-fill').style.width = '8%';

	const cached = readJSON(KEYS.data, null);
	if (isValidRaw(cached)) {
		DATA = buildIndex(cached);
		renderHome(); show('home');
		checkForUpdate(cached.version);
		return;
	}
	try {
		const raw = await downloadAll((d, t) => { $('loading-fill').style.width = Math.max(8, Math.round(d / t * 100)) + '%'; });
		saveData(raw);
		DATA = buildIndex(raw);
		renderHome(); show('home');
	} catch (e) {
		console.error(e);
		$('loading-title').textContent = '問題をダウンロードできませんでした';
		$('loading-sub').textContent = 'ネットワークにつながっているか、確かめてください。';
		$('loading-retry').hidden = false;
	}
}

$('loading-mascot').innerHTML = mascot('smile', 96);
bindEvents();
initPortal();
boot();
})();
