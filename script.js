/* ===============================================================
   ACE -- Shared JavaScript
   =============================================================== */

var API_URL = 'https://klient.vercel.app';
var TOKEN_KEY = 'ace_token';

/* Token helpers */
function getToken()   { return localStorage.getItem(TOKEN_KEY); }
function setToken(t)  { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }
function logout() {
  clearToken();
  window.location.href = 'index.html';
}

/* Core API call */
async function apiCall(path, method, body) {
  method = method || 'GET';

  /* --- Translate logical paths to real API paths --- */
  if (path === '/login') {
    var res = await _rawCall('/api/web/login', 'POST', { license: body.key });
    if (res.success === true) {
      return {
        status: 'success',
        token: res.token,
        role: res.admin ? 'admin' : 'user'
      };
    }
    return { status: 'error', message: res.message || 'Invalid license.' };
  }

  if (path.startsWith('/login_check')) {
    return await _rawCall('/api/web' + path, 'GET', null);
  }

  if (path === '/user' || path === '/panel') {
    var me = await _rawCall('/api/web/me', 'GET', null);
    if (me.admin) return { status: 'admin', role: 'admin', license: '__admin__' };
    return {
      status: 'ok',
      license:    me.license,
      expiry:     me.expiry,
      hwid:       me.hwid,
      username:   me.username || me.discord || null
    };
  }

  if (path === '/download') {
    return await _rawCall('/api/web/download', 'GET', null);
  }

  /* --- Admin endpoints --- */
  if (path === '/admin/stats' || path === '/admin/users') {
    return await _adminStats();
  }

  if (path === '/admin/action') {
    return await _adminAction(body);
  }

  if (path === '/admin/create_license') {
    return await _adminCreateLicense(body);
  }

  if (path === '/admin/publish') {
    return await _adminPublish(body);
  }

  /* Fallback: pass through directly */
  return await _rawCall('/api' + path, method, body);
}

/* Raw HTTP call */
async function _rawCall(fullPath, method, body) {
  method = method || 'GET';
  var token = getToken();
  var opts = {
    method: method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body)  opts.body = JSON.stringify(body);
  try {
    var res = await fetch(API_URL + fullPath, opts);
    try { return await res.json(); }
    catch (_) { return { status: 'error', message: 'Invalid server response.' }; }
  } catch (e) {
    console.error('[_rawCall]', e);
    return { status: 'error', message: 'Network error.' };
  }
}

/* Build aggregated admin stats from available endpoints */
async function _adminStats() {
  try {
    var cfg = await _rawCall('/api/admin/server-config', 'GET', null);
    var lic = await _rawCall('/api/admin/licenses', 'GET', null);
    var licenses = lic.licenses || [];
    var available = [];
    var users = {};
    var banned = [];
    licenses.forEach(function(l) {
      if (l.banned) { banned.push(l.hwid || l.key); }
      if (!l.hwid || l.hwid === 'Unclaimed') {
        available.push({ license: l.key, id: l.key, days: l.days });
      } else {
        users[l.key] = {
          license:  l.key,
          hwid:     l.hwid,
          expiry:   l.time_left,
          username: l.key,
          status:   l.banned ? 'banned' : 'active',
          ip:       null
        };
      }
    });
    return {
      status:    'success',
      users:     users,
      available: available,
      banned:    banned,
      version:   cfg.version || '--',
      total_users: Object.keys(users).length,
      available_licenses: available.length,
      active_bans: banned.length
    };
  } catch (e) {
    return { status: 'error', message: 'Failed to load stats.' };
  }
}

/* Map admin panel actions to real API calls */
async function _adminAction(body) {
  var action = body.action;
  var target = body.target;
  switch (action) {
    case 'ban':
      return await _rawCall('/api/admin/licenses/' + encodeURIComponent(target) + '/ban', 'PUT', null)
        .then(function(r) { return { status: r.success ? 'success' : 'error', message: r.success ? 'Banned.' : (r.detail || 'Error.') }; });
    case 'unban':
      return await _rawCall('/api/admin/licenses/' + encodeURIComponent(target) + '/unban', 'PUT', null)
        .then(function(r) { return { status: r.success ? 'success' : 'error', message: r.success ? 'Unbanned.' : (r.detail || 'Error.') }; });
    case 'reset':
      return await _rawCall('/api/admin/licenses/' + encodeURIComponent(target) + '/resetwid', 'PUT', null)
        .then(function(r) { return { status: r.success ? 'success' : 'error', message: r.success ? 'HWID reset.' : (r.detail || 'Error.') }; });
    case 'wipe':
      return await _rawCall('/api/admin/licenses/' + encodeURIComponent(target), 'DELETE', null)
        .then(function(r) { return { status: r.success ? 'success' : 'error', message: r.success ? 'Deleted.' : (r.detail || 'Error.') }; });
    case 'take_license':
      return await _rawCall('/api/admin/licenses/' + encodeURIComponent(target), 'DELETE', null)
        .then(function(r) { return { status: r.success ? 'success' : 'error', message: r.success ? 'License taken.' : (r.detail || 'Error.') }; });
    case 'give_license':
      return await _adminCreateLicense({ days: body.days || 30, prefix: body.prefix || '' });
    default:
      return { status: 'error', message: 'Unknown action: ' + action };
  }
}

/* Create a license key */
async function _adminCreateLicense(body) {
  var days   = body.days   || 30;
  var prefix = body.prefix || '';
  var duration = 'day';
  if (days >= 365) duration = 'perm';
  else if (days >= 30) duration = 'month';
  else if (days >= 7)  duration = 'week';
  var res = await _rawCall('/api/admin/licenses', 'POST', { duration: duration });
  if (res.success) {
    var key = (prefix || '') + res.key;
    return { status: 'success', license: key, expiry: days + ' days', message: 'Key created.' };
  }
  return { status: 'error', message: res.detail || 'Failed.' };
}

/* Publish/deploy update */
async function _adminPublish(body) {
  var version = body.version || '';
  var r = await _rawCall('/api/admin/version', 'PUT', { version: version });
  if (r.success) return { status: 'success', message: 'Version set to ' + version + '.' };
  return { status: 'error', message: r.detail || 'Error.' };
}

/* Time remaining helper */
function getTimeRemaining(expiry) {
  if (!expiry) return '--';
  if (typeof expiry === 'string' && isNaN(Number(expiry))) return expiry;
  var now  = Date.now();
  var end  = (typeof expiry === 'number') ? expiry * 1000 : new Date(expiry).getTime();
  var diff = end - now;
  if (isNaN(diff) || diff <= 0) return 'Expired';
  var days  = Math.floor(diff / 86400000);
  var hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return days + 'd ' + hours + 'h';
  var mins  = Math.floor((diff % 3600000) / 60000);
  return hours + 'h ' + mins + 'm';
}

/* Toast notifications */
function showToast(msg, type, duration) {
  type     = type     || 'info';
  duration = duration || 4000;
  var container = document.getElementById('toast-container');
  if (!container) return;
  var icons = { success: '\u2713', error: '\u2715', warning: '\u26a0', info: '\u2139' };
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<span class="toast-icon">' + (icons[type] || '\u2139') + '</span><span>' + msg + '</span>';
  toast.onclick   = function() { dismissToast(toast); };
  container.appendChild(toast);
  setTimeout(function() { dismissToast(toast); }, duration);
}

function dismissToast(t) {
  t.classList.add('toast-hide');
  t.addEventListener('animationend', function() { t.remove(); }, { once: true });
}
