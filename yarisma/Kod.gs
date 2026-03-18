// ===== KOD.GS - Sonsuz Yasam Apps Script Backend =====
// Deploy: Web App > Execute as Me > Anyone can access
//
// Script Properties (Proje Ayarları > Script Properties) buraya ekle:
//   FIREBASE_WEB_API_KEY   = AIzaSyA_IijFTARQUObeu63BpM9QPGINUHjtJl8
//   ADMIN_EMAILS           = sdoldur@gmail.com
//   ALLOWED_ORIGINS        = https://sonsuzyasam.github.io,https://www.sonsuzyasam.github.io
//   SPREADSHEET_ID         = 1_rCYk3xfD03qjR1BFfZ7rC94UHvTuPdvJB2pGj6796M
//
// ANSWER_KEYS_JSON otomatik tanımlıdır, Script Properties'e girmen GEREKMEZ.

// ============================================================
// YAPILANDIRMA
// ============================================================

var SHEET_NAMES = {
  USERS:   'Kullanicilar',
  SCORES:  'Puanlar',
  REWARDS: 'Oduller',
  MONTHLY: 'Aylik_Puanlar',
  LOGS:    'SecurityLogs'
};

var PASS_SCORE = 45;

var RATE_LIMITS = {
  createRewardRequest: { windowSec: 60, maxRequests: 10 },
  updateRewardStatus:  { windowSec: 60, maxRequests: 30 },
  submitExamResult:    { windowSec: 60, maxRequests: 25 },
  listRewardRequests:  { windowSec: 60, maxRequests: 60 },
  getLeaderboard:      { windowSec: 60, maxRequests: 120 },
  getMonthlyPoints:    { windowSec: 60, maxRequests: 120 },
  upsertUser:          { windowSec: 60, maxRequests: 30 },
  recordScore:         { windowSec: 60, maxRequests: 30 }
};

// Cevap anahtarları - question-banks.js dosyasından üretildi
var ANSWER_KEYS = {
  tyt: {
    'tyt-1':2,'tyt-2':2,'tyt-3':2,'tyt-4':1,'tyt-5':2,
    'tyt-6':2,'tyt-7':1,'tyt-8':2,'tyt-9':2,'tyt-10':2,
    'tyt-11':2,'tyt-12':2,'tyt-13':1,'tyt-14':1,'tyt-15':2,
    'tyt-16':1,'tyt-17':2,'tyt-18':1,'tyt-19':3,'tyt-20':1,
    'tyt-21':2,'tyt-22':1,'tyt-23':2,'tyt-24':1,'tyt-25':1,
    'tyt-26':2,'tyt-27':1,'tyt-28':1,'tyt-29':1,'tyt-30':2,
    'tyt-31':2,'tyt-32':3,'tyt-33':0,'tyt-34':2,'tyt-35':0,
    'tyt-36':2,'tyt-37':1,'tyt-38':2,'tyt-39':2,'tyt-40':0
  },
  ayt: {
    'ayt-1':3,'ayt-2':1,'ayt-3':1,'ayt-4':2,'ayt-5':1,
    'ayt-6':1,'ayt-7':1,'ayt-8':0,'ayt-9':2,'ayt-10':1
  },
  kpss: {
    'kpss-1':1,'kpss-2':0,'kpss-3':2,'kpss-4':1,'kpss-5':2,
    'kpss-6':2,'kpss-7':3,'kpss-8':1,'kpss-9':2,'kpss-10':2
  },
  english: {
    'eng-1':1,'eng-2':1,'eng-3':0,'eng-4':0,'eng-5':1,
    'eng-6':2,'eng-7':1,'eng-8':1,'eng-9':2,'eng-10':0
  }
};

// ============================================================
// GİRİŞ NOKTALARI
// ============================================================

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : '';
    if (action === 'health') {
      return jsonResponse_({ ok: true, service: 'apps-script', ts: new Date().toISOString() });
    }
    return jsonResponse_({ ok: true, message: 'Use POST with action.' });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  var startedAt = Date.now();
  var action = '';
  var authEmail = '';

  try {
    var body = parseBody_(e);
    action = String(body.action || '').trim();
    if (!action) throw new Error('Missing action');

    validateOrigin_(String(body.origin || ''));
    var auth = verifyFirebaseToken_(body && body.auth ? body.auth.idToken : '');
    authEmail = auth.email;

    enforceRateLimit_(auth.uid, action);

    var result;
    switch (action) {
      case 'upsertUser':
        result = handleUpsertUser_(auth, body);
        break;
      case 'createRewardRequest':
        result = handleCreateRewardRequest_(auth, body);
        break;
      case 'listRewardRequests':
        result = handleListRewardRequests_(auth, body);
        break;
      case 'updateRewardStatus':
        result = handleUpdateRewardStatus_(auth, body);
        break;
      case 'submitExamResult':
        result = handleSubmitExamResult_(auth, body);
        break;
      case 'getMonthlyPoints':
        result = handleGetMonthlyPoints_(auth, body);
        break;
      case 'getLeaderboard':
        result = handleGetLeaderboard_(auth, body);
        break;
      case 'recordScore':
        result = handleRecordScore_(auth, body);
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }

    logSecurityEvent_('info', {
      action: action,
      uid: auth.uid,
      email: authEmail,
      ms: Date.now() - startedAt
    });

    return jsonResponse_(merge_({ ok: true }, result || {}));

  } catch (err) {
    logSecurityEvent_('error', {
      action: action,
      email: authEmail,
      error: String(err),
      ms: Date.now() - startedAt
    });
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

// ============================================================
// HANDLER'LAR
// ============================================================

function handleUpsertUser_(auth, body) {
  var user = body.user || {};
  var email = normalizeEmail_(user.email || auth.email);
  if (!email || email !== auth.email) throw new Error('Email mismatch');

  var name     = String(user.name || '').trim();
  var phone    = String(user.phone || '').trim();
  var verified = Boolean(user.verified);

  var sh = getSheet_(SHEET_NAMES.USERS);
  var values = sh.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < values.length; i++) {
    if (normalizeEmail_(values[i][0]) === email) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    sh.appendRow([email, name, phone, new Date().toISOString(), String(verified)]);
  } else {
    sh.getRange(rowIndex, 2, 1, 4).setValues([[
      name,
      phone,
      values[rowIndex - 1][3] || new Date().toISOString(),
      String(verified)
    ]]);
  }

  return { email: email };
}

function handleCreateRewardRequest_(auth, body) {
  var email = normalizeEmail_(body.email || auth.email);
  if (email !== auth.email) throw new Error('Email mismatch');

  var rewardType = String(body.rewardType || '').trim();
  var details    = String(body.details || '').trim();
  var requestId  = String(body.requestId || ('req_' + Date.now()));
  var month      = String(body.month || getCurrentMonth_());
  var createdAt  = String(body.createdAt || new Date().toISOString());

  if (!rewardType) throw new Error('Missing rewardType');
  if (!details)    throw new Error('Missing details');

  var availablePoints = getMonthlyPointsByEmailMonth_(email, month);
  var requestedPoints = Math.max(0, Number(body.requestedPoints || 0));
  var acceptedPoints  = Math.min(requestedPoints, availablePoints);

  if (acceptedPoints <= 0) throw new Error('Insufficient points');

  var detailsWithRid = '[RID:' + requestId + '] ' + details;
  var sh = getSheet_(SHEET_NAMES.REWARDS);
  sh.appendRow([createdAt, email, 'Bekleme', rewardType, acceptedPoints, detailsWithRid, month]);

  return {
    requestId:      requestId,
    acceptedPoints: acceptedPoints,
    month:          month
  };
}

function handleListRewardRequests_(auth, body) {
  var targetEmail = normalizeEmail_(body.email || '');
  var isAdmin     = isAdminEmail_(auth.email);

  if (targetEmail && !isAdmin && targetEmail !== auth.email) {
    throw new Error('Not allowed');
  }

  var sh     = getSheet_(SHEET_NAMES.REWARDS);
  var values = sh.getDataRange().getValues();
  var items  = [];

  for (var i = 1; i < values.length; i++) {
    var row   = values[i];
    var email = normalizeEmail_(row[1]);

    if (targetEmail && email !== targetEmail) continue;
    if (!targetEmail && !isAdmin && email !== auth.email) continue;

    var rawDetails  = String(row[5] || '');
    var rid         = extractRequestId_(rawDetails);
    var cleanDetails = rawDetails.replace(/\[RID:[^\]]+\]\s*/i, '');

    items.push({
      rowIndex:   i + 1,
      requestId:  rid,
      dateISO:    String(row[0] || ''),
      email:      email,
      status:     String(row[2] || 'Bekleme'),
      rewardType: String(row[3] || ''),
      points:     Number(row[4] || 0),
      details:    cleanDetails,
      rawDetails: rawDetails,
      month:      String(row[6] || '')
    });
  }

  items.sort(function(a, b) {
    return String(b.dateISO).localeCompare(String(a.dateISO));
  });

  return { items: items };
}

function handleUpdateRewardStatus_(auth, body) {
  requireAdmin_(auth.email);

  var rowIndex = Number(body.rowIndex || 0);
  var status   = normalizeStatus_(String(body.status || ''));

  if (!rowIndex || rowIndex < 2) throw new Error('Invalid rowIndex');
  if (!status) throw new Error('Invalid status');

  var sh      = getSheet_(SHEET_NAMES.REWARDS);
  var lastRow = sh.getLastRow();
  if (rowIndex > lastRow) throw new Error('rowIndex out of range');

  var row        = sh.getRange(rowIndex, 1, 1, 7).getValues()[0];
  var prevStatus = normalizeStatus_(String(row[2] || 'Bekleme')) || 'Bekleme';
  var email      = normalizeEmail_(row[1]);
  var points     = Number(row[4] || 0);
  var month      = String(row[6] || getCurrentMonth_());

  sh.getRange(rowIndex, 3).setValue(status);

  if (prevStatus !== 'Onayli' && status === 'Onayli') {
    adjustMonthlyPoints_(email, month, -points);
  }

  logSecurityEvent_('admin_update', {
    admin:      auth.email,
    rowIndex:   rowIndex,
    prevStatus: prevStatus,
    newStatus:  status,
    email:      email,
    points:     points,
    month:      month
  });

  return { rowIndex: rowIndex, status: status };
}

function handleSubmitExamResult_(auth, body) {
  var examId  = String(body.examId || '').trim();
  var answers = Array.isArray(body.answers) ? body.answers : [];
  var month   = String(body.month || getCurrentMonth_());

  if (!examId) throw new Error('Missing examId');

  var answerMap = ANSWER_KEYS[examId];
  if (!answerMap || typeof answerMap !== 'object') {
    throw new Error('Answer key not found for exam: ' + examId);
  }

  var total   = Object.keys(answerMap).length;
  var correct = 0;
  var wrong   = 0;

  for (var i = 0; i < answers.length; i++) {
    var item     = answers[i] || {};
    var qid      = String(item.questionId || '').trim();
    var selected = item.selectedIndex;

    if (!qid || !answerMap.hasOwnProperty(qid)) continue;
    if (selected === null || selected === undefined) continue;
    if (Number(selected) === Number(answerMap[qid])) correct++;
    else wrong++;
  }

  var blank  = total - correct - wrong;
  var net    = correct - (wrong / 3);
  var score  = Math.max(0, Math.min(100, ((net * 100) / (total || 1)) + 50));
  var awarded = score >= PASS_SCORE ? Math.round(score) : 0;

  var shScores = getSheet_(SHEET_NAMES.SCORES);
  shScores.appendRow([
    new Date().toISOString(),
    auth.email,
    examId,
    awarded,
    total,
    correct,
    wrong,
    blank,
    net.toFixed(2),
    score.toFixed(2),
    month
  ]);

  if (awarded > 0) {
    adjustMonthlyPoints_(auth.email, month, awarded);
  }

  var monthlyPoints = getMonthlyPointsByEmailMonth_(auth.email, month);

  return {
    examId:        examId,
    total:         total,
    correct:       correct,
    wrong:         wrong,
    blank:         blank,
    net:           Number(net.toFixed(2)),
    score:         Number(score.toFixed(2)),
    awardedPoints: awarded,
    monthlyPoints: monthlyPoints
  };
}

function handleGetMonthlyPoints_(auth, body) {
  var month  = String(body.month || getCurrentMonth_());
  var points = getMonthlyPointsByEmailMonth_(auth.email, month);
  return { month: month, points: points };
}

function handleGetLeaderboard_(auth, body) {
  var month = String(body.month || getCurrentMonth_());
  var shMonthly = getSheet_(SHEET_NAMES.MONTHLY);
  var monthlyValues = shMonthly.getDataRange().getValues();
  var userNames = getUserNamesMap_();

  // Aggregate points per email, summing across any duplicate rows for the same month.
  var emailPoints  = {};
  var emailUpdated = {};

  for (var i = 0; i < monthlyValues.length; i++) {
    var row = monthlyValues[i];
    if (normalizeMonth_(row[0]) !== month) continue;

    var rowEmail = normalizeEmail_(row[1]);
    if (!rowEmail) continue;

    emailPoints[rowEmail]  = (emailPoints[rowEmail]  || 0) + Number(row[2] || 0);
    var ts = String(row[3] || '');
    if (!emailUpdated[rowEmail] || ts > emailUpdated[rowEmail]) {
      emailUpdated[rowEmail] = ts;
    }
  }

  var items = [];
  for (var mapEmail in emailPoints) {
    if (!emailPoints.hasOwnProperty(mapEmail)) continue;
    items.push({
      email:     mapEmail,
      name:      userNames[mapEmail] || mapEmail,
      points:    emailPoints[mapEmail],
      updatedAt: emailUpdated[mapEmail] || ''
    });
  }

  items.sort(function(a, b) {
    if (b.points !== a.points) return b.points - a.points;
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });

  for (var j = 0; j < items.length; j++) {
    items[j].rank = j + 1;
    delete items[j].updatedAt;
  }

  return { month: month, items: items };
}

function handleRecordScore_(auth, body) {
  var points = Math.max(0, Number(body.points || 0));
  var month  = String(body.month || getCurrentMonth_());
  var examId = String(body.examId || 'legacy');

  var sh = getSheet_(SHEET_NAMES.SCORES);
  sh.appendRow([
    new Date().toISOString(),
    auth.email,
    examId,
    points, '', '', '', '', '', '', month
  ]);

  if (points > 0) adjustMonthlyPoints_(auth.email, month, points);

  return {
    awardedPoints: points,
    monthlyPoints: getMonthlyPointsByEmailMonth_(auth.email, month)
  };
}

// ============================================================
// PUAN YÖNETİMİ
// ============================================================

function getMonthlyPointsByEmailMonth_(email, month) {
  var sh     = getSheet_(SHEET_NAMES.MONTHLY);
  var values = sh.getDataRange().getValues();
  var target = normalizeEmail_(email);
  var total  = 0;

  // Start from row 0 so we don't skip row 1 when there is no header.
  // normalizeMonth_ returns '' for header text ("Ay"), which won't match, so headers are skipped safely.
  for (var i = 0; i < values.length; i++) {
    if (normalizeMonth_(values[i][0]) !== month) continue;
    if (normalizeEmail_(values[i][1]) !== target) continue;
    total += Number(values[i][2] || 0);
  }
  return total;
}

function adjustMonthlyPoints_(email, month, delta) {
  var sh          = getSheet_(SHEET_NAMES.MONTHLY);
  var values      = sh.getDataRange().getValues();
  var targetEmail = normalizeEmail_(email);
  var d           = Number(delta || 0);
  var matchRows   = [];

  // Collect ALL matching rows (duplicate rows can exist if month was previously stored as a Date).
  for (var i = 0; i < values.length; i++) {
    if (normalizeMonth_(values[i][0]) !== month) continue;
    if (normalizeEmail_(values[i][1]) !== targetEmail) continue;
    matchRows.push({ rowNum: i + 1, points: Number(values[i][2] || 0) });
  }

  if (matchRows.length === 0) {
    var start = Math.max(0, d);
    sh.appendRow([month, targetEmail, start, new Date().toISOString()]);
    return start;
  }

  // Consolidate all duplicate rows into the first one, then apply delta.
  var total = 0;
  for (var j = 0; j < matchRows.length; j++) {
    total += matchRows[j].points;
  }
  var next = Math.max(0, total + d);

  sh.getRange(matchRows[0].rowNum, 3).setValue(next);
  sh.getRange(matchRows[0].rowNum, 4).setValue(new Date().toISOString());

  // Delete duplicate rows in reverse order so earlier row indices stay valid.
  for (var k = matchRows.length - 1; k >= 1; k--) {
    sh.deleteRow(matchRows[k].rowNum);
  }

  return next;
}

// ============================================================
// GÜVENLİK
// ============================================================

function verifyFirebaseToken_(idToken) {
  if (!idToken) throw new Error('Missing idToken');

  var apiKey = getScriptProp_('FIREBASE_WEB_API_KEY');
  var url    = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey);

  var resp = UrlFetchApp.fetch(url, {
    method:           'post',
    contentType:      'application/json',
    payload:          JSON.stringify({ idToken: idToken }),
    muteHttpExceptions: true
  });

  if (resp.getResponseCode() !== 200) throw new Error('Invalid Firebase token');

  var parsed = JSON.parse(resp.getContentText());
  var user   = (parsed && parsed.users && parsed.users[0]) || null;
  if (!user) throw new Error('Token user not found');

  var email    = normalizeEmail_(user.email || '');
  var uid      = String(user.localId || '');
  var verified = (user.emailVerified === true || String(user.emailVerified) === 'true');

  if (!uid || !email) throw new Error('Token payload invalid');
  if (!verified)      throw new Error('Email not verified');

  return { uid: uid, email: email, verified: verified };
}

function enforceRateLimit_(uid, action) {
  var rules   = RATE_LIMITS[action] || { windowSec: 60, maxRequests: 30 };
  var key     = 'rl:' + uid + ':' + action;
  var cache   = CacheService.getScriptCache();
  var current = Number(cache.get(key) || '0');

  if (current >= Number(rules.maxRequests)) throw new Error('Too many requests');
  cache.put(key, String(current + 1), Number(rules.windowSec));
}

function validateOrigin_(origin) {
  var prop    = getScriptProp_('ALLOWED_ORIGINS');
  var defaults = ['https://sonsuzyasam.github.io', 'https://www.sonsuzyasam.github.io'];
  var allowed  = prop
    ? String(prop).split(',').map(function(x){ return x.trim(); }).filter(Boolean)
    : defaults;

  if (!origin || allowed.indexOf(origin) === -1) {
    throw new Error('Origin not allowed: ' + origin);
  }
}

function isAdminEmail_(email) {
  var prop = getScriptProp_('ADMIN_EMAILS');
  var list = prop
    ? String(prop).split(',').map(function(x){ return normalizeEmail_(x); }).filter(Boolean)
    : ['sdoldur@gmail.com'];

  return list.indexOf(normalizeEmail_(email)) !== -1;
}

function requireAdmin_(email) {
  if (!isAdminEmail_(email)) throw new Error('Admin required');
}

function getScriptProp_(key) {
  var val = PropertiesService.getScriptProperties().getProperty(key);
  if (!val) throw new Error(key + ' missing in Script Properties');
  return val;
}

// ============================================================
// SHEET YARDIMCILARI
// ============================================================

function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID missing in Script Properties');
  return SpreadsheetApp.openById(id);
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    addSheetHeaders_(sh, name);
  }
  return sh;
}

function addSheetHeaders_(sh, name) {
  if (name === SHEET_NAMES.USERS)   sh.appendRow(['Email','Ad','Telefon','UyeOlusTarihi','Aktif']);
  if (name === SHEET_NAMES.SCORES)  sh.appendRow(['Tarih','Email','SinavID','Puan','SoruSayisi','DogruSayisi','YanlisSayisi','BosSayisi','Net','Skor','Ay']);
  if (name === SHEET_NAMES.REWARDS) sh.appendRow(['Tarih','Email','TalepDurumu','OdulTuru','Puan','Detaylar','Ay']);
  if (name === SHEET_NAMES.MONTHLY) sh.appendRow(['Ay','Email','Puan','Guncellendi']);
  if (name === SHEET_NAMES.LOGS)    sh.appendRow(['Tarih','Tip','Payload']);
}

function logSecurityEvent_(type, payload) {
  try {
    var sh = getSheet_(SHEET_NAMES.LOGS);
    sh.appendRow([new Date().toISOString(), String(type || 'info'), JSON.stringify(payload || {})]);
  } catch (_) {}
}

// ============================================================
// YARDIMCI FONKSİYONLAR
// ============================================================

function parseBody_(e) {
  var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
  return JSON.parse(raw);
}

function extractRequestId_(details) {
  var m = String(details || '').match(/\[RID:([^\]]+)\]/i);
  return m ? String(m[1]) : '';
}

function getUserNamesMap_() {
  var sh = getSheet_(SHEET_NAMES.USERS);
  var values = sh.getDataRange().getValues();
  var map = {};

  for (var i = 1; i < values.length; i++) {
    var email = normalizeEmail_(values[i][0]);
    if (!email) continue;
    map[email] = String(values[i][1] || email).trim() || email;
  }

  return map;
}

function normalizeStatus_(s) {
  var v = String(s || '').toLowerCase();
  if (v === 'onayli' || v === 'onaylı' || v === 'approved') return 'Onayli';
  if (v === 'reddedildi' || v === 'rejected')                return 'Reddedildi';
  if (v === 'bekleme' || v === 'beklemede' || v === 'pending') return 'Bekleme';
  return '';
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function getCurrentMonth_() {
  var d  = new Date();
  var mm = ('0' + (d.getMonth() + 1)).slice(-2);
  return d.getFullYear() + '-' + mm;
}

// Normalize a month value from Sheets: handles Date objects, date strings, and "YYYY-MM" strings.
// Returns "" for non-month values (e.g., header text like "Ay"), so loops can skip them safely.
function normalizeMonth_(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date) {
    var mm = ('0' + (val.getMonth() + 1)).slice(-2);
    return val.getFullYear() + '-' + mm;
  }
  var s = String(val).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    var mm2 = ('0' + (d.getMonth() + 1)).slice(-2);
    return d.getFullYear() + '-' + mm2;
  }
  return ''; // Header text like "Ay" or unrecognized value
}

function merge_(target, source) {
  var out = {};
  var k;
  for (k in target) { if (target.hasOwnProperty(k)) out[k] = target[k]; }
  for (k in source) { if (source.hasOwnProperty(k)) out[k] = source[k]; }
  return out;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
