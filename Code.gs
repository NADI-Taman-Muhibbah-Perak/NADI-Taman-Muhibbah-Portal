/**
 * NADI PORTAL - Phase 2
 * Stability, Data Integrity & Refactoring
 */

const ROOT_FOLDER_ID = '1zJAlEMlH6rvyoLpEJhOA9gBsQMzhmlUd';
const DRAFTS_FOLDER_NAME = '__NADI_PORTAL_DRAFTS__';

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Portal NADI Taman Muhibbah')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- SECTION: Utilities ---

function formatDateStr(date) {
  if (!date) return "";
  if (typeof date === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(date)) return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return `${('0' + d.getDate()).slice(-2)}-${('0' + (d.getMonth() + 1)).slice(-2)}-${d.getFullYear()}`;
}

function formatTimeStr(timeObj) {
  if (!timeObj) return "";
  if (timeObj instanceof Date) {
    let h = ('0' + timeObj.getHours()).slice(-2);
    let m = ('0' + timeObj.getMinutes()).slice(-2);
    return `${h}:${m}`;
  }
  return String(timeObj);
}

function normalizeText_(value) {
  return String(value || '').trim();
}

function normalizeName_(value) {
  return String(value || '').toUpperCase().trim().replace(/\s+/g, ' ');
}

function getCompositeKey_(name, date, pillar, mod, sub) {
  return `${normalizeName_(name)}|${formatDateStr(date)}|${normalizeName_(pillar)}|${normalizeName_(mod)}|${normalizeName_(sub)}`;
}

function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function invalidateMemberCache() { CacheService.getScriptCache().remove('members_v1'); }
function invalidateStatsCache() { CacheService.getScriptCache().remove('stats_v2'); }
function invalidateDraftCache() { CacheService.getScriptCache().remove('drafts_v2'); }
function invalidateMeetingCache() { CacheService.getScriptCache().remove('meetings_v1'); }
function invalidateScreeningCache() { CacheService.getScriptCache().remove('screening_v1'); }

function invalidateCaches() {
  const cache = CacheService.getScriptCache();
  ['members_v1', 'modules_v1', 'stats_v2', 'drafts_v2', 'meetings_v1', 'notif_v1', 'screening_v1'].forEach(k => {
    try { cache.remove(k); } catch (e) {}
  });
}

function cacheJson(key, producer, ttlSeconds) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key);
  if (hit) {
    try { return JSON.parse(hit); } catch (e) {}
  }
  const value = producer();
  try {
    const text = JSON.stringify(value);
    if (text.length < 95000) cache.put(key, text, ttlSeconds || 300);
  } catch (e) {}
  return value;
}

// --- SECTION: Drive & Folders ---

function getRootFolder_() {
  return DriveApp.getFolderById(ROOT_FOLDER_ID);
}

function getSubFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function getDraftFolder_() {
  const root = getRootFolder_();
  const folders = root.getFoldersByName(DRAFTS_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : root.createFolder(DRAFTS_FOLDER_NAME);
}

function getMeetingFolder_() {
  const root = getRootFolder_();
  return getSubFolder(root, 'Meetings');
}

// --- SECTION: Sheets Management ---

function ensureMembersSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Members');
  if (!sheet) sheet = ss.insertSheet('Members');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Name','IC','Mobile','Email','Race','Ethnic','Occupation','Salary','Education','Distance','Date Joined','Age','DOB']);
  }
  return sheet;
}

function ensureScreeningSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Screening');
  if (!sheet) sheet = ss.insertSheet('Screening');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Date', 'Name', 'IC', 'Height', 'Weight', 'BMI', 'Category', 'Systolic', 'Diastolic', 'Pulse', 'Glucose', 'SpO2', 'Remarks']);
  } else {
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (header.indexOf('Pulse') === -1) {
      sheet.insertColumnAfter(10);
      sheet.getRange(1, 11).setValue('Pulse');
    }
  }
  return sheet;
}

function ensureMeetingsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Meetings');
  if (!sheet) sheet = ss.insertSheet('Meetings');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Date', 'Time', 'Title', 'Link', 'Status', 'Pax', 'Folder URL', 'Photo 1', 'Photo 2', 'Photo 3', 'Remarks']);
  } else {
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (header.indexOf('Remarks') === -1) {
      sheet.getRange(1, 12).setValue('Remarks');
    }
  }
  return sheet;
}

function sheetHasProgram_(sheet, keyParts) {
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return false;

  const targetKey = getCompositeKey_(
    keyParts.name,
    keyParts.date,
    keyParts.pillar,
    keyParts.module,
    keyParts.subModule
  );

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowKey = getCompositeKey_(
      row[3], // Name
      row[1], // Date
      row[4], // Pillar
      row[5], // Module
      row[6]  // SubModule
    );
    if (rowKey === targetKey) return true;
  }
  return false;
}

function getProgramSessionInfo_(sheet, keyParts) {
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;

  const targetKey = getCompositeKey_(
    keyParts.name,
    keyParts.date,
    keyParts.pillar,
    keyParts.module,
    keyParts.subModule
  );

  const rows = [];
  const participants = new Set();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowKey = getCompositeKey_(
      row[3], // Name
      row[1], // Date
      row[4], // Pillar
      row[5], // Module
      row[6]  // SubModule
    );
    if (rowKey === targetKey) {
      rows.push(i + 1);
      if (row[7]) participants.add(normalizeName_(row[7]));
    }
  }

  if (rows.length === 0) return null;

  return {
    rows: rows,
    participants: Array.from(participants)
  };
}

// --- SECTION: Members ---

function getMemberData() {
  return cacheJson('members_v1', () => {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Members');
      if (!sheet) return [];
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];
      const values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
      return values.map((r, index) => ({
        row: index + 2,
        name: normalizeName_(r[0]),
        ic: String(r[1] || '').trim(),
        mobile: String(r[2] || '').trim(),
        email: String(r[3] || '').trim(),
        race: String(r[4] || ''),
        ethnic: String(r[5] || ''),
        occupation: String(r[6] || ''),
        salary: String(r[7] || ''),
        education: String(r[8] || ''),
        distance: String(r[9] || ''),
        dateJoin: r[10] ? formatDateStr(r[10]) : '',
        age: String(r[11] || ''),
        dob: r[12] ? formatDateStr(r[12]) : ''
      }));
    } catch (e) {
      return [];
    }
  }, 300);
}

function getMemberMap_() {
  const members = getMemberData();
  const nameMap = {};
  const icMap = {};
  members.forEach(m => {
    if (m.name) nameMap[m.name] = m;
    if (m.ic) icMap[m.ic] = m;
  });
  return { names: nameMap, ics: icMap };
}

function updateMemberDetail(row, data) {
  const sheet = ensureMembersSheet_();
  const r = parseInt(row, 10);
  if (!r) return { status: 'ERROR', message: 'Invalid row' };

  sheet.getRange(r, 1, 1, 13).setValues([[
    normalizeName_(data.name),
    String(data.ic || '').trim(),
    String(data.mobile || '').trim(),
    String(data.email || '').trim(),
    String(data.race || '').trim(),
    String(data.ethnic || '').trim(),
    String(data.occupation || '').trim(),
    String(data.salary || '').trim(),
    String(data.education || '').trim(),
    String(data.distance || '').trim(),
    data.dateJoin || '',
    String(data.age || '').trim(),
    data.dob || ''
  ]]);

  invalidateMemberCache();
  invalidateStatsCache();
  return { status: 'SUCCESS' };
}

function mergeMembers(masterRow, duplicateRows, finalData) {
  const sheet = ensureMembersSheet_();
  const masterR = parseInt(masterRow, 10);

  // Apply final resolved data to master row
  if (finalData) {
    sheet.getRange(masterR, 1, 1, 13).setValues([[
      normalizeName_(finalData.name),
      String(finalData.ic || '').trim(),
      String(finalData.mobile || '').trim(),
      String(finalData.email || '').trim(),
      String(finalData.race || '').trim(),
      String(finalData.ethnic || '').trim(),
      String(finalData.occupation || '').trim(),
      String(finalData.salary || '').trim(),
      String(finalData.education || '').trim(),
      String(finalData.distance || '').trim(),
      finalData.dateJoin || '',
      String(finalData.age || '').trim(),
      finalData.dob || ''
    ]]);
  }

  // Delete duplicates in reverse order
  const rowsToDelete = duplicateRows.map(r => parseInt(r, 10)).sort((a, b) => b - a);
  rowsToDelete.forEach(r => {
    sheet.deleteRow(r);
  });

  invalidateMemberCache();
  invalidateStatsCache();
  return { status: 'SUCCESS', deletedCount: rowsToDelete.length };
}

// --- SECTION: Meetings ---

function saveMeeting(data) {
  const sheet = ensureMeetingsSheet_();
  sheet.appendRow([
    formatDateStr(new Date()),
    formatDateStr(data.date),
    data.time || '',
    String(data.title || '').toUpperCase().trim(),
    data.link || '',
    'UPCOMING',
    '', '', '', '', '', ''
  ]);
  invalidateMeetingCache();
  return { status: 'SUCCESS' };
}

function getMeetings() {
  return cacheJson('meetings_v1', () => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Meetings');
    if (!sheet) return [];
    const range = sheet.getDataRange();
    const values = range.getValues();
    const displayValues = range.getDisplayValues();
    if (values.length < 2) return [];

    return values.slice(1).map((r, i) => {
      const displayRow = displayValues[i+1];
      return {
        row: i + 2,
        timestamp: displayRow[0],
        date: formatDateStr(r[1]),
        time: displayRow[2],
        title: r[3],
        link: r[4],
        status: r[5],
        pax: r[6],
        folderUrl: r[7],
        photos: [r[8], r[9], r[10]].filter(Boolean),
        remarks: r[11] || ''
      };
    });
  }, 60);
}

function deleteMeeting(row) {
  const sheet = ensureMeetingsSheet_();
  const r = parseInt(row, 10);
  if (!r) return { status: 'ERROR' };
  sheet.deleteRow(r);
  invalidateMeetingCache();
  return { status: 'SUCCESS' };
}

function updateMeeting(row, data) {
  const sheet = ensureMeetingsSheet_();
  const r = parseInt(row, 10);
  if (!r) return { status: 'ERROR' };

  if (data.date) sheet.getRange(r, 2).setValue(formatDateStr(data.date));
  if (data.time !== undefined) sheet.getRange(r, 3).setValue(data.time);
  if (data.title) sheet.getRange(r, 4).setValue(String(data.title).toUpperCase().trim());
  if (data.link !== undefined) sheet.getRange(r, 5).setValue(data.link);
  if (data.pax !== undefined) sheet.getRange(r, 7).setValue(data.pax);
  if (data.remarks !== undefined) sheet.getRange(r, 12).setValue(data.remarks);

  invalidateCaches();
  return { status: 'SUCCESS' };
}

function submitMeetingReport(row, pax, photos, remarks) {
  const sheet = ensureMeetingsSheet_();
  const r = parseInt(row, 10);
  if (!r) return { status: 'ERROR' };

  const meetingData = sheet.getRange(r, 1, 1, 6).getValues()[0];
  const date = meetingData[1];
  const title = meetingData[3];

  const uploadResult = (photos && photos.length > 0) ?
    processMeetingUploads(photos, date, title) :
    { links: [], folderUrl: '' };

  sheet.getRange(r, 6, 1, 7).setValues([[
    'COMPLETED',
    pax,
    uploadResult.folderUrl || '',
    uploadResult.links[0] || '',
    uploadResult.links[1] || '',
    uploadResult.links[2] || '',
    remarks || ''
  ]]);

  invalidateMeetingCache();
  return { status: 'SUCCESS', folderUrl: uploadResult.folderUrl };
}

function processMeetingUploads(photoData, date, title) {
  const meetingRoot = getMeetingFolder_();
  const d = new Date(date);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthStr = `${months[d.getMonth()]} ${d.getFullYear()}`;
  const targetFolder = getSubFolder(meetingRoot, monthStr);
  const displayDate = formatDateStr(date);

  const links = (photoData || []).map((file, index) => {
    const base64 = String(file.base64 || '');
    const parts = base64.split(',');
    if (parts.length < 2) return '';
    const bytes = Utilities.base64Decode(parts[1]);
    const mime = base64.split(';')[0].split(':')[1] || 'image/jpeg';
    const blob = Utilities.newBlob(bytes, mime);
    blob.setName(`NADI Taman Muhibbah - (${title}) - ${displayDate} (${index + 1})`);
    return targetFolder.createFile(blob).getUrl();
  }).filter(Boolean);

  return { links: links, folderUrl: targetFolder.getUrl() };
}

// --- SECTION: Drafts ---

function normalizeDraftName_(name) {
  const raw = String(name || '').trim();
  return raw || `Draft ${formatDateStr(new Date())}`;
}

function draftFileName_(id) {
  return `draft_${id}.json`;
}

function saveDraftToDrive(draftName, state, draftId) {
  const folder = getDraftFolder_();
  const id = draftId ? String(draftId) : Utilities.getUuid();
  const name = normalizeDraftName_(draftName);
  const payload = {
    id: id,
    name: name,
    updatedAt: new Date().toISOString(),
    state: state || {}
  };

  const fileName = draftFileName_(id);
  const old = folder.getFilesByName(fileName);
  while (old.hasNext()) old.next().setTrashed(true);

  folder.createFile(fileName, JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT)
    .setDescription(`NADI portal draft: ${name}`);

  invalidateDraftCache();
  return { status: 'SUCCESS', id: id, name: name, updatedAt: payload.updatedAt };
}

function listDraftsFromDrive() {
  return cacheJson('drafts_v2', () => {
    const folder = getDraftFolder_();
    const files = folder.getFiles();
    const list = [];
    while (files.hasNext()) {
      const f = files.next();
      if (f.isTrashed()) continue;
      const nm = f.getName();
      if (!/^draft_.+\.json$/i.test(nm)) continue;
      try {
        const payload = JSON.parse(f.getBlob().getDataAsString() || '{}');
        const state = payload.state || {};
        const photoCount = state.photoData ? Object.values(state.photoData).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0) : 0;
        list.push({
          id: String(payload.id || nm.replace(/^draft_|\.json$/gi, '')),
          name: String(payload.name || 'Untitled Draft'),
          updatedAt: String(payload.updatedAt || ''),
          fileName: nm,
          summary: {
            completed: (state.prog || []).length || 0,
            planned: (state.plan || []).length || 0,
            members: (state.members || []).length || 0,
            photos: photoCount
          }
        });
      } catch (e) {}
    }
    list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return list;
  }, 180);
}

function loadDraftFromDrive(draftId) {
  const folder = getDraftFolder_();
  const fileName = draftFileName_(draftId);
  const files = folder.getFilesByName(fileName);
  if (!files.hasNext()) return { status: 'NOT_FOUND' };
  const file = files.next();
  const payload = JSON.parse(file.getBlob().getDataAsString() || '{}');
  return {
    status: 'SUCCESS',
    id: String(payload.id || draftId),
    name: String(payload.name || 'Untitled Draft'),
    updatedAt: String(payload.updatedAt || ''),
    state: payload.state || {}
  };
}

function deleteDraftFromDrive(draftId) {
  const folder = getDraftFolder_();
  const fileName = draftFileName_(draftId);
  const files = folder.getFilesByName(fileName);
  let deleted = false;
  while (files.hasNext()) {
    files.next().setTrashed(true);
    deleted = true;
  }
  invalidateDraftCache();
  return deleted ? { status: 'SUCCESS' } : { status: 'NOT_FOUND' };
}

// --- SECTION: Automation & Notifications ---

function getKPISettings() {
  const props = PropertiesService.getScriptProperties();
  return {
    monthlyTarget: parseInt(props.getProperty('kpi_monthly_target') || '1', 10),
    quarterlyTarget: parseInt(props.getProperty('kpi_quarterly_target') || '3', 10)
  };
}

function saveKPISettings(data) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('kpi_monthly_target', String(data.monthlyTarget || 1));
  props.setProperty('kpi_quarterly_target', String(data.quarterlyTarget || 3));
  invalidateStatsCache();
  return { status: 'SUCCESS' };
}

function getNotifSettings() {
  return cacheJson('notif_v1', () => {
    const props = PropertiesService.getScriptProperties();
    return {
      enabled: props.getProperty('notif_enabled') === 'true',
      email: props.getProperty('notif_email') || ''
    };
  }, 600);
}

function setNotifSettings(data) {
  const props = PropertiesService.getScriptProperties();
  const enabled = !!data.enabled;
  props.setProperty('notif_enabled', String(enabled));
  props.setProperty('notif_email', String(data.email || ''));

  // Manage Trigger
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'sendDailyDigest') ScriptApp.deleteTrigger(t);
  });

  if (enabled) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ScriptApp.newTrigger('sendDailyDigest')
      .timeBased()
      .atHour(7)
      .everyDays(1)
      .inTimezone(ss.getSpreadsheetTimezone())
      .create();
  }

  CacheService.getScriptCache().remove('notif_v1');
  return { status: 'SUCCESS' };
}

/**
 * Triggered Daily to send upcoming program digest
 */
function escapeHtmlGs_(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sendDailyDigest() {
  const settings = getNotifSettings();
  if (!settings.enabled || !settings.email) return;

  const stats = getDashboardStats();
  const today = new Date();
  today.setHours(0,0,0,0);
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);

  const upcoming = stats.filter(s => {
    if (s.status !== 'PLANNED') return false;
    const d = parseDateStrToDate_(s.date);
    return d >= today && d <= nextWeek;
  });

  if (upcoming.length === 0) return;

  upcoming.sort((a, b) => parseDateStrToDate_(a.date) - parseDateStrToDate_(b.date));

  let body = `<h3>NADI Portal: Daily Program Digest</h3>`;
  body += `<p>The following programs are scheduled for the next 7 days:</p>`;
  body += `<table border="1" cellpadding="5" style="border-collapse: collapse;">`;
  body += `<tr style="background-color: #f2f2f2;"><th>Date</th><th>Time</th><th>Program Name</th><th>Pillar</th></tr>`;

  upcoming.forEach(u => {
    body += `<tr><td>${escapeHtmlGs_(u.date)}</td><td>${escapeHtmlGs_(u.time)}</td><td>${escapeHtmlGs_(u.progName)}</td><td>${escapeHtmlGs_(u.pillar)}</td></tr>`;
  });
  body += `</table>`;
  body += `<p><a href="${getScriptUrl()}">Open Portal</a></p>`;

  MailApp.sendEmail({
    to: settings.email,
    subject: `[NADI] Daily Digest - ${upcoming.length} Upcoming Programs`,
    htmlBody: body
  });
}

function parseDateStrToDate_(str) {
  const parts = str.split('-');
  return new Date(parts[2], parts[1]-1, parts[0]);
}

// --- SECTION: Reporting & Stats ---

function getModuleData() {
  return cacheJson('modules_v1', () => ({
    "Entrepreneur": {
      "NADI-Preneur": ["General"],
      "NADI-EmpowerHER": ["General"],
      "NADI-KidVenture": ["General"]
    },
    "Lifelong Learning": {
      "NADI-TinyTechies": ["Sekolah Rendah", "Sekolah Menengah"],
      "NADI-Nurture": ["eKelas Pelajar", "eKelas Usahawan", "DiLea", "Cybersecurity"],
      "NADI-SkillForge": ["eSport", "MAHIR-Foto", "MAHIR-Jahit", "MAHIR-Pertanian Pintar", "MAHIR-Masak", "MAHIR-Baiki Gajet", "MAHIR-Others"]
    },
    "Wellbeing": {
      "NADI-FlourisHER": ["Screening"],
      "NADI-MenWell": ["Screening"],
      "NADI-Care": ["Podcast", "Webinar", "Physical Activity", "Short Video"]
    },
    "Awareness": {
      "KIS": ["Sekolah Rendah", "Sekolah Menengah", "MCMC"]
    },
    "Government Initiative": {
      "BUDI MADANI": ["General"],
      "MyFutureJobs": ["General"],
      "MyDigital ID": ["General"],
      "SejaTi MADANI": ["General"],
      "AI untuk Rakyat": ["General"],
      "PriceCatcher App": ["General"],
      "Cashless Society": ["General"],
      "Manfaat MADANI": ["General"],
      "Komuniti MADANI": ["General"]
    }
  }), 300);
}

function searchReportsGlobal(query) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const q = String(query || '').toUpperCase().trim();
  if (!q) return [];

  const members = getMemberMap_();
  const stats = [];
  const pillars = Object.keys(getModuleData());

  pillars.forEach(p => {
    const s = ss.getSheetByName(p.trim());
    if (!s) return;
    const data = s.getDataRange().getValues();
    if (data.length < 2) return;
    for (let i = 1; i < data.length; i++) {
      const row = data[i] || [];
      const rowString = row.join(' ').toUpperCase();
      if (rowString.indexOf(q) === -1) continue;

      const d = new Date(row[1]);
      if (isNaN(d.getTime())) continue;

      const partName = String(row[7] || '').trim();
      stats.push({
        pillar: p,
        module: String(row[5] || ''),
        sub: String(row[6] || ''),
        progName: String(row[3] || ''),
        month: d.getMonth(),
        year: d.getFullYear(),
        date: formatDateStr(d),
        time: formatTimeStr(row[2]),
        partName: partName || 'UNKNOWN',
        partIc: members.names[partName.toUpperCase()] ? members.names[partName.toUpperCase()].ic : 'N/A',
        status: 'COMPLETED',
        folderUrl: row[8] || '',
        picUrl: row[9] || '',
        compositeKey: getCompositeKey_(row[3], d, p, row[5], row[6])
      });
    }
  });
  return stats;
}

function getDashboardStats() {
  return cacheJson('stats_v2', () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const members = getMemberMap_();
    const stats = [];
    const pillars = Object.keys(getModuleData());

    pillars.forEach(p => {
      const s = ss.getSheetByName(p.trim());
      if (!s) return;
      const data = s.getDataRange().getValues();
      if (data.length < 2) return;
      for (let i = 1; i < data.length; i++) {
        const row = data[i] || [];
        const d = new Date(row[1]);
        if (isNaN(d.getTime())) continue;

        const partName = String(row[7] || '').trim();
        const folderUrl = row[8] ? String(row[8]) : '';
        const picUrl = row[9] ? String(row[9]) : '';

        stats.push({
          pillar: p,
          module: String(row[5] || ''),
          sub: String(row[6] || ''),
          progName: String(row[3] || ''),
          month: d.getMonth(),
          year: d.getFullYear(),
          date: formatDateStr(d),
          time: formatTimeStr(row[2]),
          partName: partName || 'UNKNOWN',
          partIc: members.names[partName.toUpperCase()] ? members.names[partName.toUpperCase()].ic : 'N/A',
          status: 'COMPLETED',
          folderUrl: folderUrl,
          picUrl: picUrl,
          compositeKey: getCompositeKey_(row[3], d, p, row[5], row[6])
        });
      }
    });

    const planSheet = ss.getSheetByName('Planner');
    if (planSheet) {
      const pData = planSheet.getDataRange().getValues();
      const pDisplay = planSheet.getDataRange().getDisplayValues();
      for (let j = 1; j < pData.length; j++) {
        const row = pData[j] || [];
        const displayRow = pDisplay[j] || [];
        const pd = new Date(row[1]);
        if (isNaN(pd.getTime())) continue;
        stats.push({
          pillar: String(row[4] || ''),
          module: String(row[5] || ''),
          sub: String(row[6] || ''),
          progName: String(row[3] || ''),
          month: pd.getMonth(),
          year: pd.getFullYear(),
          date: formatDateStr(pd),
          time: formatTimeStr(row[2]),
          remarks: String(row[8] || ''),
          link: String(row[9] || ''),
          partName: 'PLANNER_ENTRY',
          status: 'PLANNED',
          folderUrl: '',
          picUrl: '',
          compositeKey: getCompositeKey_(row[3], pd, row[4], row[5], row[6])
        });
      }
    }
    return stats;
  }, 90);
}

// --- SECTION: Data Submission ---

function processUploadsAsArray(photoData, pillar, module, date, progName) {
  const root = getRootFolder_();
  const d = new Date(date);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthStr = `${months[d.getMonth()]} ${d.getFullYear()}`;

  // Unified Hierarchy: Pillar > Module > Month Year > Program Name
  const pillarFolder = getSubFolder(root, pillar);
  const moduleFolder = getSubFolder(pillarFolder, module);
  const monthFolder = getSubFolder(moduleFolder, monthStr);
  const targetFolder = getSubFolder(monthFolder, String(progName || 'Untitled').toUpperCase().trim());

  const displayDate = formatDateStr(date);
  const normalizedProgName = String(progName || 'Untitled').toUpperCase().trim();
  const filePrefix = `NADI Taman Muhibbah, Perak - ${displayDate} - ${normalizedProgName}`;

  // Count existing photos for this specific date and program to continue numbering
  let existingCount = 0;
  const files = targetFolder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().startsWith(filePrefix)) {
      existingCount++;
    }
  }

  const links = (photoData || []).map((file, index) => {
    const base64 = String(file.base64 || '');
    const parts = base64.split(',');
    if (parts.length < 2) return '';
    const bytes = Utilities.base64Decode(parts[1]);
    const mime = base64.split(';')[0].split(':')[1] || 'image/jpeg';
    const blob = Utilities.newBlob(bytes, mime);
    blob.setName(`${filePrefix} (${existingCount + index + 1})`);
    return targetFolder.createFile(blob).getUrl();
  }).filter(Boolean);

  return { links: links, folderUrl: targetFolder.getUrl() };
}

function submitData(programs, participants, newMembers, updates, photosBySession, draftContext, screeningRecords) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const membersSheet = ensureMembersSheet_();
  const skipped = [];
  const folderUrls = [];

  // Process screening records if any
  if (Array.isArray(screeningRecords) && screeningRecords.length > 0) {
    saveScreeningRecords(screeningRecords);
  }

  // Process new members
  if (Array.isArray(newMembers) && newMembers.length > 0) {
    const { names, ics } = getMemberMap_();
    newMembers.forEach(m => {
      const name = normalizeName_(m.name);
      const ic = String(m.ic || '').trim();
      if (!name) return;

      if (ic && ics[ic]) {
        skipped.push({ type: 'member', name, reason: `Duplicate IC (${ic}) found for ${ics[ic].name}` });
        return;
      }

      if (names[name] && names[name].ic === ic) {
        skipped.push({ type: 'member', name, reason: 'Duplicate member (Name & IC match)' });
        return;
      }

      membersSheet.appendRow([
        name, ic, String(m.mobile || '').trim(), String(m.email || '').trim(),
        String(m.race || '').trim(), String(m.ethnic || '').trim(), String(m.occupation || '').trim(),
        String(m.salary || '').trim(), String(m.education || '').trim(), String(m.distance || '').trim(),
        formatDateStr(m.dateJoin), String(m.age || '').trim(), String(m.dob || '').trim()
      ]);
    });
  }

  // Process member updates
  if (Array.isArray(updates) && updates.length > 0) {
    updates.forEach(u => {
      const row = parseInt(u.row, 10);
      if (!row) return;
      if (u.ic) membersSheet.getRange(row, 2).setValue(u.ic);
      if (u.mobile) membersSheet.getRange(row, 3).setValue(u.mobile);
      if (u.email) membersSheet.getRange(row, 4).setValue(u.email);
    });
  }

  const completedParticipants = Array.isArray(participants) ? participants : [];
  const uniqueParticipants = [];
  const seenNames = new Set();
  completedParticipants.forEach(p => {
    const n = normalizeName_(p.name);
    if (!n || seenNames.has(n)) return;
    seenNames.add(n);
    uniqueParticipants.push({ name: n });
  });

  // Process Programs
  programs.forEach(prog => {
    const isPlanned = (prog.status === 'PLANNED');
    const targetSheetName = isPlanned ? 'Planner' : prog.pillar;
    const pSheet = ss.getSheetByName(targetSheetName) || ss.insertSheet(targetSheetName);

    const sessionInfo = getProgramSessionInfo_(pSheet, {
      name: prog.progName,
      date: prog.date,
      pillar: prog.pillar,
      module: prog.module,
      subModule: prog.subModule
    });

    // If it's a planned program, we still use sheetHasProgram logic or just block if sessionInfo exists
    if (isPlanned && sessionInfo) {
      skipped.push({ type: 'program', name: prog.progName, date: formatDateStr(prog.date), reason: 'Duplicate planner entry' });
      return;
    }

    let uploadResult = (!isPlanned && photosBySession && photosBySession[prog.tempId]) ?
      processUploadsAsArray(photosBySession[prog.tempId], prog.pillar, prog.module, prog.date, prog.progName) :
      { links: [], folderUrl: '' };

    if (uploadResult.folderUrl) {
      folderUrls.push({ name: prog.progName, url: uploadResult.folderUrl });
    }

    if (sessionInfo && !isPlanned) {
      // MERGE LOGIC: Session already exists, append new participants and update photos
      const existingParticipants = sessionInfo.participants;
      const newParticipants = uniqueParticipants.filter(p => !existingParticipants.includes(normalizeName_(p.name)));

      if (newParticipants.length === 0 && uploadResult.links.length === 0) {
        skipped.push({ type: 'program', name: prog.progName, date: formatDateStr(prog.date), reason: 'No new data to append' });
        return;
      }

      // 1. Update photos in the first row of the existing session
      if (uploadResult.links.length > 0) {
        const firstRowIndex = sessionInfo.rows[0];
        // Photos start at index 9 in row array, which is Column 10 in Sheet
        const currentPhotos = pSheet.getRange(firstRowIndex, 10, 1, 5).getValues()[0];
        let updated = false;
        let linkIdx = 0;

        for (let i = 0; i < 5; i++) {
          if (!currentPhotos[i] && linkIdx < uploadResult.links.length) {
            currentPhotos[i] = uploadResult.links[linkIdx++];
            updated = true;
          }
        }

        if (updated) {
          pSheet.getRange(firstRowIndex, 10, 1, 5).setValues([currentPhotos]);
        }
      }

      // 2. Append new participants
      if (newParticipants.length > 0) {
        const rowBase = [
          formatDateStr(new Date()),
          formatDateStr(prog.date),
          prog.time || '',
          String(prog.progName || '').toUpperCase().trim(),
          prog.pillar || '',
          prog.module || '',
          prog.subModule || '',
          '', // Name (placeholder)
          '', // Folder URL
          '', '', '', '', '' // Photo 1-5
        ];

        newParticipants.forEach(p => {
          const rowData = rowBase.slice();
          rowData[7] = p.name || '';
          pSheet.appendRow(rowData);
        });
      }
    } else {
      // NEW ENTRY LOGIC (or Planned entry)
      const rowBase = [
        formatDateStr(new Date()),
        formatDateStr(prog.date),
        prog.time || '',
        String(prog.progName || '').toUpperCase().trim(),
        prog.pillar || '',
        prog.module || '',
        prog.subModule || '',
        '',
        '',
        '', '', '', '', ''
      ];

      const loopData = isPlanned ? [{ name: 'PLANNER_RESERVED' }] : uniqueParticipants;
      loopData.forEach((p, index) => {
        const rowData = rowBase.slice();
        rowData[7] = p.name || '';

        if (isPlanned) {
          rowData[8] = prog.remarks || '';
          rowData[9] = prog.link || '';
        } else if (index === 0) {
          rowData[8] = uploadResult.folderUrl || '';
          for (let i = 0; i < 5; i++) {
            rowData[9 + i] = uploadResult.links[i] || '';
          }
        }
        pSheet.appendRow(rowData);
      });
    }
  });

  invalidateMemberCache();
  invalidateStatsCache();
  invalidateScreeningCache();

  let deletedDraft = false;
  const loadedDraftId = draftContext && draftContext.loadedFromDrive ? String(draftContext.draftId || '').trim() : '';
  if (loadedDraftId && Array.isArray(programs) && programs.some(p => p.status === 'COMPLETED')) {
    const del = deleteDraftFromDrive(loadedDraftId);
    deletedDraft = del && del.status === 'SUCCESS';
  }

  return { status: 'SUCCESS', folderUrls: folderUrls, skipped: skipped, deletedDraft: deletedDraft };
}

function removePlanFromSheet(progName, dateStr, pillar, module, subModule) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Planner');
  if (!sheet) return 'Error: No Planner Sheet';

  const targetKey = getCompositeKey_(progName, dateStr, pillar, module, subModule);

  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const rowKey = getCompositeKey_(row[3], row[1], row[4], row[5], row[6]);
    if (rowKey === targetKey) {
      sheet.deleteRow(i + 1);
      invalidateStatsCache();
      return 'DELETED';
    }
  }
  return 'NOT_FOUND';
}

function getLatestScreening(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Screening');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;

  const targetName = normalizeName_(name);
  for (let i = data.length - 1; i >= 1; i--) {
    if (normalizeName_(data[i][2]) === targetName) {
      return {
        date: formatDateStr(data[i][1]),
        height: data[i][4],
        weight: data[i][5],
        bmi: data[i][6],
        category: data[i][7],
        systolic: data[i][8],
        diastolic: data[i][9],
        pulse: data[i][10],
        glucose: data[i][11],
        spo2: data[i][12],
        remarks: data[i][13]
      };
    }
  }
  return null;
}

function getMemberScreeningHistory(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Screening');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const targetName = normalizeName_(name);
  const history = [];

  for (let i = 1; i < data.length; i++) {
    if (normalizeName_(data[i][2]) === targetName) {
      history.push({
        date: formatDateStr(data[i][1]),
        height: data[i][4],
        weight: data[i][5],
        bmi: data[i][6],
        category: data[i][7],
        systolic: data[i][8],
        diastolic: data[i][9],
        pulse: data[i][10],
        glucose: data[i][11],
        spo2: data[i][12],
        remarks: data[i][13]
      });
    }
  }
  return history;
}

function saveScreeningRecords(records) {
  const sheet = ensureScreeningSheet_();
  const timestamp = new Date();
  const dateStr = formatDateStr(timestamp);

  const rows = records.map(r => [
    timestamp,
    dateStr,
    normalizeName_(r.name),
    String(r.ic || '').trim(),
    r.height || '',
    r.weight || '',
    r.bmi || '',
    r.category || '',
    r.systolic || '',
    r.diastolic || '',
    r.pulse || '',
    r.glucose || '',
    r.spo2 || '',
    r.remarks || ''
  ]);

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }

  invalidateScreeningCache();
  return { status: 'SUCCESS' };
}

function updatePlanInSheet(oldKeyParts, newData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Planner');
  if (!sheet) return { status: 'ERROR', message: 'No Planner Sheet' };

  const targetKey = getCompositeKey_(
    oldKeyParts.progName,
    oldKeyParts.date,
    oldKeyParts.pillar,
    oldKeyParts.module,
    oldKeyParts.subModule
  );

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowKey = getCompositeKey_(row[3], row[1], row[4], row[5], row[6]);
    if (rowKey === targetKey) {
      // Columns: 0: Timestamp, 1: Date, 2: Time, 3: Title, 4: Pillar, 5: Module, 6: SubModule, 7: PartName, 8: Remarks, 9: Link
      sheet.getRange(i + 1, 2).setValue(formatDateStr(newData.date));
      sheet.getRange(i + 1, 3).setValue(newData.time || '');
      sheet.getRange(i + 1, 4).setValue(String(newData.progName || '').toUpperCase().trim());
      sheet.getRange(i + 1, 5).setValue(newData.pillar || '');
      sheet.getRange(i + 1, 6).setValue(newData.module || '');
      sheet.getRange(i + 1, 7).setValue(newData.subModule || '');
      sheet.getRange(i + 1, 9).setValue(newData.remarks || '');
      sheet.getRange(i + 1, 10).setValue(newData.link || '');

      invalidateStatsCache();
      return { status: 'SUCCESS' };
    }
  }
  return { status: 'ERROR', message: 'Original record not found' };
}
