/* ===============================================================
   ACE — Shared JavaScript
   =============================================================== */

const API_URL = 'https://ace-kappa-weld.vercel.app';
const TOKEN_KEY = 'ace_token';

/* Token helpers */
function getToken()  { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }
function logout() {
  clearToken();
  window.location.href = 'index.html';
}

/* API call */
async function apiCall(path, method, body) {
  method = method || 'GET';
  var token = getToken();
  var opts = {
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body)  opts.body = JSON.stringify(body);
  try {
    var res = await fetch(API_URL + '/api' + path, opts);
    try { return await res.json(); }
    catch(_) { return { status: 'error', message: 'Invalid JSON response.' }; }
  } catch(e) {
    console.error('[API]', e);
    return { status: 'error', message: 'Network error.' };
  }
}

/* Time remaining */
function getTimeRemaining(expiry) {
  if (!expiry) return '--';
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
