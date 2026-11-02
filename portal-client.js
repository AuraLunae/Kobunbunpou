/* Tensei Portal sync client. Sends daily answer counts only. */
(function (global) {
	'use strict';

	let config = null;
	const state = { enabled: false, error: '', lastSync: 0 };
	let kickTimer = null;
	let retryTimer = null;
	let failures = 0;
	let again = false;
	let inFlight = null;
	let lastSent = null;

	const memory = {};
	function storageGet(key) {
		try {
			return global.localStorage.getItem(key);
		} catch {
			return memory[key] ?? null;
		}
	}

	function storageSet(key, value) {
		try {
			global.localStorage.setItem(key, value);
		} catch {
			memory[key] = value;
		}
	}

	function sessionKey() {
		return `portal-session:${config.site}`;
	}

	function headers(token) {
		return {
			apikey: config.key,
			Authorization: `Bearer ${token || config.key}`,
			'Content-Type': 'application/json'
		};
	}

	function timeout(ms) {
		if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
			return { signal: AbortSignal.timeout(ms), done() {} };
		}
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), ms);
		return { signal: controller.signal, done: () => clearTimeout(timer) };
	}

	function request(path, body, token) {
		const timer = timeout(20000);
		return fetch(`${config.url}${path}`, {
			method: 'POST',
			headers: headers(token),
			body: JSON.stringify(body),
			signal: timer.signal
		}).then(async response => {
			const result = await response.json().catch(() => null);
			timer.done();
			if (!response.ok) {
				const error = new Error(result?.message || result?.msg || result?.error_description || `HTTP ${response.status}`);
				error.status = response.status;
				throw error;
			}
			return result;
		}, error => {
			timer.done();
			const wrapped = new Error(
				error?.name === 'TimeoutError' || error?.name === 'AbortError'
					? '通信がタイムアウトしました。'
					: 'ネットワークに接続できません。'
			);
			wrapped.network = true;
			throw wrapped;
		});
	}

	function packSession(result) {
		return {
			access_token: result.access_token,
			refresh_token: result.refresh_token,
			expires_at: result.expires_at || Math.floor(Date.now() / 1000 + (result.expires_in || 3600))
		};
	}

	function readSession() {
		try {
			return JSON.parse(storageGet(sessionKey()) || 'null');
		} catch {
			return null;
		}
	}

	function writeSession(session) {
		storageSet(sessionKey(), JSON.stringify(session));
	}

	function withLock(callback) {
		if (global.navigator?.locks) {
			return global.navigator.locks.request(`portal-session:${config.site}`, { mode: 'exclusive' }, callback);
		}
		return Promise.resolve().then(callback);
	}

	function getSession(forceRefresh) {
		return withLock(() => {
			const session = readSession();
			if (session && !forceRefresh && session.expires_at - 60 > Date.now() / 1000) {
				return session;
			}

			const signup = () => request('/auth/v1/signup', { data: {}, gotrue_meta_security: {} })
				.then(result => {
					const nextSession = packSession(result);
					writeSession(nextSession);
					return nextSession;
				});

			if (!session?.refresh_token) return signup();
			return request('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token })
				.then(result => {
					const nextSession = packSession(result);
					writeSession(nextSession);
					return nextSession;
				}, error => {
					if (error.network || !error.status || error.status >= 500 || error.status === 429) throw error;
					return signup();
				});
		});
	}

	function rpc(name, body) {
		function call(attempt) {
			return getSession(attempt > 0).then(session =>
				request(`/rest/v1/rpc/${name}`, body || {}, session.access_token).catch(error => {
					if (error.status === 401 && attempt === 0) return call(1);
					throw error;
				})
			);
		}
		return call(0);
	}

	function cleanCounts(raw) {
		const result = {};
		if (!raw || typeof raw !== 'object') return result;
		Object.keys(raw).sort().slice(-400).forEach(day => {
			const count = raw[day];
			if (/^\d{4}-\d{2}-\d{2}$/.test(day) && typeof count === 'number' && Number.isFinite(count) && count >= 0) {
				result[day] = Math.min(100000, Math.floor(count));
			}
		});
		return result;
	}

	function syncNow() {
		if (!state.enabled) return Promise.resolve(false);
		if (inFlight) {
			again = true;
			return inFlight;
		}
		clearTimeout(retryTimer);
		inFlight = Promise.resolve().then(() => {
			if (global.navigator?.onLine === false) {
				state.error = 'オフライン';
				return false;
			}
			return config.getDailyCounts();
		}).then(raw => {
			if (raw === false) return false;
			const days = cleanCounts(raw);
			if (!Object.keys(days).length) {
				lastSent = '{}';
				return true;
			}
			return rpc(config.syncRpc, { p_days: days }).then(() => {
				lastSent = JSON.stringify(days);
				state.error = '';
				state.lastSync = Date.now();
				failures = 0;
				return true;
			});
		}).catch(error => {
			state.error = error?.message || '同期できませんでした。';
			failures++;
			retryTimer = setTimeout(syncNow, Math.min(5000 * (2 ** failures), 600000));
			return false;
		}).then(result => {
			inFlight = null;
			if (again) {
				again = false;
				return syncNow();
			}
			return result;
		});
		return inFlight;
	}

	function kick() {
		if (!state.enabled) return;
		clearTimeout(kickTimer);
		kickTimer = setTimeout(syncNow, 1500);
	}

	function requireInit() {
		if (!state.enabled) throw new Error('PortalClient.init() が呼ばれていません。');
	}

	function wrap(promise) {
		return promise.catch(error => {
			if (error?.network) throw new Error('オフラインのため実行できません。');
			throw error;
		});
	}

	function link(key) {
		requireInit();
		return wrap(rpc('redeem_link_key', { p_key: String(key || '').trim(), p_site: config.site }));
	}

	function unlink() {
		requireInit();
		return wrap(rpc('unlink_self', { p_site: config.site }));
	}

	function linkStatus() {
		requireInit();
		return wrap(rpc('link_status', { p_site: config.site }));
	}

	function ranking() {
		requireInit();
		return syncNow().then(() => wrap(rpc(config.rankRpc)));
	}

	function mountLinkBox(target) {
		requireInit();
		const root = typeof target === 'string' ? document.querySelector(target) : target;
		if (!root) throw new Error(`mountLinkBox: 表示先の要素が見つかりません（${target}）`);
		if (!document.getElementById('portal-client-style')) {
			const style = document.createElement('style');
			style.id = 'portal-client-style';
			style.textContent = '.pc-box{font:inherit;color:inherit}.pc-box p{margin:8px 0;font-size:13px;line-height:1.8}' +
				'.pc-box input{width:100%;box-sizing:border-box;font:inherit;font-size:15px;letter-spacing:.1em;text-transform:uppercase;padding:10px 12px;border:1px solid #e2e8f0;background:white;color:inherit;border-radius:9px}' +
				'.pc-box button{font:inherit;font-size:14px;padding:10px 16px;margin:12px 12px 0 0;border:1px solid #6d5bd0;background:white;color:#6d5bd0;cursor:pointer;border-radius:9px}' +
				'.pc-box button:disabled{opacity:.4;cursor:default}.pc-box .pc-muted{color:#64748b;font-size:12px}';
			document.head.appendChild(style);
		}

		function element(tag, text, className) {
			const node = document.createElement(tag);
			if (text) node.textContent = text;
			if (className) node.className = className;
			return node;
		}

		const box = element('div', '', 'pc-box');
		const status = element('p', '確認しています…');
		const label = element('label', '連携キー');
		const input = document.createElement('input');
		const connect = element('button', '連携する');
		const disconnect = element('button', '連携を解除');
		const message = element('p', '', 'pc-muted');
		const note = element('p', 'ポータルで発行したキーを貼ると、他のサイトとランキングを共有できます。送信するのは日ごとの回答数だけです。', 'pc-muted');

		input.type = 'text';
		input.autocomplete = 'off';
		input.spellcheck = false;
		input.placeholder = 'XXXX-XXXX-XXXX-…';
		input.setAttribute('autocapitalize', 'characters');
		connect.type = 'button';
		disconnect.type = 'button';
		disconnect.hidden = true;
		label.appendChild(input);
		[status, label, connect, disconnect, message, note].forEach(node => box.appendChild(node));
		root.replaceChildren(box);

		function refresh() {
			status.textContent = '確認しています…';
			return linkStatus().then(result => {
				if (result?.linked) {
					status.textContent = `連携中：${result.nickname || ''}${result.banned ? '（ランキングには表示されていません。ポータルで確認してください）' : ''}`;
					disconnect.hidden = false;
				} else {
					status.textContent = 'まだ連携していません。';
					disconnect.hidden = true;
				}
			}).catch(error => {
				status.textContent = error.message || '連携の状態を確認できませんでした。';
			});
		}

		connect.addEventListener('click', () => {
			const value = input.value.trim();
			if (!value) {
				message.textContent = 'キーを貼り付けてください。';
				return;
			}
			connect.disabled = true;
			message.textContent = '連携しています…';
			link(value).then(result => {
				input.value = '';
				message.textContent = result?.replaced ? '連携しました。以前の連携は解除されました。' : '連携しました。';
				syncNow();
			}).catch(error => {
				message.textContent = error.message || '連携できませんでした。';
			}).then(() => {
				connect.disabled = false;
				return refresh();
			});
		});

		disconnect.addEventListener('click', () => {
			if (!global.confirm('ポータルとの連携を解除しますか？記録は消えません。')) return;
			disconnect.disabled = true;
			message.textContent = '解除しています…';
			unlink().then(() => {
				message.textContent = '連携を解除しました。';
			}).catch(error => {
				message.textContent = error.message || '解除できませんでした。';
			}).then(() => {
				disconnect.disabled = false;
				return refresh();
			});
		});
		return refresh();
	}

	function init(options) {
		const errors = [];
		if (!options || typeof options !== 'object') throw new Error('PortalClient.init: 設定がありません。');
		if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(options.url || '')) errors.push('url は https://xxxx.supabase.co の形で指定してください');
		if (!options.key || /service_role/i.test(options.key)) errors.push('key は publishable（anon）キーを指定してください（service_role は使えません）');
		if (!/^[a-z][a-z0-9_]{1,30}$/.test(options.site || '')) errors.push('site は英小文字で始まり、英小文字・数字・_ だけの2〜31文字にしてください');
		if (options.site && options.syncRpc !== `${options.site}_sync_daily`) errors.push(`syncRpc は「${options.site}_sync_daily」にしてください`);
		if (options.site && options.rankRpc !== `${options.site}_get_ranking`) errors.push(`rankRpc は「${options.site}_get_ranking」にしてください`);
		if (typeof options.getDailyCounts !== 'function') errors.push('getDailyCounts は日付ごとの回答数を返す関数にしてください');
		if (errors.length) throw new Error(`PortalClient.init の設定エラー：\n・${errors.join('\n・')}`);

		config = {
			url: options.url.replace(/\/$/, ''),
			key: options.key,
			site: options.site,
			syncRpc: options.syncRpc,
			rankRpc: options.rankRpc,
			getDailyCounts: options.getDailyCounts
		};
		state.enabled = true;
		global.addEventListener('online', () => {
			failures = 0;
			syncNow();
		});
		global.addEventListener('focus', syncNow);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') syncNow();
		});
		setInterval(() => {
			if (!state.enabled || inFlight) return;
			Promise.resolve().then(() => config.getDailyCounts()).then(raw => {
				if (JSON.stringify(cleanCounts(raw)) !== lastSent) syncNow();
			}).catch(error => {
				state.error = error?.message || '日別回答数を読み込めませんでした。';
			});
		}, 60000);
		kick();
	}

	global.PortalClient = {
		init,
		kick,
		syncNow,
		link,
		unlink,
		linkStatus,
		ranking,
		mountLinkBox,
		state
	};
})(typeof window !== 'undefined' ? window : globalThis);
