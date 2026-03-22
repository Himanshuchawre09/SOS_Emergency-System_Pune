/* ============================================================
   frontend/js/citizen.js
   Citizen Dashboard — SOS, Map, History, Status
   ============================================================ */
'use strict';

// ── STATE ─────────────────────────────────────────────────
let _user        = null;
let _lat         = null;
let _lng         = null;
let _activeCallId= null;   // ID of the current SOS call in DB
let _pendingType = null;   // type waiting for confirm modal
let _map         = null;
let _myMarker    = null;
let _sosMarker   = null;
let _pollTimer   = null;

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Session auth guard — redirects to login if not authenticated
  _user = await checkSessionAndRedirect('user');
  if (!_user) return;

  // Show user name in sidebar
  setText('sb-name', _user.name || _user.phone);

  // Start live clock
  startClock('clock');

  // Get GPS location
  refreshGPS();

  // Poll for status updates every 6 seconds
  _pollTimer = setInterval(pollStatus, 6000);
});

// ── GPS / LOCATION ────────────────────────────────────────
async function refreshGPS() {
  setText('loc-label', 'Fetching GPS location...');
  setText('loc-coords', '');
  try {
    const pos = await getGPS();
    _lat = pos.lat;
    _lng = pos.lng;
    const label = pos.fallback
      ? 'Using Pune default location'
      : 'Location acquired — Pune';
    setText('loc-label', label);
    setText('loc-coords', _lat.toFixed(5) + ', ' + _lng.toFixed(5));

    // Update map marker if map is open
    if (_map && _myMarker) {
      _myMarker.setLatLng([_lat, _lng]);
    }
  } catch (e) {
    // Final fallback — Pune centre
    _lat = PUNE.lat;
    _lng = PUNE.lng;
    setText('loc-label', 'GPS unavailable — using Pune centre');
    setText('loc-coords', _lat.toFixed(5) + ', ' + _lng.toFixed(5));
  }
}

// ── MAP ───────────────────────────────────────────────────
function initMap() {
  // Only initialise once
  if (_map) {
    setTimeout(() => _map.invalidateSize(), 120);
    return;
  }
  const lat = _lat || PUNE.lat;
  const lng = _lng || PUNE.lng;

  _map = L.map('user-map', { center: [lat, lng], zoom: PUNE.zoom });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(_map);

  _myMarker = mkMarker(lat, lng, '#38bdf8', '📍', '<b>Your Location</b>').addTo(_map);
}

function centerMap() {
  if (_map && _lat) _map.setView([_lat, _lng], 15);
}

function placeSosMarker(lat, lng, type) {
  if (!_map) return;
  const colors = { fire:'#ea580c', accident:'#2563eb', flood:'#0891b2', medical:'#a21caf' };
  const emojis = { fire:'🔥', accident:'🚗', flood:'🌊', medical:'🏥' };
  if (_sosMarker) _sosMarker.remove();
  _sosMarker = mkMarker(
    lat, lng,
    colors[type] || '#f43f5e',
    emojis[type] || '🆘',
    `<b>SOS Sent</b><br>${type.toUpperCase()}`
  ).addTo(_map);
}

// ── SOS FLOW ──────────────────────────────────────────────

/**
 * Step 1 — User taps an SOS button.
 * Show confirm modal with current location.
 */
function triggerSOS(type, btnEl) {
  // Prevent double-SOS
  if (_activeCallId) {
    toast('Already Active', 'You have an active SOS. Cancel it first.', 'wrn');
    return;
  }

  // Ripple animation
  const r = document.createElement('span');
  r.className = 'rpl';
  const rect = btnEl.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  r.style.cssText = `width:${size}px;height:${size}px;left:${(rect.width-size)/2}px;top:${(rect.height-size)/2}px`;
  btnEl.appendChild(r);
  setTimeout(() => r.remove(), 600);

  _pendingType = type;

  // Fill modal
  const labels = { fire:'🔥 Fire Emergency', accident:'🚗 Accident Alert', flood:'🌊 Flood Emergency', medical:'🏥 Medical Emergency' };
  setText('modal-sos-type', labels[type] || type);

  const locText = (_lat && !(_lat === PUNE.lat && _lng === PUNE.lng))
    ? `GPS: ${_lat.toFixed(5)}, ${_lng.toFixed(5)}`
    : `Pune default: ${PUNE.lat}, ${PUNE.lng}`;
  setText('modal-loc', locText);

  openModal('sos-modal');
}

/**
 * Step 2 — User confirms in modal.
 * POST to api_log_call.php and update UI.
 */
async function confirmSOS() {
  const type = _pendingType;
  if (!type) return;

  const btn = $('sos-confirm-btn');
  btn.innerHTML = '<div class="spin"></div> Sending...';
  btn.disabled = true;

  const lat = _lat || PUNE.lat;
  const lng = _lng || PUNE.lng;

  try {
    const res = await POST(API.log_call, {
      type:         type,
      latitude:     lat,
      longitude:    lng,
      caller_name:  _user.name  || 'Anonymous',
      caller_phone: _user.phone || '',
      address:      `${lat.toFixed(5)}, ${lng.toFixed(5)} — Pune`,
    });

    if (res.success) {
      const call = res.data;         // response.data is the call object directly
      _activeCallId = call.id;

      closeModal('sos-modal');
      showActiveBanner(type, call.created_at);
      updateStatusPanel(call, null);

      // Put a red dot on the map
      placeSosMarker(lat, lng, type);
      if (!_map) initMap();

      toast('SOS Sent!', 'Pune control room has been notified.', 'ok');
    } else {
      toast('Failed', res.error || 'Could not send SOS', 'err');
    }
  } catch (e) {
    toast('Error', e.message, 'err');
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send SOS';
    btn.disabled  = false;
  }
}

/**
 * Cancel the active SOS call.
 */
async function cancelSOS() {
  if (!_activeCallId) return;
  if (!confirm('Cancel your active SOS?')) return;

  try {
    const res = await POST(API.cancel_sos, { call_id: _activeCallId });
    if (res.success) {
      _activeCallId = null;
      $('active-banner').style.display = 'none';
      resetStatusPanel();
      toast('SOS Cancelled', 'Your alert has been withdrawn.', 'wrn');
    } else {
      toast('Error', res.error, 'err');
    }
  } catch (e) {
    toast('Error', e.message, 'err');
  }
}

// ── POLL — check if call/incident status changed ──────────
async function pollStatus() {
  if (!_activeCallId) return;

  try {
    // Fetch all calls and find ours
    const res = await GET(API.get_calls);
    if (!res.success) return;

    const calls  = res.data.calls || [];
    const myCall = calls.find(c => c.id === _activeCallId);

    if (!myCall) return;

    // If cancelled externally or processed
    if (myCall.status === 'CANCELLED') {
      _activeCallId = null;
      $('active-banner').style.display = 'none';
      resetStatusPanel();
      return;
    }

    // Build a simple display object including incident info from the join
    updateStatusPanel(myCall, myCall);

    // If incident closed, clear active state
    if (myCall.incident_status === 'CLOSED') {
      setTimeout(() => {
        _activeCallId = null;
        $('active-banner').style.display = 'none';
        resetStatusPanel();
        toast('Resolved', 'Your incident has been closed.', 'ok');
      }, 2000);
    }
  } catch (e) {
    // Silent — poll failure should not disturb UX
  }
}

// ── UI HELPERS ────────────────────────────────────────────
function showActiveBanner(type, time) {
  const labels = { fire:'🔥 Fire', accident:'🚗 Accident', flood:'🌊 Flood', medical:'🏥 Medical' };
  setText('banner-type', 'SOS Active — ' + (labels[type] || type));
  setText('banner-time', 'Sent at ' + new Date(time).toLocaleTimeString('en-IN'));
  $('active-banner').style.display = 'flex';
}

function updateStatusPanel(call, extra) {
  $('no-incident').style.display  = 'none';
  $('inc-details').style.display  = 'block';

  setText('s-callid', '#' + call.id);
  setHtml('s-type',       typeBadge(call.type));
  setHtml('s-callstatus', statusBadge(call.status));
  setHtml('s-incstatus',  call.incident_status ? statusBadge(call.incident_status) : '<span style="color:var(--txt2)">—</span>');
  setText('s-team',  call.team_name  || '—');
  setText('s-time',  fmtDate(call.created_at));
}

function resetStatusPanel() {
  $('no-incident').style.display = 'block';
  $('inc-details').style.display = 'none';
  ['s-callid','s-team','s-time'].forEach(id => setText(id, '—'));
  ['s-type','s-callstatus','s-incstatus'].forEach(id => setHtml(id, '—'));
}

// ── HISTORY ───────────────────────────────────────────────
async function loadHistory() {
  const tbody = $('history-tbody');
  if (!tbody) return;
  tbody.innerHTML = loadingRow(6);

  try {
    // Get all calls — we filter by caller_phone client-side since there's no session
    const res = await GET(API.get_calls);
    if (!res.success) throw new Error(res.error);

    const calls = (res.data.calls || []).filter(c => {
      // Match by phone if available; otherwise show all (single user device)
      return !_user.phone || c.caller_phone === _user.phone || c.caller_phone === '';
    });

    if (!calls.length) {
      tbody.innerHTML = emptyRow(6, 'No SOS history yet.');
      return;
    }

    tbody.innerHTML = calls.map(c => `
      <tr>
        <td style="font-family:monospace;color:var(--blue)">#${c.id}</td>
        <td>${typeBadge(c.type)}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${c.incident_status ? statusBadge(c.incident_status) : '—'}</td>
        <td style="font-size:.78rem;color:var(--txt2)">${esc(c.address || (c.latitude + ', ' + c.longitude))}</td>
        <td style="font-size:.75rem;color:var(--txt2)">${fmtDate(c.created_at)}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = errRow(6, e.message);
  }
}
