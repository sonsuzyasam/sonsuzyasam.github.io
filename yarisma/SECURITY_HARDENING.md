# Security Hardening Checklist (Today)

This project is now switched to an Apps Script-first client flow for sensitive actions. Complete the remaining server and cloud-console steps below before production launch.

## 1) Restrict Firebase and Google API keys immediately

### Firebase Web API key (browser key)
1. Open Google Cloud Console > APIs & Services > Credentials.
2. Select the Firebase browser API key.
3. Under Application restrictions choose `HTTP referrers (web sites)`.
4. Allow only:
   - `https://sonsuzyasam.github.io/*`
   - `https://www.sonsuzyasam.github.io/*` (if used)
5. Under API restrictions, allow only Firebase-related APIs needed by your app.

### Google API key rotation
1. Create a new API key.
2. Apply the same HTTP referrer restrictions.
3. Remove old key from active use.
4. Keep `SHEETS_API_KEY` empty in `yarisma/config.js`.

## 2) Enforce server-side admin verification in Apps Script

Do not trust admin checks in browser JavaScript. Verify Firebase ID token in Apps Script for every privileged action.

Use this Apps Script skeleton and adapt sheet names as needed.

```javascript
const FIREBASE_PROJECT_ID = 'yarisma-edd25';
const ADMIN_EMAILS = ['sdoldur@gmail.com'];
const ALLOWED_ORIGINS = ['https://sonsuzyasam.github.io'];

function doPost(e) {
  try {
    const body = parseBody_(e);
    validateOrigin_(body.origin);

    const auth = verifyFirebaseToken_(body.auth && body.auth.idToken);

    if (body.action === 'listRewardRequests') {
      requireAdmin_(auth.email);
      return jsonResponse_({ ok: true, items: listRewardRequests_() });
    }

    if (body.action === 'updateRewardStatus') {
      requireAdmin_(auth.email);
      enforceRateLimit_(auth.uid, 'updateRewardStatus', 60, 30);
      const out = updateRewardStatus_(body.rowIndex, body.status, auth.email);
      return jsonResponse_({ ok: true, ...out });
    }

    if (body.action === 'createRewardRequest') {
      enforceRateLimit_(auth.uid, 'createRewardRequest', 60, 10);
      const out = createRewardRequest_(auth.email, body);
      return jsonResponse_({ ok: true, ...out });
    }

    if (body.action === 'submitExamResult') {
      enforceRateLimit_(auth.uid, 'submitExamResult', 60, 20);
      const out = submitExamResult_(auth, body);
      return jsonResponse_({ ok: true, ...out });
    }

    if (body.action === 'getMonthlyPoints') {
      const points = getMonthlyPoints_(auth.email, body.month);
      return jsonResponse_({ ok: true, points: points });
    }

    return jsonResponse_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    logSecurityEvent_('error', { message: String(err) });
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function parseBody_(e) {
  const raw = (e && e.postData && e.postData.contents) || '{}';
  return JSON.parse(raw);
}

function validateOrigin_(origin) {
  if (!origin || ALLOWED_ORIGINS.indexOf(origin) === -1) {
    throw new Error('Origin not allowed');
  }
}

function requireAdmin_(email) {
  const ok = ADMIN_EMAILS.indexOf(String(email || '').toLowerCase()) !== -1;
  if (!ok) throw new Error('Admin required');
}

function verifyFirebaseToken_(idToken) {
  if (!idToken) throw new Error('Missing idToken');

  const url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + getFirebaseWebApiKey_();
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ idToken: idToken }),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code !== 200) throw new Error('Invalid Firebase token');

  const data = JSON.parse(res.getContentText());
  const user = (data.users && data.users[0]) || null;
  if (!user) throw new Error('Token user not found');

  const email = String(user.email || '').toLowerCase();
  const uid = user.localId || '';
  const verified = user.emailVerified === true || user.emailVerified === 'true';

  if (!verified) throw new Error('Email not verified');
  return { uid: uid, email: email, verified: verified };
}

function getFirebaseWebApiKey_() {
  const v = PropertiesService.getScriptProperties().getProperty('FIREBASE_WEB_API_KEY');
  if (!v) throw new Error('FIREBASE_WEB_API_KEY missing in Script Properties');
  return v;
}

function enforceRateLimit_(uid, action, windowSec, maxRequests) {
  const cache = CacheService.getScriptCache();
  const key = 'rl:' + uid + ':' + action;
  const current = Number(cache.get(key) || '0');
  if (current >= maxRequests) throw new Error('Too many requests');
  cache.put(key, String(current + 1), windowSec);
}

function submitExamResult_(auth, body) {
  // Server-side scoring must be computed from trusted answer keys in Apps Script,
  // not from client-provided score/points.
  const examId = String(body.examId || '');
  const answers = Array.isArray(body.answers) ? body.answers : [];

  const answerKey = getAnswerKey_(examId); // {questionId: correctIndex}
  let correct = 0;
  let wrong = 0;

  answers.forEach(function(a) {
    const qid = String(a.questionId || '');
    const selected = a.selectedIndex;
    if (selected === null || selected === undefined || qid === '') return;
    if (!answerKey.hasOwnProperty(qid)) return;
    if (Number(selected) === Number(answerKey[qid])) correct += 1;
    else wrong += 1;
  });

  const total = Object.keys(answerKey).length || 1;
  const net = correct - (wrong / 3);
  const score = Math.max(0, Math.min(100, ((net * 100) / total) + 50));
  const passScore = 45;
  const awardedPoints = score >= passScore ? Math.round(score) : 0;

  appendScoreRow_(auth.email, examId, awardedPoints, correct, wrong, body.month);
  const monthlyPoints = getMonthlyPoints_(auth.email, body.month);

  return { awardedPoints: awardedPoints, monthlyPoints: monthlyPoints };
}

function getAnswerKey_(examId) {
  // Move your trusted answer keys here (or read from a protected sheet).
  // Example:
  // return { 'tyt-1': 2, 'tyt-2': 2 };
  throw new Error('Answer key not configured for exam: ' + examId);
}

function appendScoreRow_(email, examId, points, correct, wrong, month) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Puanlar');
  sh.appendRow([new Date().toISOString(), email, examId, points, correct, wrong, month]);
}

function getMonthlyPoints_(email, month) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Puanlar');
  const vals = sh.getDataRange().getValues();
  let total = 0;

  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][1]).toLowerCase() !== String(email).toLowerCase()) continue;
    if (String(vals[i][6] || '') !== String(month || '')) continue;
    total += Number(vals[i][3] || 0);
  }

  return total;
}

function logSecurityEvent_(type, payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('SecurityLogs');
  if (!sh) {
    sh = ss.insertSheet('SecurityLogs');
    sh.appendRow(['time', 'type', 'payload']);
  }
  sh.appendRow([new Date().toISOString(), type, JSON.stringify(payload)]);
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 3) Move scoring authority to server

Already changed in frontend: quiz now sends answer payload to server and expects `awardedPoints` from Apps Script. Client no longer writes points directly.

Required backend action:
1. Implement `submitExamResult` in Apps Script.
2. Keep trusted answer keys on server side.
3. Return `awardedPoints` and `monthlyPoints`.

## 4) Add abuse controls now

1. Add rate limits by UID + action in Apps Script (`CacheService`).
2. Add `SecurityLogs` sheet and record denied/admin/update attempts.
3. Restrict by `origin` allowlist.

## 5) Deploy checklist

1. Update Apps Script code.
2. Set Script Property: `FIREBASE_WEB_API_KEY`.
3. Deploy as new Web App version.
4. Verify actions:
   - `listRewardRequests` works only for admin users.
   - `updateRewardStatus` fails for non-admin users.
   - `submitExamResult` returns numeric `awardedPoints`.
   - `getMonthlyPoints` returns server total.

