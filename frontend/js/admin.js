/* ============================================================
   frontend/js/admin.js
   Admin Dashboard — full logic, all pages
   ============================================================ */
'use strict';

// ── STATE ─────────────────────────────────────────────────
let _admin       = null;
let _adminMap    = null;
let _mapMarkers  = [];
let _allCalls    = [];
let _allInc      = [];
let _allTeams    = [];
let _selIncId    = null;    // for status update modal
let _pollTimer   = null;
let _charts      = {};      // keyed by canvas id

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  _admin = await checkSessionAndRedirect('admin');
  if (!_admin) return;

  setText('sb-name', _admin.name || _admin.phone);
  startClock('clock');

  // Hook page switches for lazy loading
  document.querySelectorAll('.nav-item[data-page]').forEach(n => {
    n.addEventListener('click', () => onSwitch(n.dataset.page));
  });

  // Initial dashboard load
  loadDashboard();

  // Poll dashboard every 8 seconds
  _pollTimer = setInterval(loadDashboard, 8000);
});

// ── PAGE ROUTING ──────────────────────────────────────────
function go(page, el) {
  navTo(page, el);
  onSwitch(page);
}

function onSwitch(page) {
  const map = {
    dashboard:  loadDashboard,
    calls:      loadCalls,
    incidents:  loadIncidents,
    create_inc: loadCreateInc,
    assign:     loadAssign,
    teams:      loadTeams,
    hospitals:  loadHospitals,
    stats:      loadStats,
  };
  if (map[page]) map[page]();
}

// ── DASHBOARD ─────────────────────────────────────────────
async function loadDashboard() {
  try {
    const res = await GET(API.stats);
    if (!res.success) return;
    const d = res.data;

    // Stat cards
    setText('d-calls',     d.calls?.total      ?? 0);
    setText('d-active',    d.incidents?.active  ?? 0);
    setText('d-teams',     d.teams?.available   ?? 0);
    setText('d-casualties',d.casualties?.total  ?? 0);

    // Nav badge
    setText('nb-calls', d.calls?.active ?? 0);

    // Activity feed
    renderFeed(d.recent || []);

    // Dashboard charts
    renderDashCharts(d);

    // Map
    initAdminMap();
    renderMapMarkers();
  } catch (e) {
    console.error('[Dashboard]', e.message);
  }
}

function renderFeed(events) {
  const el = $('activity-feed');
  if (!el) return;
  if (!events.length) {
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-inbox"></i><p>No activity yet</p></div>';
    return;
  }
  const emojis = { fire:'🔥', accident:'🚗', flood:'🌊', medical:'🏥' };
  el.innerHTML = events.map(e => `
    <div style="display:flex;align-items:flex-start;gap:.55rem;padding:.55rem;border-radius:6px;background:var(--bg3);margin-bottom:.4rem;border-left:3px solid ${e.event_type==='call'?'var(--red)':'var(--amber)'}">
      <span style="font-size:.95rem;flex-shrink:0">${emojis[e.type]||'🆘'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--ff-head);font-size:.82rem;font-weight:700;letter-spacing:.03em">${esc(e.event_type==='call'?'SOS Call':'Incident')} #${e.id} — ${esc(e.type)}</div>
        <div style="font-size:.68rem;color:var(--txt2);margin-top:1px">${fmtDate(e.created_at)}</div>
      </div>
      ${statusBadge(e.status)}
    </div>
  `).join('');
}

function renderDashCharts(d) {
  // Incidents by type
  const typeData = d.incidents_by_type_from_calls || [];
  // Use calls_by_type which is always populated
  const ct = d.calls_by_type || [];
  buildChart('ch-type', 'bar',
    ct.map(r => r.type.charAt(0).toUpperCase() + r.type.slice(1)),
    ct.map(r => parseInt(r.cnt)),
    ['rgba(234,88,12,.6)','rgba(37,99,235,.6)','rgba(8,145,178,.6)','rgba(162,28,175,.6)'],
    { legend: false }
  );

  // Incident status doughnut
  const inc = d.incidents || {};
  buildChart('ch-status', 'doughnut',
    ['Active','Assigned','Controlled','Closed'],
    [inc.active||0, inc.assigned||0, inc.controlled||0, inc.closed||0],
    ['rgba(244,63,94,.65)','rgba(251,146,60,.65)','rgba(167,139,250,.65)','rgba(52,211,153,.65)'],
    { cutout: '58%', legend: true }
  );
}

// ── ADMIN MAP ─────────────────────────────────────────────
function initAdminMap() {
  if (_adminMap) return;
  const el = $('admin-map');
  if (!el) return;

  _adminMap = L.map('admin-map', { center: [PUNE.lat, PUNE.lng], zoom: PUNE.zoom });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19,
  }).addTo(_adminMap);
}

async function renderMapMarkers() {
  if (!_adminMap) return;
  try {
    const res = await GET(API.get_incidents);
    if (!res.success) return;
    _mapMarkers.forEach(m => m.remove());
    _mapMarkers = [];

    const colors = { fire:'#ea580c', accident:'#2563eb', flood:'#0891b2', medical:'#a21caf' };
    const emojis = { fire:'🔥', accident:'🚗', flood:'🌊', medical:'🏥' };

    (res.data.incidents || []).forEach(inc => {
      const lat = parseFloat(inc.latitude  || inc.call_lat || PUNE.lat);
      const lng = parseFloat(inc.longitude || inc.call_lng || PUNE.lng);
      const m = mkMarker(lat, lng,
        colors[inc.type] || '#f43f5e',
        emojis[inc.type] || '🆘',
        `<b>#${inc.id} — ${esc(inc.type)}</b><br>${esc(inc.location)}<br>${statusBadge(inc.status)}`
      ).addTo(_adminMap);
      _mapMarkers.push(m);
    });
  } catch {}
}

// ── CALLS ─────────────────────────────────────────────────
async function loadCalls() {
  const tbody = $('calls-tbody');
  if (!tbody) return;
  tbody.innerHTML = loadingRow(9);
  try {
    const res = await GET(API.get_calls);
    if (!res.success) throw new Error(res.error);
    _allCalls = res.data.calls || [];
    renderCallsTable(_allCalls);
  } catch (e) {
    tbody.innerHTML = errRow(9, e.message);
  }
}

function renderCallsTable(calls) {
  const tbody = $('calls-tbody');
  if (!tbody) return;
  if (!calls.length) { tbody.innerHTML = emptyRow(9, 'No calls found.'); return; }

  tbody.innerHTML = calls.map(c => `
    <tr>
      <td style="font-family:monospace;color:var(--blue)">#${c.id}</td>
      <td style="font-size:.8rem">${esc(c.caller_name||'Anonymous')}</td>
      <td style="font-family:monospace;font-size:.75rem">${esc(c.caller_phone||'—')}</td>
      <td>${typeBadge(c.type)}</td>
      <td style="font-family:monospace;font-size:.72rem;color:var(--txt2)">${parseFloat(c.latitude).toFixed(4)}, ${parseFloat(c.longitude).toFixed(4)}</td>
      <td>${statusBadge(c.status)}</td>
      <td style="font-family:monospace;font-size:.74rem;color:var(--txt2)">${c.incident_id ? '#'+c.incident_id : '—'}</td>
      <td style="font-size:.73rem;color:var(--txt2)">${fmtDate(c.created_at)}</td>
      <td>
        ${c.status === 'ACTIVE'
          ? `<button class="btn btn-primary btn-sm" title="Create Incident" onclick="go('create_inc',null);prefillCall(${c.id})"><i class="fa-solid fa-plus"></i></button>`
          : '<span style="color:var(--txt3);font-size:.75rem">—</span>'
        }
      </td>
    </tr>
  `).join('');
}

function filterCalls() {
  const q  = ($('calls-q')?.value || '').toLowerCase();
  const st = $('calls-sf')?.value || '';
  const ty = $('calls-tf')?.value || '';
  const filtered = _allCalls.filter(c =>
    (!q  || String(c.id).includes(q) || (c.caller_name||'').toLowerCase().includes(q) || (c.caller_phone||'').includes(q)) &&
    (!st || c.status === st) &&
    (!ty || c.type   === ty)
  );
  renderCallsTable(filtered);
}

// ── INCIDENTS ─────────────────────────────────────────────
async function loadIncidents() {
  const tbody = $('inc-tbody');
  if (!tbody) return;
  tbody.innerHTML = loadingRow(8);
  try {
    const res = await GET(API.get_incidents);
    if (!res.success) throw new Error(res.error);
    _allInc = res.data.incidents || [];
    renderIncTable(_allInc);
  } catch (e) {
    tbody.innerHTML = errRow(8, e.message);
  }
}

function renderIncTable(list) {
  const tbody = $('inc-tbody');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = emptyRow(8,'No incidents yet.'); return; }

  const sevColors = ['','var(--green)','#6fce6f','var(--amber)','#ff6830','var(--red)'];
  tbody.innerHTML = list.map(i => `
    <tr>
      <td style="font-family:monospace;color:var(--blue)">#${i.id}</td>
      <td>${typeBadge(i.type)}</td>
      <td style="font-family:monospace;font-weight:700;color:${sevColors[i.severity]||'var(--txt)'}">${i.severity}/5</td>
      <td style="font-size:.79rem;color:var(--txt2);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.location)}</td>
      <td>${statusBadge(i.status)}</td>
      <td style="font-size:.78rem">${esc(i.teams||'—')}</td>
      <td style="font-size:.73rem;color:var(--txt2)">${fmtDate(i.created_at)}</td>
      <td style="display:flex;gap:.3rem;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" title="Update Status" onclick="openStatusModal(${i.id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-primary btn-sm" title="Assign Team" onclick="go('assign',null);prefillInc(${i.id})"><i class="fa-solid fa-truck-fast"></i></button>
      </td>
    </tr>
  `).join('');
}

function filterIncidents() {
  const q  = ($('inc-q')?.value || '').toLowerCase();
  const st = $('inc-sf')?.value || '';
  const filtered = _allInc.filter(i =>
    (!q  || i.location.toLowerCase().includes(q) || i.type.includes(q) || String(i.id).includes(q)) &&
    (!st || i.status === st)
  );
  renderIncTable(filtered);
}

// ── STATUS MODAL ──────────────────────────────────────────
function openStatusModal(id) {
  _selIncId = id;
  openModal('status-modal');
}

async function submitStatus() {
  if (!_selIncId) return;
  const status = $('new-status').value;
  try {
    const res = await POST(API.update_incident, { id: _selIncId, status });
    if (res.success) {
      closeModal('status-modal');
      toast('Updated', `Incident #${_selIncId} → ${status}`, 'ok');
      loadIncidents();
      loadDashboard();
    } else {
      toast('Error', res.error, 'err');
    }
  } catch (e) {
    toast('Error', e.message, 'err');
  }
}

// ── CREATE INCIDENT ───────────────────────────────────────
let _activeCalls = [];

async function loadCreateInc() {
  try {
    const res = await GET(API.get_calls, { status: 'ACTIVE' });
    if (!res.success) return;
    _activeCalls = res.data.calls || [];

    // Fill call dropdown
    const sel = $('ci-call');
    if (sel) {
      sel.innerHTML = `<option value="">Select an ACTIVE call...</option>` +
        _activeCalls.map(c =>
          `<option value="${c.id}">#${c.id} — ${esc(c.type.toUpperCase())} | ${esc(c.caller_name||'Anonymous')} | ${fmtDate(c.created_at)}</option>`
        ).join('');
    }

    // Fill unprocessed table
    const tbody = $('unproc-tbody');
    if (tbody) {
      tbody.innerHTML = !_activeCalls.length
        ? emptyRow(5, 'No active calls.')
        : _activeCalls.map(c => `
            <tr>
              <td style="font-family:monospace;color:var(--blue)">#${c.id}</td>
              <td>${typeBadge(c.type)}</td>
              <td style="font-size:.8rem">${esc(c.caller_name||'Anonymous')}</td>
              <td style="font-size:.73rem;color:var(--txt2)">${fmtDate(c.created_at)}</td>
              <td><button class="btn btn-primary btn-sm" onclick="$('ci-call').value=${c.id}">Select</button></td>
            </tr>
          `).join('');
    }
  } catch (e) {
    console.error('[CreateInc]', e.message);
  }
}

function prefillCall(callId) {
  loadCreateInc().then(() => {
    const sel = $('ci-call');
    if (sel) sel.value = callId;
  });
}

function setSev(v, btn) {
  document.querySelectorAll('.sev-b').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  $('ci-severity').value = v;
}

function resetCI() {
  const sel = $('ci-call'); if (sel) sel.value = '';
  $('ci-severity').value = 3;
  document.querySelectorAll('.sev-b').forEach((b,i) => b.classList.toggle('on', i===2));
  const loc = $('ci-location'); if (loc) loc.value = '';
  const notes = $('ci-notes'); if (notes) notes.value = '';
  showFormErr('ci-err', null);
}

async function createIncident() {
  const callId   = parseInt($('ci-call')?.value || 0);
  const severity = parseInt($('ci-severity')?.value || 3);
  const location = $('ci-location')?.value.trim() || '';
  const notes    = $('ci-notes')?.value.trim() || '';

  if (!callId) { showFormErr('ci-err', 'Please select a call.'); return; }
  showFormErr('ci-err', null);

  const btn = $('ci-btn');
  btn.innerHTML = '<div class="spin"></div> Creating...';
  btn.disabled = true;

  try {
    const res = await POST(API.create_incident, { call_id: callId, severity, location, notes });
    if (res.success) {
      toast('Incident Created', '#' + res.data.id + ' is now ACTIVE', 'ok');
      resetCI();
      loadCreateInc();
      loadDashboard();
    } else {
      showFormErr('ci-err', res.error || 'Failed to create incident');
    }
  } catch (e) {
    showFormErr('ci-err', e.message);
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> Create Incident';
    btn.disabled  = false;
  }
}

// ── ASSIGN TEAM ───────────────────────────────────────────
async function loadAssign() {
  try {
    const [incRes, teamRes] = await Promise.all([
      GET(API.get_incidents),
      GET(API.teams),
    ]);
    _allInc   = incRes.data.incidents  || [];
    _allTeams = teamRes.data.teams     || [];

    // Incident dropdown — exclude CLOSED
    const iSel = $('at-incident');
    if (iSel) {
      const open = _allInc.filter(i => i.status !== 'CLOSED');
      iSel.innerHTML = `<option value="">Select incident...</option>` +
        open.map(i =>
          `<option value="${i.id}">#${i.id} — ${esc(i.type)} — ${esc(i.location.slice(0,35))} [${i.status}]</option>`
        ).join('');
    }

    // Team dropdown — only AVAILABLE
    const tSel = $('at-team');
    if (tSel) {
      const avail = _allTeams.filter(t => t.status === 'AVAILABLE');
      tSel.innerHTML = `<option value="">Select available team...</option>` +
        avail.map(t =>
          `<option value="${t.id}">${esc(t.name)} — ${t.type} — ${esc(t.location)}</option>`
        ).join('');
    }

    // Roster table
    const tbody = $('at-teams-tbody');
    if (tbody) {
      tbody.innerHTML = !_allTeams.length
        ? emptyRow(4,'No teams registered.')
        : _allTeams.map(t => `
            <tr>
              <td style="font-weight:600">${esc(t.name)}</td>
              <td>${esc(t.type)}</td>
              <td>${statusBadge(t.status)}</td>
              <td style="font-size:.79rem;color:var(--txt2)">${esc(t.location)}</td>
            </tr>
          `).join('');
    }
  } catch (e) {
    console.error('[Assign]', e.message);
  }
}

function prefillInc(incId) {
  loadAssign().then(() => {
    const sel = $('at-incident');
    if (sel) sel.value = incId;
  });
}

async function assignTeam() {
  const incId  = parseInt($('at-incident')?.value || 0);
  const teamId = parseInt($('at-team')?.value     || 0);

  if (!incId)  { showFormErr('at-err','Please select an incident.'); return; }
  if (!teamId) { showFormErr('at-err','Please select a team.'); return; }
  showFormErr('at-err', null);

  try {
    const res = await POST(API.assign_team, { incident_id: incId, team_id: teamId });
    if (res.success) {
      toast('Team Dispatched!', `${esc(res.data.team_name)} → Incident #${incId}`, 'ok');
      loadAssign();
      loadDashboard();
    } else {
      showFormErr('at-err', res.error || 'Assignment failed');
    }
  } catch (e) {
    showFormErr('at-err', e.message);
  }
}

// ── TEAMS ─────────────────────────────────────────────────
async function loadTeams() {
  const tbody = $('teams-tbody');
  if (!tbody) return;
  tbody.innerHTML = loadingRow(6);
  try {
    const res = await GET(API.teams);
    if (!res.success) throw new Error(res.error);
    const teams = res.data.teams || [];
    if (!teams.length) { tbody.innerHTML = emptyRow(6,'No teams yet. Add one.'); return; }
    tbody.innerHTML = teams.map(t => `
      <tr>
        <td style="font-weight:600">${esc(t.name)}</td>
        <td>${esc(t.type)}</td>
        <td>${statusBadge(t.status)}</td>
        <td style="font-size:.79rem;color:var(--txt2)">${esc(t.location)}</td>
        <td style="font-family:monospace;font-size:.75rem">${esc(t.contact||'—')}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteTeam(${t.id},'${esc(t.name)}')" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = errRow(6, e.message);
  }
}

async function addTeam() {
  const name    = $('t-name')?.value.trim();
  const type    = $('t-type')?.value;
  const loc     = $('t-loc')?.value.trim();
  const contact = $('t-contact')?.value.trim();

  if (!name) { toast('Missing','Team name is required.','wrn'); return; }
  if (!loc)  { toast('Missing','Base location is required.','wrn'); return; }

  try {
    const res = await POST(API.teams, { action:'add', name, type, location: loc, contact });
    if (res.success) {
      toast('Team Added', esc(name), 'ok');
      ['t-name','t-loc','t-contact'].forEach(id => { const e = $(id); if(e) e.value=''; });
      loadTeams();
      loadDashboard();
    } else {
      toast('Error', res.error, 'err');
    }
  } catch (e) {
    toast('Error', e.message, 'err');
  }
}

async function deleteTeam(id, name) {
  if (!confirm(`Delete team "${name}"?`)) return;
  try {
    const res = await POST(API.teams, { action:'delete', id });
    if (res.success) {
      toast('Deleted', esc(name), 'wrn');
      loadTeams();
      loadDashboard();
    } else {
      toast('Error', res.error, 'err');
    }
  } catch (e) {
    toast('Error', e.message, 'err');
  }
}

// ── HOSPITALS ─────────────────────────────────────────────
async function loadHospitals() {
  const tbody = $('hosp-tbody');
  if (!tbody) return;
  tbody.innerHTML = loadingRow(6);
  try {
    const res = await GET(API.hospitals);
    if (!res.success) throw new Error(res.error);
    const hosps = res.data.hospitals || [];
    if (!hosps.length) { tbody.innerHTML = emptyRow(6,'No hospitals registered.'); return; }
    tbody.innerHTML = hosps.map(h => `
      <tr>
        <td style="font-weight:600">${esc(h.name)}</td>
        <td style="font-family:monospace;text-align:center;color:var(--green);font-weight:700">${h.beds}</td>
        <td style="font-family:monospace;text-align:center;color:var(--blue);font-weight:700">${h.icu}</td>
        <td style="font-size:.79rem;color:var(--txt2)">${esc(h.location)}</td>
        <td style="font-family:monospace;font-size:.75rem">${esc(h.contact||'—')}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteHospital(${h.id},'${esc(h.name)}')" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = errRow(6, e.message);
  }
}

async function addHospital() {
  const name    = $('h-name')?.value.trim();
  const loc     = $('h-loc')?.value.trim();
  const beds    = parseInt($('h-beds')?.value || 0);
  const icu     = parseInt($('h-icu')?.value  || 0);
  const contact = $('h-contact')?.value.trim();

  if (!name) { toast('Missing','Hospital name is required.','wrn'); return; }
  if (!loc)  { toast('Missing','Location is required.','wrn'); return; }

  try {
    const res = await POST(API.hospitals, { action:'add', name, location: loc, beds, icu, contact });
    if (res.success) {
      toast('Hospital Added', esc(name), 'ok');
      ['h-name','h-loc','h-contact'].forEach(id => { const e=$(id); if(e) e.value=''; });
      const hb=$('h-beds'); if(hb) hb.value=0;
      const hi=$('h-icu');  if(hi) hi.value=0;
      loadHospitals();
    } else {
      toast('Error', res.error, 'err');
    }
  } catch (e) {
    toast('Error', e.message, 'err');
  }
}

async function deleteHospital(id, name) {
  if (!confirm(`Delete hospital "${name}"?`)) return;
  try {
    const res = await POST(API.hospitals, { action:'delete', id });
    if (res.success) {
      toast('Deleted', esc(name), 'wrn');
      loadHospitals();
    } else {
      toast('Error', res.error, 'err');
    }
  } catch (e) {
    toast('Error', e.message, 'err');
  }
}

// ── STATISTICS ────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await GET(API.stats);
    if (!res.success) return;
    const d = res.data;

    // Mini stat cards
    const g = $('stats-mini');
    if (g) {
      g.innerHTML = `
        <div class="sc" style="--sc-c:var(--blue);--sc-bg:var(--blue-l)"><div class="sc-head"><div class="sc-icon"><i class="fa-solid fa-phone"></i></div></div><div class="sc-val">${d.calls?.total||0}</div><div class="sc-lbl">Total Calls</div></div>
        <div class="sc" style="--sc-c:var(--red);--sc-bg:var(--red-l)"><div class="sc-head"><div class="sc-icon"><i class="fa-solid fa-triangle-exclamation"></i></div></div><div class="sc-val">${d.incidents?.total||0}</div><div class="sc-lbl">Total Incidents</div></div>
        <div class="sc" style="--sc-c:var(--green);--sc-bg:var(--green-l)"><div class="sc-head"><div class="sc-icon"><i class="fa-solid fa-circle-check"></i></div></div><div class="sc-val">${d.incidents?.closed||0}</div><div class="sc-lbl">Closed</div></div>
        <div class="sc" style="--sc-c:var(--amber);--sc-bg:var(--amber-l)"><div class="sc-head"><div class="sc-icon"><i class="fa-solid fa-user-injured"></i></div></div><div class="sc-val">${d.casualties?.total||0}</div><div class="sc-lbl">Casualties</div></div>
      `;
    }

    // Calls by type
    const ct = d.calls_by_type || [];
    buildChart('s-type', 'bar',
      ct.map(r => r.type.charAt(0).toUpperCase()+r.type.slice(1)),
      ct.map(r => parseInt(r.cnt)),
      ['rgba(234,88,12,.6)','rgba(37,99,235,.6)','rgba(8,145,178,.6)','rgba(162,28,175,.6)'],
      { legend: false }
    );

    // Incident status
    const inc = d.incidents || {};
    buildChart('s-status', 'doughnut',
      ['Active','Assigned','Controlled','Closed'],
      [inc.active||0, inc.assigned||0, inc.controlled||0, inc.closed||0],
      ['rgba(244,63,94,.65)','rgba(251,146,60,.65)','rgba(167,139,250,.65)','rgba(52,211,153,.65)'],
      { cutout:'55%', legend: true }
    );

    // Calls by day
    const days = d.calls_by_day || [];
    buildChart('s-days', 'line',
      days.map(r => r.day),
      days.map(r => parseInt(r.cnt)),
      ['rgba(56,189,248,.5)'],
      { fill: true, tension: 0.4, legend: false }
    );

    // Triage
    const cas = d.casualties || {};
    buildChart('s-triage', 'bar',
      ['Red','Yellow','Green','Black'],
      [cas.red||0, cas.yellow||0, cas.green||0, cas.black||0],
      ['rgba(244,63,94,.65)','rgba(251,146,60,.65)','rgba(52,211,153,.65)','rgba(100,100,100,.5)'],
      { legend: false }
    );

  } catch (e) {
    console.error('[Stats]', e.message);
  }
}

async function exportJSON() {
  try {
    const res = await GET(API.stats);
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `sos_pune_report_${new Date().toISOString().slice(0,10)}.json`,
    });
    a.click();
    toast('Exported', 'JSON downloaded', 'ok');
  } catch (e) {
    toast('Error', e.message, 'err');
  }
}

// ── CHART BUILDER ─────────────────────────────────────────
function buildChart(id, type, labels, data, colors, opts = {}) {
  const canvas = $(id);
  if (!canvas) return;

  // Destroy old instance if exists
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }

  // Skip if no data
  if (!labels.length || data.every(v => v === 0)) {
    canvas.parentElement.innerHTML +=
      '<div style="text-align:center;padding:1.5rem;color:var(--txt2);font-size:.8rem">No data yet</div>';
    return;
  }

  const isDoughnut = type === 'doughnut';
  const isLine     = type === 'line';

  _charts[id] = new Chart(canvas, {
    type,
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: isDoughnut ? colors : (isLine ? colors[0] : colors),
        borderColor:     isDoughnut
          ? colors.map(c => c.replace('.65)',  '1)').replace('.6)','1)'))
          : (isLine ? 'rgba(56,189,248,1)' : colors.map(c => c.replace('.65)','1)').replace('.6)','1)'))),
        borderWidth:         isDoughnut ? 2 : 1,
        borderRadius:        isDoughnut ? 0 : 4,
        fill:                isLine ? (opts.fill ?? false) : undefined,
        tension:             isLine ? (opts.tension ?? 0.4) : undefined,
        pointBackgroundColor:isLine ? 'var(--blue)' : undefined,
      }],
    },
    options: {
      responsive: true,
      cutout: opts.cutout,
      plugins: {
        legend: {
          display: opts.legend ?? false,
          position: 'bottom',
          labels: { color: '#7e92b0', font: { family: 'DM Sans', size: 11 } },
        },
      },
      scales: isDoughnut ? undefined : {
        x: { ticks: { color: '#7e92b0' }, grid: { color: 'rgba(255,255,255,.04)' } },
        y: { ticks: { color: '#7e92b0', stepSize: 1 }, grid: { color: 'rgba(255,255,255,.04)' }, beginAtZero: true },
      },
    },
  });
}

// ── MISC HELPERS ──────────────────────────────────────────
function showFormErr(elId, msg) {
  const el = $(elId);
  if (!el) return;
  if (!msg) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${esc(msg)}`;
  el.classList.remove('hidden');
}
