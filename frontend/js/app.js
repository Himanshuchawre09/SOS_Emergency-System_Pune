/* ============================================================
   frontend/js/app.js
   Shared utilities — all API calls use full URLs
   ============================================================ */
'use strict';

// ── API BASE URL (relative — works on any port/domain) ───
// Uses relative path so it works on localhost, port 8080,
// or any domain without CORS issues.
const BASE = 'http://localhost/sos_project/backend';

const API = {
  auth:            BASE + '/api_auth.php',
  log_call:        BASE + '/api_log_call.php',
  get_calls:       BASE + '/api_get_calls.php',
  cancel_sos:      BASE + '/api_cancel_sos.php',
  create_incident: BASE + '/api_create_incident.php',
  get_incidents:   BASE + '/api_get_incidents.php',
  update_incident: BASE + '/api_update_incident.php',
  assign_team:     BASE + '/api_assign_team.php',
  teams:           BASE + '/api_teams.php',
  hospitals:       BASE + '/api_hospitals.php',
  stats:           BASE + '/api_stats.php',
  register:        BASE + '/api_register.php',
};

// Pune city centre defaults
const PUNE = { lat: 18.5204, lng: 73.8567, zoom: 13 };

// ── HTTP HELPERS ──────────────────────────────────────────

async function GET(url, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const full = qs ? url + '?' + qs : url;
  const res  = await fetch(full, { method: 'GET' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function POST(url, body = {}, params = {}) {
  const qs   = new URLSearchParams(params).toString();
  const full = qs ? url + '?' + qs : url;
  const res  = await fetch(full, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const d = await res.json(); msg = d.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ── TOAST ─────────────────────────────────────────────────
function toast(title, sub, type = 'info') {
  const wrap = document.getElementById('toasts');
  if (!wrap) return;
  const icons = { ok:'fa-circle-check', err:'fa-circle-xmark', wrn:'fa-triangle-exclamation', info:'fa-circle-info' };
  const cls   = { ok:'ok', err:'err', wrn:'wrn', info:'' };
  const el = document.createElement('div');
  el.className = 'toast ' + (cls[type] || '');
  el.innerHTML =
    `<i class="fa-solid ${icons[type]||icons.info}"></i>` +
    `<div class="toast-b"><div class="toast-t">${esc(title)}</div>${sub?`<div class="toast-s">${esc(sub)}</div>`:''}</div>` +
    `<button class="toast-x" onclick="this.closest('.toast').remove()"><i class="fa-solid fa-xmark"></i></button>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ── DOM HELPERS ───────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function $(id) { return document.getElementById(id); }
function setText(id, val) { const e = $(id); if (e) e.textContent = val ?? ''; }
function setHtml(id, html) { const e = $(id); if (e) e.innerHTML = html; }

// ── FORMAT ────────────────────────────────────────────────
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', {
    day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit', hour12:true,
  });
}

function typeBadge(t) {
  const cls = { fire:'b-red', accident:'b-blue', flood:'b-blue', medical:'b-purple' };
  return `<span class="badge ${cls[t]||'b-gray'}">${esc(t||'—')}</span>`;
}

function statusBadge(s) {
  const cls = {
    ACTIVE:'b-red', PROCESSED:'b-blue', CANCELLED:'b-gray',
    ASSIGNED:'b-amber', CONTROLLED:'b-purple', CLOSED:'b-green',
    AVAILABLE:'b-green', BUSY:'b-amber',
  };
  return `<span class="badge ${cls[s]||'b-gray'}">${esc(s||'—')}</span>`;
}

function triageBadge(t) {
  const cls = { red:'b-red', yellow:'b-amber', green:'b-green', black:'b-gray' };
  return `<span class="badge ${cls[t]||'b-gray'}">${esc((t||'').toUpperCase())}</span>`;
}

// ── CLOCK ─────────────────────────────────────────────────
function startClock(id) {
  const el = $(id); if (!el) return;
  const tick = () => { el.textContent = new Date().toLocaleTimeString('en-IN', { hour12: false }) };
  tick(); setInterval(tick, 1000);
}

// ── MODAL ─────────────────────────────────────────────────
function openModal(id)  { $(id)?.classList.add('open') }
function closeModal(id) { $(id)?.classList.remove('open') }

// ── NAV ───────────────────────────────────────────────────
function navTo(page, el) {
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('active'));
  $('page-' + page)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  else document.querySelectorAll('.nav-item').forEach(n => {
    if (n.dataset.page === page) n.classList.add('active');
  });
  const titles = {
    dashboard:'📊 Dashboard', calls:'📞 Emergency Calls', incidents:'⚡ Incidents',
    create_inc:'➕ Create Incident', assign:'🚒 Assign Team', teams:'👥 Rescue Teams',
    hospitals:'🏥 Hospitals', stats:'📈 Statistics',
    sos:'🆘 SOS Dashboard', map:'🗺️ My Location', history:'📋 My History',
  };
  const titleEl = $('tb-title');
  if (titleEl) titleEl.textContent = titles[page] || page;
  window._page = page;
}

// ── AUTH — session-based (server side) ────────────────────
// No credentials stored in localStorage for security.
// All auth is via PHP session cookie (httponly).

async function checkSessionAndRedirect(expectedRole) {
  try {
    const res = await GET(API.auth, { action: 'check' });
    if (!res.success || !res.data) {
      window.location.href = 'index.html';
      return null;
    }
    const user = res.data;
    if (expectedRole && user.role !== expectedRole) {
      // Wrong role — redirect to correct dashboard
      window.location.href = user.role === 'admin' ? 'admin.html' : 'citizen.html';
      return null;
    }
    return user;
  } catch (e) {
    window.location.href = 'index.html';
    return null;
  }
}

async function logout() {
  try { await POST(API.auth, { action: 'logout' }); } catch (e) {}
  window.location.href = 'index.html';
}

// ── GEOLOCATION ───────────────────────────────────────────
function getGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      e => {
        // Fallback to Pune centre
        resolve({ lat: PUNE.lat, lng: PUNE.lng, fallback: true });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

// ── LEAFLET MARKER ────────────────────────────────────────
function mkMarker(lat, lng, color, emoji, popup) {
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 10px ${color};display:flex;align-items:center;justify-content:center;font-size:12px">${emoji}</div>`,
    iconSize: [26,26], iconAnchor: [13,13],
  });
  const m = L.marker([lat, lng], { icon });
  if (popup) m.bindPopup(popup);
  return m;
}

// ── TABLE ROWS ────────────────────────────────────────────
function loadingRow(cols) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:2rem"><div class="spin" style="margin:0 auto;border-top-color:var(--blue)"></div></td></tr>`;
}
function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}"><div class="empty"><i class="fa-solid fa-inbox"></i><p>${esc(msg)}</p></div></td></tr>`;
}
function errRow(cols, msg) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:1.2rem;color:var(--red);font-size:.82rem"><i class="fa-solid fa-triangle-exclamation" style="margin-right:5px"></i>${esc(msg)}</td></tr>`;
}

// ── CHART.JS DEFAULTS ─────────────────────────────────────
const CHART_DEF = {
  responsive: true,
  plugins: { legend: { labels: { color:'#7e92b0', font:{ family:'DM Sans', size:11 } } } },
  scales: {
    x: { ticks:{ color:'#7e92b0' }, grid:{ color:'rgba(255,255,255,.04)' } },
    y: { ticks:{ color:'#7e92b0', stepSize:1 }, grid:{ color:'rgba(255,255,255,.04)' }, beginAtZero:true },
  },
};
