# NADI Portal — JULES AI Implementation Plan
**Project:** Portal NADI Taman Muhibbah — Phase 3 Enhancements  
**Format:** Sequential tickets, one per GitHub push, safe to test independently  
**Files in scope:** `Code.gs`, `Index.html`, `JavaScript.html`, `Styles.html`

---

> **How to use this plan with JULES:**  
> Feed one ticket at a time. Each ticket has a self-contained scope, exact file targets, and a manual test checklist. Push to GitHub after each ticket, verify, then proceed to the next.

---

## TICKET INDEX

| # | Title | Files | Group |
|---|-------|-------|-------|
| T-01 | Multi-recipient Email Notifications | Code.gs, Index.html | #3 Notifications |
| T-02 | Overdue Program Alert Email | Code.gs | #3 Notifications |
| T-03 | Member Profile Completeness Score | JavaScript.html | #4 Members |
| T-04 | Member Session Count on Card | JavaScript.html | #4 Members |
| T-05 | Inactive Member Flag (90-day) | JavaScript.html | #4 Members |
| T-06 | Bulk CSV Member Import | Code.gs, Index.html, JavaScript.html | #4 Members |
| T-07 | Planner Month Grid Calendar View | Index.html, JavaScript.html, Styles.html | #5 Planner |
| T-08 | Recurring Program Support | Code.gs, Index.html, JavaScript.html | #5 Planner |
| T-09 | Google Calendar Export Link | JavaScript.html | #5 Planner |
| T-10 | Health Flag Abnormal Values | Index.html, JavaScript.html | #6 Screening |
| T-11 | Health Trend Chart per Member | Code.gs, Index.html, JavaScript.html | #6 Screening |
| T-12 | Screening Summary Report | Code.gs, Index.html, JavaScript.html | #6 Screening |
| T-13 | Batch Row Writes in submitData | Code.gs | #7 Performance |
| T-14 | Error Logging Sheet | Code.gs | #7 Performance |
| T-15 | Offline Mode Indicator | Index.html, JavaScript.html | #8 UX |
| T-16 | Photo Gallery View in Reports | Index.html, JavaScript.html | #8 UX |
| T-17 | Configurable KPI Targets | Code.gs, Index.html, JavaScript.html | #8 UX |
| T-18 | Export Reports to Excel (.xlsx) | Code.gs, Index.html, JavaScript.html | #2 Export |
| T-19 | KPI Toggle On/Off per Module | Code.gs, Index.html, JavaScript.html, Styles.html | KPI Feature |

---

## IMPLEMENTATION ORDER (RECOMMENDED)

```
Phase A — Backend Only (safest, no UI changes):
  T-13 → T-14 → T-01 → T-02

Phase B — Members tab:
  T-03 → T-04 → T-05 → T-06

Phase C — Screening / Health:
  T-10 → T-11 → T-12

Phase D — Planner tab:
  T-07 → T-08 → T-09

Phase E — Dashboard / KPI:
  T-17 → T-19

Phase F — Reports & UX:
  T-15 → T-16 → T-18
```

---

---

## T-01 — Multi-recipient Email Notifications

**Files:** `Code.gs`, `Index.html`  
**Depends on:** Nothing

### Code.gs change

Find in `sendDailyDigest()`:
```javascript
MailApp.sendEmail({
  to: settings.email,
  subject: `[NADI] Daily Digest - ${upcoming.length} Upcoming Programs`,
  htmlBody: body
});
```

Replace with:
```javascript
const recipients = String(settings.email || '')
  .split(',').map(e => e.trim()).filter(Boolean);
if (recipients.length === 0) return;
MailApp.sendEmail({
  to: recipients.join(','),
  subject: `[NADI] Daily Digest - ${upcoming.length} Upcoming Programs`,
  htmlBody: body
});
```

Apply the same `recipients` pattern to `sendOverdueAlert()` in T-02.

### Index.html change

Find the notification email input and update placeholder:
```html
<!-- Before -->
<input type="text" id="notif-email" placeholder="your@email.com">

<!-- After -->
<input type="text" id="notif-email" placeholder="e.g. admin@nadi.gov.my, manager@nadi.gov.my">
<div class="form-text text-muted small mt-1">Separate multiple emails with a comma.</div>
```

### Test Checklist
- [ ] Enter two comma-separated emails in Settings → save
- [ ] Run `sendDailyDigest()` manually from Apps Script editor
- [ ] Both emails receive the digest
- [ ] Single email still works (no regression)

---

## T-02 — Overdue Program Alert Email

**Files:** `Code.gs`  
**Depends on:** T-01 (uses same `recipients` pattern)

### Code.gs — Add new function after `sendDailyDigest()`

```javascript
/**
 * Triggered Daily — alerts for overdue planned programs
 */
function sendOverdueAlert() {
  const settings = getNotifSettings();
  if (!settings.enabled || !settings.email) return;

  const stats = getDashboardStats();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedKeys = new Set(
    stats.filter(s => s.status === 'COMPLETED').map(s => s.compositeKey)
  );

  const overdue = stats.filter(s => {
    if (s.status !== 'PLANNED') return false;
    if (completedKeys.has(s.compositeKey)) return false;
    return parseDateStrToDate_(s.date) < today;
  });

  if (overdue.length === 0) return;

  overdue.sort((a, b) => parseDateStrToDate_(a.date) - parseDateStrToDate_(b.date));

  let body = `<h3 style="color:#ef4444;">⚠️ NADI Portal: Overdue Program Alert</h3>`;
  body += `<p><strong>${overdue.length} planned program(s)</strong> are past their scheduled date and have not been completed:</p>`;
  body += `<table border="1" cellpadding="5" style="border-collapse:collapse;width:100%;">`;
  body += `<tr style="background:#fee2e2;"><th>Date</th><th>Program</th><th>Pillar</th><th>Module</th></tr>`;
  overdue.forEach(u => {
    body += `<tr>
      <td>${escapeHtmlGs_(u.date)}</td>
      <td>${escapeHtmlGs_(u.progName)}</td>
      <td>${escapeHtmlGs_(u.pillar)}</td>
      <td>${escapeHtmlGs_(u.module)}</td>
    </tr>`;
  });
  body += `</table><p><a href="${getScriptUrl()}">Open Portal</a></p>`;

  const recipients = String(settings.email || '')
    .split(',').map(e => e.trim()).filter(Boolean);
  if (recipients.length === 0) return;

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: `[NADI] ⚠️ ${overdue.length} Overdue Program(s) Require Attention`,
    htmlBody: body
  });
}
```

### Register trigger after deploy
Apps Script → Triggers → Add Trigger:
- Function: `sendOverdueAlert`
- Event: Time-driven → Day timer → 8:00–9:00 AM

### Test Checklist
- [ ] Add a PLANNED program with a past date, do NOT mark it done
- [ ] Run `sendOverdueAlert()` manually → email arrives listing it
- [ ] Mark program as completed, re-run → no email sent
- [ ] No planned programs at all → no email sent

---

## T-03 — Member Profile Completeness Score

**Files:** `JavaScript.html`  
**Depends on:** Nothing

### JavaScript.html change

Add this helper function near other utility functions (outside `renderMemberList`):
```javascript
function profileScore(m) {
  const fields = [m.ic, m.mobile, m.email, m.race, m.occupation, m.education, m.dob];
  return Math.round((fields.filter(f => f && String(f).trim()).length / fields.length) * 100);
}
```

In `renderMemberList()`, find:
```javascript
const isComplete = m.occupation && m.education && m.age;
const statusDot = isComplete ? '' : '<i class="fa-solid fa-circle text-secondary opacity-25 ms-2" ...></i>';
```

Replace with:
```javascript
const score = profileScore(m);
const scoreColor = score === 100 ? 'bg-success' : score >= 70 ? 'bg-warning text-dark' : 'bg-danger';
const statusDot = `<span class="badge ${scoreColor} ms-2 rounded-pill" style="font-size:0.6rem;" title="Profile Completeness">${score}%</span>`;
```

### Test Checklist
- [ ] Member with all fields filled → green `100%` badge
- [ ] Member missing email/occupation/etc → yellow or red badge with correct %
- [ ] Edit a member to complete all fields → badge updates to 100% on re-render
- [ ] Dark mode: badges remain readable

---

## T-04 — Member Session Count on Card

**Files:** `JavaScript.html`  
**Depends on:** Nothing (adds rawStats fetch when missing)

### JavaScript.html changes

**Step 1 — Add helper** (near `profileScore`):
```javascript
function getMemberSessionCount(name) {
  const norm = normalizeName_(name);
  return rawStats.filter(s => s.status === 'COMPLETED' && normalizeName_(s.partName) === norm).length;
}
```

**Step 2 — In `renderMemberList()` card bottom**, find:
```javascript
<div class="mt-auto pt-2 border-top d-flex justify-content-between align-items-center">
  <span class="badge bg-light text-dark border small">${escapeHtml(m.occupation || 'N/A')}</span>
  <span class="small text-muted">Joined: ${m.dateJoin}</span>
</div>
```

Replace with:
```javascript
const sessions = getMemberSessionCount(m.name);
`<div class="mt-auto pt-2 border-top d-flex justify-content-between align-items-center flex-wrap gap-1">
  <span class="badge bg-light text-dark border small">${escapeHtml(m.occupation || 'N/A')}</span>
  <div class="d-flex align-items-center gap-2">
    <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 small">
      <i class="fa-solid fa-calendar-check me-1"></i>${sessions} sessions
    </span>
    <span class="small text-muted">Joined: ${m.dateJoin}</span>
  </div>
</div>`
```

**Step 3 — In `toggle()` function**, replace:
```javascript
if (tab === 'mem') renderMemberList();
```
With:
```javascript
if (tab === 'mem') {
  if (rawStats.length === 0) {
    google.script.run.withFailureHandler(handleApiError).withSuccessHandler(res => {
      rawStats = res || [];
      renderMemberList();
    }).getDashboardStats();
  }
  renderMemberList();
}
```

### Test Checklist
- [ ] Open Members tab without visiting Dashboard first → session counts load
- [ ] Member with known attendance shows correct count
- [ ] New member with no history shows `0 sessions`
- [ ] Navigating to Dashboard then Members shows same count (no double-fetch)

---

## T-05 — Inactive Member Flag (90-day)

**Files:** `JavaScript.html`  
**Depends on:** T-04 (rawStats available on Members tab)  
**Note:** `Styles.html` already has `.member-card-inactive` — no CSS change needed.

### JavaScript.html changes

**Add helpers** (near `getMemberSessionCount`):
```javascript
function getMemberLastSeen(name) {
  const norm = normalizeName_(name);
  const timestamps = rawStats
    .filter(s => s.status === 'COMPLETED' && normalizeName_(s.partName) === norm)
    .map(s => parseDateSafe(s.date).getTime())
    .filter(t => t > 0);
  return timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;
}

function isMemberInactive(name) {
  const lastSeen = getMemberLastSeen(name);
  if (!lastSeen) return true;
  return (Date.now() - lastSeen.getTime()) / 86400000 > 90;
}
```

**In `renderMemberList()`**, find the card outer div:
```javascript
<div class="nadi-card h-100 p-3 mb-0 d-flex flex-column">
```

Replace with:
```javascript
const inactive = isMemberInactive(m.name);
const inactiveAttr = inactive ? ' title="Inactive — no attendance in 90+ days"' : '';
`<div class="nadi-card h-100 p-3 mb-0 d-flex flex-column ${inactive ? 'member-card-inactive' : ''}"${inactiveAttr}>`
```

### Test Checklist
- [ ] Member never attended → amber left border
- [ ] Member attended within 90 days → no border
- [ ] Member who attended 91+ days ago → amber left border
- [ ] Hover on inactive card shows tooltip
- [ ] After recording attendance, refresh Members → border disappears

---

## T-06 — Bulk CSV Member Import

**Files:** `Code.gs`, `Index.html`, `JavaScript.html`  
**Depends on:** Nothing

### Expected CSV Column Order
```
Name, IC, Mobile, Email, Race, Ethnic, Occupation, Salary, Education, Distance, Date Joined, Age, DOB
```
Row 1 = header (auto-skipped). Subsequent rows = data.

---

### Code.gs — Add batch import function

```javascript
function bulkAddMembers(rows) {
  const sheet = ensureMembersSheet_();
  const { names, ics } = getMemberMap_();
  const skipped = [];
  const rowsToInsert = [];

  rows.forEach(r => {
    const name = normalizeName_(r.name);
    const ic = String(r.ic || '').trim();
    if (!name) { skipped.push({ name: '(empty)', reason: 'Missing name' }); return; }
    if (ic && ics[ic]) { skipped.push({ name, reason: `Duplicate IC (${ic})` }); return; }
    if (names[name]) { skipped.push({ name, reason: 'Name already exists' }); return; }
    rowsToInsert.push([
      name, ic, String(r.mobile||'').trim(), String(r.email||'').trim(),
      String(r.race||'').trim(), String(r.ethnic||'').trim(), String(r.occupation||'').trim(),
      String(r.salary||'').trim(), String(r.education||'').trim(), String(r.distance||'').trim(),
      formatDateStr(r.dateJoin), String(r.age||'').trim(), String(r.dob||'').trim()
    ]);
  });

  if (rowsToInsert.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToInsert.length, 13).setValues(rowsToInsert);
  }
  invalidateMemberCache();
  invalidateStatsCache();
  return { status: 'SUCCESS', added: rowsToInsert.length, skipped };
}
```

---

### Index.html — Add button + modal

Add "Import CSV" button next to the existing merge button in the Members header toolbar:
```html
<button class="btn btn-sm btn-outline-success" onclick="showImportModal()">
  <i class="fa-solid fa-file-import me-1"></i>Import CSV
</button>
```

Add modal (before closing `</body>`):
```html
<div class="modal fade" id="csvImportModal" tabindex="-1">
  <div class="modal-dialog modal-lg modal-dialog-centered">
    <div class="modal-content border-0 shadow-lg rounded-4">
      <div class="modal-header bg-success text-white border-0 rounded-top-4">
        <h5 class="modal-title fw-bold"><i class="fa-solid fa-file-import me-2"></i>Bulk Import Members (CSV)</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body p-4">
        <div class="alert alert-info small mb-3">
          <strong>Required column order:</strong> Name, IC, Mobile, Email, Race, Ethnic, Occupation, Salary, Education, Distance, Date Joined, Age, DOB<br>
          First row = header (auto-skipped).
        </div>
        <input type="file" id="csv-import-file" accept=".csv" class="form-control mb-3">
        <div id="csv-preview-container" class="d-none">
          <div class="fw-bold mb-2 small text-muted">Preview (<span id="csv-preview-count">0</span> rows):</div>
          <div class="table-responsive" style="max-height:260px;overflow-y:auto;">
            <table class="table table-sm table-bordered small" id="csv-preview-table">
              <thead class="table-dark"><tr>
                <th>Name</th><th>IC</th><th>Mobile</th><th>Email</th><th>Race</th><th>Occupation</th>
              </tr></thead>
              <tbody id="csv-preview-body"></tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="modal-footer border-0">
        <button type="button" class="btn btn-light fw-bold" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-success fw-bold px-4" id="btn-confirm-import" onclick="confirmCsvImport()" disabled>
          <i class="fa-solid fa-upload me-2"></i>Import
        </button>
      </div>
    </div>
  </div>
</div>
```

---

### JavaScript.html — Add import logic

```javascript
let csvImportModalObj = null;
let parsedCsvRows = [];

function showImportModal() {
  parsedCsvRows = [];
  document.getElementById('csv-import-file').value = '';
  document.getElementById('csv-preview-container').classList.add('d-none');
  document.getElementById('btn-confirm-import').disabled = true;
  if (!csvImportModalObj) csvImportModalObj = new bootstrap.Modal(document.getElementById('csvImportModal'));
  csvImportModalObj.show();
}

// Listen for file selection (attach once on DOMContentLoaded or in bootApp)
document.addEventListener('change', function(e) {
  if (e.target.id !== 'csv-import-file') return;
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    const lines = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { showToast('CSV must have at least one data row.', 'warning'); return; }
    parsedCsvRows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
      parsedCsvRows.push({
        name: cols[0]||'', ic: cols[1]||'', mobile: cols[2]||'', email: cols[3]||'',
        race: cols[4]||'', ethnic: cols[5]||'', occupation: cols[6]||'',
        salary: cols[7]||'', education: cols[8]||'', distance: cols[9]||'',
        dateJoin: cols[10]||'', age: cols[11]||'', dob: cols[12]||''
      });
    }
    document.getElementById('csv-preview-count').innerText = parsedCsvRows.length;
    document.getElementById('csv-preview-body').innerHTML = parsedCsvRows.slice(0, 20).map(r =>
      `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.ic)}</td><td>${escapeHtml(r.mobile)}</td>
       <td>${escapeHtml(r.email)}</td><td>${escapeHtml(r.race)}</td><td>${escapeHtml(r.occupation)}</td></tr>`
    ).join('');
    document.getElementById('csv-preview-container').classList.remove('d-none');
    document.getElementById('btn-confirm-import').disabled = false;
  };
  reader.readAsText(file);
});

function confirmCsvImport() {
  if (!parsedCsvRows.length) return;
  const btn = document.getElementById('btn-confirm-import');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Importing...';
  google.script.run.withFailureHandler(handleApiError).withSuccessHandler(res => {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-upload me-2"></i>Import';
    if (res.status === 'SUCCESS') {
      if (csvImportModalObj) csvImportModalObj.hide();
      showToast(`Imported ${res.added} members. ${res.skipped.length} skipped.`, res.skipped.length ? 'warning' : 'success');
      google.script.run.withSuccessHandler(r => { memberRecords = r || []; populateDatalists(); renderMemberList(); }).getMemberData();
    }
  }).bulkAddMembers(parsedCsvRows);
}
```

### Test Checklist
- [ ] "Import CSV" button appears in Members header
- [ ] Upload a valid CSV → preview shows first 20 rows
- [ ] Click Import → toast shows "Imported N members"
- [ ] Members tab refreshes with new entries
- [ ] Re-import same CSV → "N skipped" toast, no duplicates
- [ ] CSV with empty Name in a row → that row is skipped cleanly

---

## T-07 — Planner Month Grid Calendar View

**Files:** `Index.html`, `JavaScript.html`, `Styles.html`  
**Depends on:** Nothing

### Index.html — Add toggle + grid container in Planner sidebar

Find the sidebar header:
```html
<div class="section-title text-primary"><i class="fa-solid fa-clock-rotate-left me-2"></i>Upcoming Schedule</div>
```

Replace with:
```html
<div class="d-flex justify-content-between align-items-center mb-2">
  <div class="section-title text-primary mb-0"><i class="fa-solid fa-clock-rotate-left me-2"></i>Upcoming Schedule</div>
  <div class="btn-group btn-group-sm">
    <button class="btn btn-primary" id="btn-view-list" onclick="setPlannerView('list')" title="List View"><i class="fa-solid fa-list"></i></button>
    <button class="btn btn-outline-primary" id="btn-view-grid" onclick="setPlannerView('grid')" title="Calendar Grid"><i class="fa-solid fa-calendar-days"></i></button>
  </div>
</div>
<div id="planner-grid-view" class="d-none"></div>
```

---

### JavaScript.html — Add calendar grid functions

```javascript
let currentPlannerView = 'list';

function setPlannerView(view) {
  currentPlannerView = view;
  document.getElementById('btn-view-list').className = view === 'list' ? 'btn btn-primary btn-sm' : 'btn btn-outline-primary btn-sm';
  document.getElementById('btn-view-grid').className = view === 'grid' ? 'btn btn-primary btn-sm' : 'btn btn-outline-primary btn-sm';
  document.getElementById('schedule-timeline').classList.toggle('d-none', view === 'grid');
  document.getElementById('planner-grid-view').classList.toggle('d-none', view !== 'grid');
  if (view === 'grid') renderPlannerGrid();
}

function renderPlannerGrid() {
  const container = document.getElementById('planner-grid-view');
  if (!container) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const planned = rawStats.filter(s => s.status === 'PLANNED');
  const dayMap = {};
  planned.forEach(p => {
    const d = parseDateSafe(p.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate();
      if (!dayMap[key]) dayMap[key] = [];
      dayMap[key].push(p.progName);
    }
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = now.getDate();

  let html = `<div class="planner-cal-header">${monthNames[month]} ${year}</div>`;
  html += `<div class="planner-cal-grid">`;
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    html += `<div class="planner-cal-day-label">${d}</div>`;
  });
  for (let i = 0; i < firstDay; i++) html += `<div class="planner-cal-cell empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const progs = dayMap[day] || [];
    const isToday = day === todayDate;
    html += `<div class="planner-cal-cell ${isToday ? 'today' : ''} ${progs.length ? 'has-events' : ''}">
      <div class="planner-cal-day-num">${day}</div>
      ${progs.map(p => `<div class="planner-cal-event" title="${escapeHtml(p)}">${escapeHtml(p.length > 12 ? p.slice(0,10)+'…' : p)}</div>`).join('')}
    </div>`;
  }
  html += `</div>`;
  container.innerHTML = html;
}
```

---

### Styles.html — Add CSS block

```css
/* Planner Calendar Grid */
.planner-cal-header { font-weight:700; font-size:0.95rem; color:var(--text-main); margin-bottom:8px; text-align:center; }
.planner-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:3px; }
.planner-cal-day-label { text-align:center; font-size:0.65rem; font-weight:700; color:var(--text-muted); padding:3px 0; text-transform:uppercase; }
.planner-cal-cell { background:var(--card-bg); border:1px solid var(--border-color); border-radius:5px; min-height:52px; padding:3px; font-size:0.7rem; }
.planner-cal-cell.empty { background:transparent; border:none; }
.planner-cal-cell.today { border-color:var(--primary-color); border-width:2px; }
.planner-cal-cell.today .planner-cal-day-num { color:var(--primary-color); font-weight:800; }
.planner-cal-cell.has-events { background:rgba(37,99,235,0.04); }
.planner-cal-day-num { font-weight:600; color:var(--text-muted); margin-bottom:2px; }
.planner-cal-event { background:var(--primary-color); color:white; border-radius:3px; padding:1px 3px; font-size:0.6rem; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
```

### Test Checklist
- [ ] Planner sidebar shows List/Grid toggle buttons
- [ ] Grid view renders current month correctly
- [ ] Days with planned programs show name badges
- [ ] Today's cell has blue border
- [ ] Empty month shows a clean empty grid
- [ ] Switching back to List restores timeline view

---

## T-08 — Recurring Program Support

**Files:** `Code.gs`, `Index.html`, `JavaScript.html`  
**Depends on:** Nothing

### Code.gs — In `submitData()`, add recurrence expansion BEFORE the `programs.forEach()` loop

```javascript
// Expand recurring plans
const expandedPrograms = [];
programs.forEach(prog => {
  expandedPrograms.push(prog);
  if (prog.status === 'PLANNED' && prog.recurrence && prog.recurrence !== 'none') {
    const parts = formatDateStr(prog.date).split('-');
    const baseDate = new Date(parts[2], parts[1]-1, parts[0]);
    const steps = prog.recurrence === 'weekly4' ? [7,14,21] : prog.recurrence === 'monthly3' ? [1,2] : [];
    steps.forEach(step => {
      const nd = new Date(baseDate);
      if (prog.recurrence === 'weekly4') nd.setDate(nd.getDate() + step);
      else nd.setMonth(nd.getMonth() + step);
      expandedPrograms.push({ ...prog, date: formatDateStr(nd), recurrence: 'none' });
    });
  }
});
// Then iterate expandedPrograms instead of programs
programs = expandedPrograms;
```

---

### Index.html — Add Repeat field in plan card template (inside `addProg` generated HTML for plan cards)

Find the plan card's link/remarks fields and add after them:
```html
<div class="mb-2">
  <label class="form-label fw-bold small">Repeat</label>
  <select class="form-select form-select-sm p-recurrence">
    <option value="none">No Repeat</option>
    <option value="weekly4">Weekly × 4 (4 consecutive weeks)</option>
    <option value="monthly3">Monthly × 3 (3 consecutive months)</option>
  </select>
</div>
```

---

### JavaScript.html — Capture & restore recurrence in state

In `captureState()`, inside the plan state push:
```javascript
recurrence: c.querySelector('.p-recurrence') ? c.querySelector('.p-recurrence').value : 'none'
```

In `restoreState()`, after restoring `.p-link`:
```javascript
if (c.querySelector('.p-recurrence')) c.querySelector('.p-recurrence').value = p.recurrence || 'none';
```

In `doSync('PLANNED')` when building the prog object:
```javascript
recurrence: c.querySelector('.p-recurrence') ? c.querySelector('.p-recurrence').value : 'none'
```

### Test Checklist
- [ ] Plan card shows "Repeat" dropdown
- [ ] "Weekly × 4" → 4 entries appear in Planner timeline
- [ ] "Monthly × 3" → 3 entries spread across 3 months
- [ ] "No Repeat" → 1 entry (existing behavior)
- [ ] Draft save/restore preserves recurrence selection

---

## T-09 — Google Calendar Export Link

**Files:** `JavaScript.html`  
**Depends on:** Nothing

### JavaScript.html — Add helper function and button in timeline

**Add function** (near planner functions):
```javascript
function openGoogleCalendar(title, date, time, details) {
  const parts = date.split('-');
  // date is DD-MM-YYYY
  const dateStr = parts.length === 3 && parts[2].length === 4
    ? parts[2] + parts[1] + parts[0]
    : date.replace(/-/g, '');

  let startStr = dateStr, endStr = dateStr;
  if (time) {
    const tp = time.replace(/[^\d:]/g,'').split(':');
    const hh = (tp[0]||'00').padStart(2,'0');
    const mm = (tp[1]||'00').padStart(2,'0');
    const endHH = String(Math.min(23, parseInt(hh,10)+1)).padStart(2,'0');
    startStr = `${dateStr}T${hh}${mm}00`;
    endStr   = `${dateStr}T${endHH}${mm}00`;
  }
  window.open(
    `https://calendar.google.com/calendar/render?action=TEMPLATE`
    + `&text=${encodeURIComponent(title)}`
    + `&dates=${startStr}/${endStr}`
    + `&details=${encodeURIComponent('Pillar: ' + details)}`
    + `&sf=true&output=xml`,
    '_blank'
  );
}
```

**In `renderPlannerCalendar()`**, inside the `timeline-actions` div, add a new button before the trash button:
```javascript
`<button class="btn btn-sm btn-outline-secondary rounded-circle shadow-sm"
  onclick="openGoogleCalendar('${jsStr(p.progName)}','${jsStr(p.date)}','${jsStr(p.time)}','${jsStr(p.pillar)}')"
  title="Add to Google Calendar">
  <i class="fa-brands fa-google"></i>
</button>`
```

### Test Checklist
- [ ] Each planned timeline item shows a Google icon button
- [ ] Clicking opens Google Calendar new-event page with title, date, time pre-filled
- [ ] Program with no time → opens as all-day event
- [ ] Recurring programs each have correct date in their own calendar link

---

## T-10 — Health Flag Abnormal Values

**Files:** `Index.html`, `JavaScript.html`  
**Depends on:** Nothing

### Reference Ranges
| Metric | Warning | Danger |
|--------|---------|--------|
| Systolic BP | ≥ 130 | ≥ 140 |
| Diastolic BP | ≥ 85 | – |
| Glucose (mmol/L) | ≥ 6.1 | ≥ 7.0 |
| SpO₂ | – | < 95% |
| BMI | – | < 17.5 or > 35 |

---

### Index.html — Add flags panel inside `screeningModal` body, just before `sc-reference`

```html
<div id="sc-flags" class="mt-3 d-none">
  <div class="alert alert-warning border-warning p-3 mb-0">
    <div class="fw-bold small mb-2"><i class="fa-solid fa-triangle-exclamation me-1"></i>Abnormal Readings Detected</div>
    <div id="sc-flags-list" class="d-flex flex-wrap gap-2"></div>
  </div>
</div>
```

Also add `oninput="checkHealthFlags()"` to the `sc-sys`, `sc-dia`, `sc-glucose`, `sc-spo2` inputs.

---

### JavaScript.html — Add `checkHealthFlags()` and update `calcBMI()`

```javascript
function checkHealthFlags() {
  const sys  = parseFloat(document.getElementById('sc-sys').value);
  const dia  = parseFloat(document.getElementById('sc-dia').value);
  const gluc = parseFloat(document.getElementById('sc-glucose').value);
  const spo2 = parseFloat(document.getElementById('sc-spo2').value);
  const bmi  = parseFloat(document.getElementById('sc-bmi').value);

  const flags = [];
  if (!isNaN(sys)  && sys  >= 140) flags.push({ label: `Systolic BP: ${sys} mmHg (Hypertension)`, level: 'danger' });
  else if (!isNaN(sys) && sys >= 130) flags.push({ label: `Systolic BP: ${sys} mmHg (Elevated)`, level: 'warning' });
  if (!isNaN(dia)  && dia  >= 85)  flags.push({ label: `Diastolic BP: ${dia} mmHg`, level: 'warning' });
  if (!isNaN(gluc) && gluc >= 7.0) flags.push({ label: `Glucose: ${gluc} mmol/L (Diabetic range)`, level: 'danger' });
  else if (!isNaN(gluc) && gluc >= 6.1) flags.push({ label: `Glucose: ${gluc} mmol/L (Pre-diabetic)`, level: 'warning' });
  if (!isNaN(spo2) && spo2 < 95)  flags.push({ label: `SpO₂: ${spo2}% (Low)`, level: 'danger' });
  if (!isNaN(bmi)  && (bmi < 17.5 || bmi > 35)) flags.push({ label: `BMI: ${bmi} (Extreme range)`, level: 'warning' });

  const panel = document.getElementById('sc-flags');
  const list  = document.getElementById('sc-flags-list');
  if (flags.length > 0) {
    list.innerHTML = flags.map(f => `<span class="badge bg-${f.level} text-white px-2 py-1">${f.label}</span>`).join('');
    panel.classList.remove('d-none');
  } else {
    panel.classList.add('d-none');
  }
}
```

At the end of `calcBMI()`, add a call to `checkHealthFlags()`.

### Test Checklist
- [ ] Enter Systolic 145 → red "Hypertension" badge appears
- [ ] Enter Systolic 132 → yellow "Elevated" badge
- [ ] Enter Glucose 6.5 → yellow "Pre-diabetic" badge
- [ ] Enter SpO₂ 93 → red "Low" badge
- [ ] All values in normal range → flags panel hidden
- [ ] Flags update in real-time without saving
- [ ] Saving health record works normally regardless of flags

---

## T-11 — Health Trend Chart per Member

**Files:** `Code.gs`, `Index.html`, `JavaScript.html`  
**Depends on:** T-03 or T-04 (member edit modal must be open)

### Code.gs — Add screening history function

```javascript
function getMemberScreeningHistory(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Screening');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const targetName = normalizeName_(name);
  return data.slice(1)
    .filter(r => normalizeName_(r[2]) === targetName)
    .map(r => ({
      date: formatDateStr(r[1]),
      bmi: parseFloat(r[6]) || null,
      systolic: parseFloat(r[8]) || null,
      diastolic: parseFloat(r[9]) || null,
      glucose: parseFloat(r[10]) || null,
      spo2: parseFloat(r[11]) || null
    }))
    .sort((a, b) => {
      const pa = a.date.split('-'), pb = b.date.split('-');
      return new Date(pa[2],pa[1]-1,pa[0]) - new Date(pb[2],pb[1]-1,pb[0]);
    });
}
```

---

### Index.html — Add "Health Trends" tab in `memberEditModal`

In the modal tab list (alongside Details and Attendance tabs):
```html
<li class="nav-item">
  <button class="nav-link" id="tab-health-trends" data-bs-toggle="tab" data-bs-target="#panel-health-trends">
    <i class="fa-solid fa-heart-pulse me-1"></i>Health Trends
  </button>
</li>
```

Add tab panel:
```html
<div class="tab-pane fade" id="panel-health-trends">
  <div id="health-trend-loading" class="text-center py-4 text-muted">
    <div class="spinner-border spinner-border-sm me-2"></div>Loading...
  </div>
  <div id="health-trend-charts" class="d-none">
    <div class="mb-4">
      <div class="fw-bold small text-muted mb-2">BMI Trend</div>
      <canvas id="chart-bmi-trend" height="130"></canvas>
    </div>
    <div>
      <div class="fw-bold small text-muted mb-2">Blood Pressure Trend</div>
      <canvas id="chart-bp-trend" height="130"></canvas>
    </div>
  </div>
  <div id="health-trend-empty" class="d-none text-center py-4 text-muted">
    <i class="fa-solid fa-heart-crack fs-2 mb-2 d-block opacity-25"></i>No health records found.
  </div>
</div>
```

---

### JavaScript.html — Add trend rendering

```javascript
let bmiTrendChart = null, bpTrendChart = null;

function loadHealthTrends(name) {
  ['health-trend-loading','health-trend-charts','health-trend-empty'].forEach(id => {
    document.getElementById(id).classList.add('d-none');
  });
  document.getElementById('health-trend-loading').classList.remove('d-none');

  google.script.run.withFailureHandler(handleApiError).withSuccessHandler(records => {
    document.getElementById('health-trend-loading').classList.add('d-none');
    if (!records || records.length === 0) {
      document.getElementById('health-trend-empty').classList.remove('d-none');
      return;
    }
    document.getElementById('health-trend-charts').classList.remove('d-none');
    const labels = records.map(r => r.date);

    if (bmiTrendChart) bmiTrendChart.destroy();
    bmiTrendChart = new Chart(document.getElementById('chart-bmi-trend').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [{ label:'BMI', data: records.map(r=>r.bmi), borderColor:'#3b82f6', tension:0.3, fill:false, pointRadius:4 }] },
      options: { plugins:{legend:{display:false}}, scales:{ y:{min:10,max:45, grid:{color:'rgba(0,0,0,0.05)'}} } }
    });

    if (bpTrendChart) bpTrendChart.destroy();
    bpTrendChart = new Chart(document.getElementById('chart-bp-trend').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label:'Systolic',  data:records.map(r=>r.systolic),  borderColor:'#ef4444', tension:0.3, fill:false, pointRadius:4 },
        { label:'Diastolic', data:records.map(r=>r.diastolic), borderColor:'#f59e0b', tension:0.3, fill:false, pointRadius:4 }
      ]},
      options: { plugins:{legend:{position:'bottom'}}, scales:{ y:{min:40,max:200} } }
    });
  }).getMemberScreeningHistory(name);
}
```

In `showEditMemberModal()`, add:
```javascript
document.getElementById('tab-health-trends').addEventListener('click', function() {
  loadHealthTrends(document.getElementById('edit-mem-name').value);
}, { once: false });
```

### Test Checklist
- [ ] Member with 3+ screening records → Health Trends tab shows BMI and BP charts
- [ ] Charts animate in on tab click
- [ ] Member with zero screening records → empty state shown
- [ ] Charts are readable in dark mode

---

## T-12 — Screening Summary Report

**Files:** `Code.gs`, `Index.html`, `JavaScript.html`  
**Depends on:** T-10 (uses same category names)

### Code.gs — Add aggregate function

```javascript
function getScreeningSummary() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Screening');
  const empty = { total:0, bmi:{Underweight:0,Normal:0,Overweight:0,Obese:0}, avgBmi:'N/A', bp:{high:0,normal:0}, glucose:{high:0,prediabetic:0,normal:0} };
  if (!sheet) return empty;
  const data = sheet.getDataRange().getValues().slice(1);
  if (data.length === 0) return empty;

  const bmiCats = { Underweight:0, Normal:0, Overweight:0, Obese:0 };
  let highBP=0, highGluc=0, preGluc=0, bmiSum=0, bmiCount=0;
  data.forEach(r => {
    const cat = String(r[7]||'');
    if (bmiCats.hasOwnProperty(cat)) bmiCats[cat]++;
    const bmi = parseFloat(r[6]);
    if (!isNaN(bmi)) { bmiSum += bmi; bmiCount++; }
    const sys = parseFloat(r[8]);
    if (!isNaN(sys) && sys >= 140) highBP++;
    const gluc = parseFloat(r[10]);
    if (!isNaN(gluc) && gluc >= 7.0) highGluc++;
    else if (!isNaN(gluc) && gluc >= 6.1) preGluc++;
  });
  return {
    total: data.length,
    bmi: bmiCats,
    avgBmi: bmiCount > 0 ? (bmiSum/bmiCount).toFixed(1) : 'N/A',
    bp: { high: highBP, normal: data.length - highBP },
    glucose: { high: highGluc, prediabetic: preGluc, normal: data.length - highGluc - preGluc }
  };
}
```

---

### Index.html — Add Health tab toggle in Reports section

Add toggle buttons at the top of the Reports view:
```html
<div class="d-flex gap-2 mb-3" id="rep-tab-buttons">
  <button class="btn btn-sm btn-primary" id="btn-rep-programs" onclick="setReportTab('programs')">
    <i class="fa-solid fa-clipboard-list me-1"></i>Programs
  </button>
  <button class="btn btn-sm btn-outline-primary" id="btn-rep-health" onclick="setReportTab('health')">
    <i class="fa-solid fa-heart-pulse me-1"></i>Health Summary
  </button>
</div>

<!-- Health Summary Panel (hidden by default) -->
<div id="rep-health-panel" class="d-none">
  <div class="row g-3 mb-4" id="health-summary-cards"></div>
  <div class="row g-4">
    <div class="col-md-6">
      <div class="nadi-card"><div class="fw-bold mb-3">BMI Distribution</div><canvas id="chart-bmi-dist" height="220"></canvas></div>
    </div>
    <div class="col-md-6">
      <div class="nadi-card"><div class="fw-bold mb-3">Blood Pressure Status</div><canvas id="chart-bp-dist" height="220"></canvas></div>
    </div>
  </div>
</div>
```

---

### JavaScript.html — Add tab switching and rendering

```javascript
let bmiDistChart = null, bpDistChart = null;

function setReportTab(tab) {
  document.getElementById('btn-rep-programs').className = tab === 'programs' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-primary';
  document.getElementById('btn-rep-health').className   = tab === 'health'   ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-primary';
  document.getElementById('rep-health-panel').classList.toggle('d-none', tab !== 'health');
  // Wrap existing report content in a div with id="rep-programs-panel" for easy toggle:
  const progPanel = document.getElementById('rep-programs-panel');
  if (progPanel) progPanel.classList.toggle('d-none', tab === 'health');
  if (tab === 'health') loadHealthSummary();
}

function loadHealthSummary() {
  google.script.run.withFailureHandler(handleApiError).withSuccessHandler(s => {
    document.getElementById('health-summary-cards').innerHTML = `
      <div class="col-6 col-md-3"><div class="nadi-card text-center p-3">
        <div class="text-muted small">Total Screened</div><div class="h3 fw-bold text-primary">${s.total}</div>
      </div></div>
      <div class="col-6 col-md-3"><div class="nadi-card text-center p-3">
        <div class="text-muted small">Avg BMI</div><div class="h3 fw-bold text-info">${s.avgBmi}</div>
      </div></div>
      <div class="col-6 col-md-3"><div class="nadi-card text-center p-3">
        <div class="text-muted small">Hypertension</div><div class="h3 fw-bold text-danger">${s.bp ? s.bp.high : 0}</div>
      </div></div>
      <div class="col-6 col-md-3"><div class="nadi-card text-center p-3">
        <div class="text-muted small">High Glucose</div><div class="h3 fw-bold text-warning">${s.glucose ? s.glucose.high : 0}</div>
      </div></div>`;
    if (!s.bmi || s.total === 0) return;

    if (bmiDistChart) bmiDistChart.destroy();
    bmiDistChart = new Chart(document.getElementById('chart-bmi-dist').getContext('2d'), {
      type: 'doughnut',
      data: { labels: Object.keys(s.bmi), datasets: [{ data: Object.values(s.bmi), backgroundColor: ['#60a5fa','#10b981','#f59e0b','#ef4444'], borderWidth:0 }] },
      options: { plugins: { legend: { position: 'bottom' } }, cutout: '50%' }
    });
    if (bpDistChart) bpDistChart.destroy();
    bpDistChart = new Chart(document.getElementById('chart-bp-dist').getContext('2d'), {
      type: 'bar',
      data: { labels: ['Normal BP','Hypertension'], datasets: [{ data: [s.bp.normal, s.bp.high], backgroundColor: ['#10b981','#ef4444'], borderRadius:6 }] },
      options: { plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
  }).getScreeningSummary();
}
```

### Test Checklist
- [ ] Reports tab shows "Programs" and "Health Summary" toggle buttons
- [ ] Health Summary tab shows 4 stat cards + 2 charts
- [ ] BMI doughnut shows all 4 categories
- [ ] BP bar chart shows normal vs hypertension counts
- [ ] Switching back to "Programs" restores existing report view
- [ ] Zero screening records → cards show 0, no chart crash

---

## T-13 — Batch Row Writes in submitData

**Files:** `Code.gs`  
**Depends on:** Nothing (pure performance refactor)

### Code.gs — Replace the `newMembers.forEach` block in `submitData()`

Find the entire new-members block (from `if (Array.isArray(newMembers)...` to the closing `}`).

Replace with:
```javascript
if (Array.isArray(newMembers) && newMembers.length > 0) {
  const { names, ics } = getMemberMap_();
  const rowsToInsert = [];
  newMembers.forEach(m => {
    const name = normalizeName_(m.name);
    const ic = String(m.ic || '').trim();
    if (!name) return;
    if (ic && ics[ic]) {
      skipped.push({ type:'member', name, reason:`Duplicate IC (${ic}) found for ${ics[ic].name}` });
      return;
    }
    if (names[name] && names[name].ic === ic) {
      skipped.push({ type:'member', name, reason:'Duplicate member (Name & IC match)' });
      return;
    }
    rowsToInsert.push([
      name, ic,
      String(m.mobile||'').trim(), String(m.email||'').trim(),
      String(m.race||'').trim(), String(m.ethnic||'').trim(),
      String(m.occupation||'').trim(), String(m.salary||'').trim(),
      String(m.education||'').trim(), String(m.distance||'').trim(),
      formatDateStr(m.dateJoin), String(m.age||'').trim(),
      String(m.dob||'').trim()
    ]);
  });
  if (rowsToInsert.length > 0) {
    const startRow = membersSheet.getLastRow() + 1;
    membersSheet.getRange(startRow, 1, rowsToInsert.length, 13).setValues(rowsToInsert);
  }
}
```

### Test Checklist
- [ ] Submit session with 5+ new members → all appear in Members tab
- [ ] Duplicate IC still caught and reported in skipped list
- [ ] Duplicate Name+IC still caught
- [ ] Apps Script execution log shows faster run time
- [ ] No regression in existing submit flow

---

## T-14 — Error Logging Sheet

**Files:** `Code.gs`  
**Depends on:** Nothing

### Code.gs — Add `logError_()` function (in Utilities section)

```javascript
function logError_(funcName, err) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('_Errors');
    if (!sheet) {
      sheet = ss.insertSheet('_Errors');
      sheet.appendRow(['Timestamp', 'Function', 'Error Message', 'Stack']);
      sheet.setFrozenRows(1);
      sheet.getRange(1,1,1,4).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    }
    // Trim to 500 rows
    const lastRow = sheet.getLastRow();
    if (lastRow > 501) sheet.deleteRows(2, lastRow - 501);
    sheet.appendRow([
      new Date(),
      String(funcName || 'unknown'),
      String((err && err.message) ? err.message : err),
      String((err && err.stack) ? err.stack.slice(0, 500) : '')
    ]);
  } catch(e) { /* never let logging crash the app */ }
}
```

### Update existing catch blocks

For each of these functions, update the catch to call `logError_`:

```javascript
// getMemberData
} catch (e) {
  logError_('getMemberData', e);
  return [];
}

// submitData — wrap entire body
function submitData(...) {
  try {
    // ... existing body ...
  } catch(e) {
    logError_('submitData', e);
    return { status: 'ERROR', message: e.message || 'Unknown error' };
  }
}
```

Apply same pattern to: `saveMeeting`, `submitMeetingReport`, `saveScreeningRecords`, `saveDraftToDrive`, `loadDraftFromDrive`.

### Test Checklist
- [ ] Call `logError_('test', new Error('hello'))` in Script Editor → `_Errors` sheet created
- [ ] Error row has timestamp, function name, message
- [ ] Normal submit flow → no error rows added
- [ ] Sheet header is frozen and styled
- [ ] Row count stays ≤ 500 when log is full

---

## T-15 — Offline Mode Indicator

**Files:** `Index.html`, `JavaScript.html`  
**Note:** `Styles.html` already has `.offline-banner` CSS — no change needed.

### Index.html — Add banner element (immediately after `<body>` opening tag)

```html
<div id="offline-banner" class="offline-banner d-none" role="alert" aria-live="assertive">
  <i class="fa-solid fa-wifi me-2"></i>You are offline — changes are saved locally and will sync when you reconnect.
</div>
```

---

### JavaScript.html — Add detection function and call in `bootApp()`

```javascript
function initOfflineDetection() {
  const banner = document.getElementById('offline-banner');
  window.addEventListener('offline', () => {
    if (banner) banner.classList.remove('d-none');
  });
  window.addEventListener('online', () => {
    if (banner) banner.classList.add('d-none');
    showToast('Back online! You can now sync your data.', 'success');
  });
  if (!navigator.onLine && banner) banner.classList.remove('d-none');
}
```

In `bootApp()`, add:
```javascript
initOfflineDetection();
```

### Test Checklist
- [ ] Chrome DevTools → Network → Offline → amber banner appears
- [ ] Set back to Online → banner disappears + success toast
- [ ] Local form data intact after going offline
- [ ] Banner sits below navbar on desktop, above content on mobile
- [ ] Re-loading page while offline still shows banner immediately

---

## T-16 — Photo Gallery View in Reports

**Files:** `Index.html`, `JavaScript.html`  
**Note:** `Styles.html` already has `.gallery-grid`, `.gallery-card` etc. — no CSS changes needed.

### Index.html — Add view toggle and gallery container in Reports section

Add toggle buttons in the Reports filter bar:
```html
<div class="btn-group btn-group-sm ms-2">
  <button class="btn btn-primary" id="btn-rep-table-view" onclick="setRepView('table')" title="Table View">
    <i class="fa-solid fa-table-list"></i>
  </button>
  <button class="btn btn-outline-primary" id="btn-rep-gallery-view" onclick="setRepView('gallery')" title="Gallery View">
    <i class="fa-solid fa-images"></i>
  </button>
</div>
```

Wrap existing report table content in:
```html
<div id="rep-programs-panel">
  <!-- existing filter selects, table, export buttons go here -->
</div>
```

Add after it:
```html
<div id="rep-gallery-container" class="d-none mt-3">
  <div class="gallery-grid" id="gallery-grid-items"></div>
</div>
```

---

### JavaScript.html — Add gallery functions

```javascript
let currentRepView = 'table';

function setRepView(view) {
  currentRepView = view;
  document.getElementById('btn-rep-table-view').className   = view === 'table'   ? 'btn btn-primary btn-sm'         : 'btn btn-outline-primary btn-sm';
  document.getElementById('btn-rep-gallery-view').className = view === 'gallery' ? 'btn btn-primary btn-sm'         : 'btn btn-outline-primary btn-sm';
  const progPanel = document.getElementById('rep-programs-panel');
  if (progPanel) progPanel.classList.toggle('d-none', view === 'gallery');
  document.getElementById('rep-gallery-container').classList.toggle('d-none', view !== 'gallery');
  if (view === 'gallery') renderReportGallery();
}

function renderReportGallery() {
  const pF = document.getElementById('r-pillar').value;
  const mF = document.getElementById('r-month').value;
  const yF = parseInt(document.getElementById('d-year').value || new Date().getFullYear(), 10);

  const seen = new Set();
  const items = rawStats.filter(s => {
    if (s.status !== 'COMPLETED' || !s.picUrl) return false;
    if (pF && s.pillar !== pF) return false;
    if (mF !== '' && s.month !== parseInt(mF, 10)) return false;
    if (s.year !== yF) return false;
    if (seen.has(s.picUrl)) return false;
    seen.add(s.picUrl);
    return true;
  });

  const grid = document.getElementById('gallery-grid-items');
  if (items.length === 0) {
    grid.innerHTML = `<div class="text-center text-muted py-5" style="grid-column:1/-1">
      <i class="fa-solid fa-image-slash fs-1 mb-3 d-block opacity-25"></i>No photos found for this filter.
    </div>`;
    return;
  }

  grid.innerHTML = items.map(s => `
    <div class="gallery-card">
      <div class="gallery-img-wrap">
        <a href="${escapeHtml(s.folderUrl || s.picUrl)}" target="_blank" rel="noopener">
          <img class="gallery-img" src="${escapeHtml(s.picUrl)}" alt="${escapeHtml(s.progName)}"
            onerror="this.closest('.gallery-img-wrap').innerHTML='<div class=gallery-img-placeholder><i class=fa-solid fa-image opacity-25 fs-3></i></div>'">
        </a>
      </div>
      <div class="gallery-card-body">
        <div class="fw-bold small text-truncate" title="${escapeHtml(s.progName)}">${escapeHtml(s.progName)}</div>
        <div class="small text-muted">${escapeHtml(s.date)} · ${escapeHtml(s.pillar)}</div>
      </div>
    </div>`).join('');
}
```

Also call `renderReportGallery()` inside `drawReports()` when `currentRepView === 'gallery'`.

### Test Checklist
- [ ] Reports tab shows table/gallery toggle icons
- [ ] Gallery view shows photo thumbnails in a responsive grid
- [ ] Clicking a photo opens the Drive folder link in new tab
- [ ] Pillar/month filter updates gallery
- [ ] Broken image URL shows placeholder icon (not broken image browser icon)
- [ ] Table view toggle restores existing report list

---

## T-17 — Configurable KPI Targets

**Files:** `Code.gs`, `Index.html`, `JavaScript.html`  
**Depends on:** Nothing (stored in Script Properties)

### Code.gs — Add get/set functions

```javascript
const KPI_TARGETS_KEY = 'nadi_kpi_targets';

function getKpiTargets() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(KPI_TARGETS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function setKpiTargets(targets) {
  try {
    PropertiesService.getScriptProperties().setProperty(KPI_TARGETS_KEY, JSON.stringify(targets));
    return { status: 'SUCCESS' };
  } catch(e) {
    logError_('setKpiTargets', e);
    return { status: 'ERROR', message: e.message };
  }
}
```

---

### Index.html — Add KPI Targets config block (in Settings/Notification panel)

```html
<hr class="my-4">
<div class="section-title"><i class="fa-solid fa-bullseye me-2 text-primary"></i>KPI Targets</div>
<p class="text-muted small">Set monthly and quarterly targets per module. Defaults: Monthly = 1, Quarterly = 3.</p>
<div id="kpi-targets-form" class="mb-3"></div>
<button class="btn btn-primary" onclick="saveKpiTargets()">
  <i class="fa-solid fa-floppy-disk me-2"></i>Save KPI Targets
</button>
```

---

### JavaScript.html — Add target loading and form rendering

```javascript
let kpiTargets = {};

// In bootApp():
google.script.run.withSuccessHandler(t => {
  kpiTargets = t || {};
  renderKpiTargetsForm();
}).getKpiTargets();

function renderKpiTargetsForm() {
  const container = document.getElementById('kpi-targets-form');
  if (!container) return;
  const kpis = getKpiDefinition();
  container.innerHTML = `<div class="table-responsive"><table class="table table-sm table-bordered align-middle">
    <thead class="table-dark"><tr><th>KPI Module</th><th style="width:130px">Monthly Target</th><th style="width:130px">Quarterly Target</th></tr></thead>
    <tbody>${kpis.map(k => {
      const cur = kpiTargets[k.id] || {};
      return `<tr>
        <td class="small fw-bold">${escapeHtml(k.label)}<div class="text-muted" style="font-size:0.7rem">${escapeHtml(k.pillar)}</div></td>
        <td><input type="number" class="form-control form-control-sm" id="kpit-m-${k.id}" value="${cur.monthly||1}" min="1" max="99"></td>
        <td><input type="number" class="form-control form-control-sm" id="kpit-q-${k.id}" value="${cur.quarterly||3}" min="1" max="99"></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function saveKpiTargets() {
  const kpis = getKpiDefinition();
  const targets = {};
  kpis.forEach(k => {
    targets[k.id] = {
      monthly:   parseInt(document.getElementById(`kpit-m-${k.id}`).value, 10) || 1,
      quarterly: parseInt(document.getElementById(`kpit-q-${k.id}`).value, 10) || 3
    };
  });
  google.script.run.withFailureHandler(handleApiError).withSuccessHandler(() => {
    kpiTargets = targets;
    showToast('KPI targets saved!', 'success');
    if (rawStats.length > 0) drawStats();
  }).setKpiTargets(targets);
}
```

**In `drawStats()`**, replace hardcoded targets:
```javascript
// Before every kpi.forEach loop, add:
const mt = (kpiTargets[kpi.id] && kpiTargets[kpi.id].monthly)   || 1;
const qt = (kpiTargets[kpi.id] && kpiTargets[kpi.id].quarterly) || 3;

// Then replace all: >= 1 → >= mt,  >= 3 → >= qt
// Replace /1 → /mt,  /3 → /qt in progress bar widths
// Replace display text `1` and `3` with mt and qt
```

### Test Checklist
- [ ] Settings panel shows KPI Targets table with all 17 rows
- [ ] Change NADI-Preneur monthly target to 2, save
- [ ] Dashboard: NADI-Preneur shows `/2` monthly target
- [ ] 1 session achieved shows "In Progress" not "Achieved"
- [ ] Refresh page → targets persist
- [ ] Reset to 1/3 → dashboard goes back to defaults

---

## T-18 — Export Reports to Excel (.xlsx)

**Files:** `Code.gs`, `Index.html`, `JavaScript.html`  
**Depends on:** T-14 (`logError_` available)

### Code.gs — Add Excel export function

```javascript
function exportReportAsExcel(pillar, monthIndex, year) {
  try {
    const stats = getDashboardStats();
    const completed = stats.filter(s => {
      if (s.status !== 'COMPLETED') return false;
      if (pillar && s.pillar !== pillar) return false;
      if (monthIndex !== '' && monthIndex !== null && monthIndex !== undefined && s.month !== parseInt(monthIndex, 10)) return false;
      if (year && s.year !== parseInt(year, 10)) return false;
      return true;
    });
    if (completed.length === 0) return { status: 'EMPTY' };

    const tmpSS = SpreadsheetApp.create(`NADI_Export_Temp_${Date.now()}`);
    const sheet = tmpSS.getActiveSheet();
    sheet.setName('Report');

    const headers = ['Pillar','Module','Sub-Module','Program Name','Date','Time','Participant Name','IC'];
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');

    const rows = completed.map(r => [r.pillar, r.module, r.sub, r.progName, r.date, r.time, r.partName, r.partIc]);
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    for (let i = 1; i <= headers.length; i++) sheet.autoResizeColumn(i);
    sheet.setFrozenRows(1);

    const id = tmpSS.getId();
    const response = UrlFetchApp.fetch(
      `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,
      { headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` } }
    );

    const label = `NADI_Report_${year||'All'}_${monthIndex!==''?monthIndex:'All'}`;
    const blob = response.getBlob().setName(`${label}.xlsx`);
    const root = getRootFolder_();
    const file = root.createFile(blob);
    const url = file.getDownloadUrl();

    DriveApp.getFileById(id).setTrashed(true); // Clean up temp sheet

    return { status: 'SUCCESS', url };
  } catch(e) {
    logError_('exportReportAsExcel', e);
    return { status: 'ERROR', message: e.message };
  }
}
```

---

### Index.html — Add Export Excel button next to Export CSV

```html
<button class="btn btn-success btn-sm" onclick="exportToExcel()" id="btn-export-excel">
  <i class="fa-solid fa-file-excel me-1"></i>Export Excel
</button>
```

---

### JavaScript.html — Add frontend function

```javascript
function exportToExcel() {
  const pF = document.getElementById('r-pillar').value;
  const mF = document.getElementById('r-month').value;
  const yF = document.getElementById('d-year').value;
  const btn = document.getElementById('btn-export-excel');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i>Exporting...';

  google.script.run
    .withFailureHandler(err => { handleApiError(err); btn.disabled=false; btn.innerHTML=orig; })
    .withSuccessHandler(res => {
      btn.disabled = false; btn.innerHTML = orig;
      if (res.status === 'SUCCESS') {
        window.open(res.url, '_blank');
        showToast('Excel file ready!', 'success');
      } else if (res.status === 'EMPTY') {
        showToast('No data to export for this filter.', 'warning');
      } else {
        showToast('Export failed: ' + (res.message || 'Unknown error'), 'danger');
      }
    }).exportReportAsExcel(pF, mF, yF);
}
```

### Test Checklist
- [ ] "Export Excel" button appears in Reports toolbar
- [ ] Click it → spinner shows, then .xlsx download link opens in new tab
- [ ] Downloaded file opens in Excel/Google Sheets with correct headers
- [ ] Filter by Pillar → only that pillar in file
- [ ] No data for filter → "No data" toast, no file created
- [ ] Temp spreadsheet is NOT visible in Drive root after export
- [ ] Exported file saved to ROOT_FOLDER in Drive

---

## T-19 — KPI Toggle On/Off per Module

**Files:** `Code.gs`, `Index.html`, `JavaScript.html`, `Styles.html`  
**Depends on:** T-17 (uses same Script Properties pattern)

### Behaviour
- Toggle ON (default): KPI counts toward the main achievement %, badge, and totals
- Toggle OFF: KPI still shows all its data (count, progress bar, pax) but is **excluded from the score denominator and numerator**
- Disabled KPI gets a strikethrough label, diagonal stripe background, greyed progress bar, and "Excluded from score" badge
- State persists via Script Properties

---

### Code.gs — Add toggle storage functions

```javascript
const KPI_TOGGLE_KEY = 'nadi_kpi_toggles';

function getKpiToggles() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(KPI_TOGGLE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function setKpiToggle(kpiId, enabled) {
  try {
    const toggles = getKpiToggles();
    toggles[String(kpiId)] = !!enabled;
    PropertiesService.getScriptProperties().setProperty(KPI_TOGGLE_KEY, JSON.stringify(toggles));
    return { status: 'SUCCESS' };
  } catch(e) {
    logError_('setKpiToggle', e);
    return { status: 'ERROR' };
  }
}
```

---

### JavaScript.html — Add toggle state + helpers

```javascript
let kpiToggles = {}; // { kpiId: true/false } — default true (included)

// In bootApp():
google.script.run.withSuccessHandler(t => { kpiToggles = t || {}; }).getKpiToggles();

function isKpiEnabled(kpiId) {
  return kpiToggles[String(kpiId)] !== false; // default: enabled
}

function toggleKpi(kpiId, checkboxEl) {
  const newState = checkboxEl.checked;
  kpiToggles[String(kpiId)] = newState;
  google.script.run
    .withFailureHandler(handleApiError)
    .withSuccessHandler(() => {
      showToast(`KPI ${newState ? 'included in' : 'excluded from'} score.`, 'info');
      drawStats(); // Immediately redraw with updated score
    }).setKpiToggle(kpiId, newState);
}
```

**Update `drawStats()` — score calculation:**

```javascript
// Track enabled KPIs for denominator
let enabledKpiCount = 0;

kpis.forEach(kpi => {
  const kpiEnabled = isKpiEnabled(kpi.id);
  if (kpiEnabled) enabledKpiCount++;

  // ... existing monthly/quarterly count logic unchanged ...

  const monthlyAchieved = monthlyCount >= mt;
  const quarterlyAchieved = quarterlyCount >= qt;

  // Only count toward score if enabled
  if (monthlyAchieved  && kpiEnabled) monthlyAchievedCount++;
  if (quarterlyAchieved && kpiEnabled) quarterlyAchievedCount++;

  // ... rest of rendering ...
});

// Updated percentage uses enabledKpiCount as denominator
const effectiveDenominator = enabledKpiCount || 1;
const monthlyPerc   = Math.round((monthlyAchievedCount   / effectiveDenominator) * 100);
const quarterlyPerc = Math.round((quarterlyAchievedCount / effectiveDenominator) * 100);
```

**Update KPI table row HTML to include toggle switch:**

```javascript
const enabled = isKpiEnabled(kpi.id);

tableHtml += `
  <tr class="${!enabled ? 'kpi-row-disabled' : ''}">
    <td>
      <div class="d-flex align-items-start gap-2">
        <div class="form-check form-switch mb-0 mt-1">
          <input class="form-check-input kpi-toggle-switch" type="checkbox" role="switch"
            id="kpi-tog-${kpi.id}"
            ${enabled ? 'checked' : ''}
            onchange="toggleKpi(${kpi.id}, this)"
            title="${enabled ? 'Click to exclude from score' : 'Click to include in score'}">
        </div>
        <div>
          <div class="fw-bold ${!enabled ? 'text-decoration-line-through opacity-50' : ''}">${escapeHtml(kpi.label)}</div>
          <div class="small text-muted">${escapeHtml(kpi.pillar)}</div>
          ${!enabled ? '<span class="badge bg-secondary mt-1" style="font-size:0.6rem;">Excluded from score</span>' : ''}
        </div>
      </div>
    </td>
    ... rest of columns unchanged ...
  </tr>`;
```

**Update Achievement Breakdown card HTML to include toggle:**

```javascript
const enabled = isKpiEnabled(kpi.id);

breakdownHtml += `
  <div class="col-xl-3 col-lg-4 col-md-6">
    <div class="nadi-card p-3 h-100 achievement-card ${!enabled ? 'kpi-card-disabled' : ''}">
      <div class="d-flex justify-content-between align-items-start mb-1">
        <div class="small text-uppercase fw-bold text-muted">${escapeHtml(kpi.pillar)}</div>
        <div class="form-check form-switch mb-0">
          <input class="form-check-input" type="checkbox" role="switch"
            ${enabled ? 'checked' : ''}
            onchange="toggleKpi(${kpi.id}, this)"
            title="${enabled ? 'Exclude from score' : 'Include in score'}">
        </div>
      </div>
      <div class="fw-bold mb-3 text-truncate ${!enabled ? 'opacity-50 text-decoration-line-through' : ''}"
           title="${escapeHtml(kpi.label)}">${escapeHtml(kpi.label)}</div>
      ... rest of card unchanged ...
    </div>
  </div>`;
```

---

### Styles.html — Add disabled KPI styles

```css
/* KPI Toggle — Disabled State */
.kpi-row-disabled {
  opacity: 0.65;
  background: repeating-linear-gradient(
    45deg, transparent, transparent 8px,
    rgba(0,0,0,0.025) 8px, rgba(0,0,0,0.025) 16px
  ) !important;
}
[data-theme="dark"] .kpi-row-disabled {
  background: repeating-linear-gradient(
    45deg, transparent, transparent 8px,
    rgba(255,255,255,0.025) 8px, rgba(255,255,255,0.025) 16px
  ) !important;
}
.kpi-card-disabled {
  border-left-color: var(--text-muted) !important;
  background: linear-gradient(90deg, rgba(100,116,139,0.06) 0%, transparent 100%) !important;
}
.kpi-card-disabled .hud-progress-bar {
  background: var(--text-muted) !important;
  box-shadow: none !important;
}
.kpi-toggle-switch { cursor: pointer; }
```

### Test Checklist
- [ ] Dashboard KPI table: each row has a toggle switch (default all ON)
- [ ] Achievement Breakdown cards each have a toggle switch
- [ ] Toggle OFF one KPI → row shows diagonal stripe + strikethrough label + "Excluded from score" badge
- [ ] Main KPI % updates immediately (denominator decreases)
- [ ] Achievement badge re-evaluates (e.g. was Gold, toggling off an achieved KPI may change it)
- [ ] Disabled KPI still shows its actual count and progress bar (details intact)
- [ ] Reload page → toggle states persist correctly
- [ ] Toggle back ON → score recalculates, stripe background removed
- [ ] All KPIs toggled OFF → shows 0% (no divide-by-zero error or NaN)
- [ ] Dark mode: striped background visible but subtle

---

*End of Plan — 19 Tickets | 8 Feature Groups | 4 Files*
