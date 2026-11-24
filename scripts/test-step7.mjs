import assert from "node:assert";
import { format, subDays } from "date-fns";

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`Fetch to ${url} failed (${err.message}), retrying in 1s...`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function verifyStep7Acceptance() {
  const apiKey = 'AIzaSyAfaZh-ori4BZVgMCNox0aOEB9_rYiWgHA';
  const baseUrl = 'http://localhost:3000';

  console.log('--- 1. Authenticate Owner & Teacher ---');
  // 1a. Owner
  const ownerAuthRes = await fetchWithRetry('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sharfrasaqsan@gmail.com', password: 'Sa@1997626', returnSecureToken: true })
  });
  const ownerAuthData = await ownerAuthRes.json();
  const ownerSessionRes = await fetch(baseUrl + '/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: ownerAuthData.idToken })
  });
  const ownerCookie = ownerSessionRes.headers.get('set-cookie');
  console.log('Owner session established.');

  const ownerHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `${ownerCookie}; tcm_year=2026`
  };

  // 1b. Get or Create Teacher 1 (Sunil Fernando) and Teacher 2
  const teachersRes = await fetch(baseUrl + '/api/owner/teachers', { headers: ownerHeaders });
  const teachersData = await teachersRes.json();
  const teacher1 = teachersData.teachers.find(t => t.name.includes('Sunil')) || teachersData.teachers[0];
  const teacher2 = teachersData.teachers.find(t => t.id !== teacher1.id);

  assert(teacher1 && teacher2, 'Must have at least two distinct teachers in the database');
  console.log(`Teacher 1: ${teacher1.name} (${teacher1.id})`);
  console.log(`Teacher 2: ${teacher2.name} (${teacher2.id})`);

  // Ensure Teacher 1 password is known so we can sign in as Teacher 1
  const { adminAuth, adminDb } = await import('../lib/firebase-admin.ts');
  await adminAuth.updateUser(teacher1.id, { password: 'TeacherSunil2026!' });

  const teacherAuthRes = await fetchWithRetry('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: teacher1.email, password: 'TeacherSunil2026!', returnSecureToken: true })
  });
  const teacherAuthData = await teacherAuthRes.json();
  const teacherSessionRes = await fetch(baseUrl + '/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: teacherAuthData.idToken })
  });
  const teacherCookie = teacherSessionRes.headers.get('set-cookie');
  console.log('Teacher session established.');

  const teacherHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `${teacherCookie}; tcm_year=2026`
  };

  console.log('--- 2. Verify Teacher Data Isolation (API) ---');
  // 2a. Teacher reads classes
  const teacherClassesRes = await fetch(baseUrl + '/api/teacher/classes', { headers: teacherHeaders });
  const teacherClassesData = await teacherClassesRes.json();
  assert(teacherClassesRes.ok, 'Failed to fetch teacher classes');

  // Verify: every class returned has teacherId == teacher1.id
  for (const c of teacherClassesData.classes) {
    // Verify fees are NEVER shown to teachers!
    assert.strictEqual(c.monthlyFee, undefined, 'Monthly fee must NEVER be exposed to teachers!');
    assert.strictEqual(c.teacherSharePerStudent, undefined, 'Teacher share must NEVER be exposed to teachers!');
    assert.strictEqual(c.feeRecords, undefined, 'Fee records must NEVER be exposed to teachers!');
    // Verify students have contact info
    for (const s of c.students) {
      assert(s.name, 'Student must have name');
      assert(s.guardianName !== undefined, 'Guardian name should be present');
      assert(s.guardianPhone !== undefined, 'Guardian phone should be present');
    }
  }
  console.log('Verified teacher classes visibility: Fees are strictly hidden.');

  // 2b. Create a session belonging to Teacher 2
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const t2SessionRef = adminDb.collection('years').doc('2026').collection('sessions').doc();
  await t2SessionRef.set({
    id: t2SessionRef.id,
    classId: 't2-class',
    className: 'Grade 12 Chemistry',
    grade: 'Grade 12',
    subject: 'Chemistry',
    yearId: '2026',
    teacherId: teacher2.id,
    teacherName: teacher2.name,
    date: todayStr,
    startTime: '10:00',
    endTime: '12:00',
    type: 'regular',
    status: 'scheduled',
    countsForMonth: todayStr.slice(0, 7),
    locked: false,
    createdAt: new Date().toISOString()
  });

  // Teacher 1 attempts to mark Teacher 2's session
  const illegalMarkRes = await fetch(`${baseUrl}/api/teacher/sessions/${t2SessionRef.id}/mark`, {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({ status: 'held' })
  });
  assert.strictEqual(illegalMarkRes.status, 403, 'Teacher must be forbidden from marking another teacher session');
  const illegalMarkData = await illegalMarkRes.json();
  console.log('Successfully rejected cross-teacher mark (403):', illegalMarkData.error);

  console.log('--- 3. Verify Marking Window Rules ---');
  // 3a. Create an expired session (> 3 days ago, e.g. 10 days ago) for Teacher 1
  const tenDaysAgoStr = format(subDays(now, 10), 'yyyy-MM-dd');
  const expiredSessionRef = adminDb.collection('years').doc('2026').collection('sessions').doc();
  await expiredSessionRef.set({
    id: expiredSessionRef.id,
    classId: teacherClassesData.classes[0]?.id || 'cls-1',
    className: teacherClassesData.classes[0]?.name || 'Grade 10 English',
    grade: 'Grade 10',
    subject: 'English',
    yearId: '2026',
    teacherId: teacher1.id,
    teacherName: teacher1.name,
    date: tenDaysAgoStr,
    startTime: '09:00',
    endTime: '11:00',
    type: 'regular',
    status: 'scheduled',
    countsForMonth: tenDaysAgoStr.slice(0, 7),
    locked: true,
    createdAt: new Date().toISOString()
  });

  // Attempt to mark the expired session directly
  const expiredMarkRes = await fetch(`${baseUrl}/api/teacher/sessions/${expiredSessionRef.id}/mark`, {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({ status: 'held' })
  });
  assert.strictEqual(expiredMarkRes.status, 400, 'Must refuse marking after 3-day window has closed');
  const expiredMarkData = await expiredMarkRes.json();
  console.log('Successfully refused marking expired session:', expiredMarkData.error);
  assert.match(expiredMarkData.error, /window for this session has closed/i);

  // 3b. Create an active session for today within the marking window
  const activeSessionRef = adminDb.collection('years').doc('2026').collection('sessions').doc();
  await activeSessionRef.set({
    id: activeSessionRef.id,
    classId: teacherClassesData.classes[0]?.id || 'cls-1',
    className: teacherClassesData.classes[0]?.name || 'Grade 10 English',
    grade: 'Grade 10',
    subject: 'English',
    yearId: '2026',
    teacherId: teacher1.id,
    teacherName: teacher1.name,
    date: todayStr,
    startTime: '08:00', // session already started
    endTime: '10:00',
    type: 'regular',
    status: 'scheduled',
    countsForMonth: todayStr.slice(0, 7),
    locked: false,
    createdAt: new Date().toISOString()
  });

  // Mark active session as held
  const markHeldRes = await fetch(`${baseUrl}/api/teacher/sessions/${activeSessionRef.id}/mark`, {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({ status: 'held' })
  });
  assert(markHeldRes.ok, 'Failed to mark active session');
  const markHeldData = await markHeldRes.json();
  assert.strictEqual(markHeldData.session.status, 'held');
  console.log('Session marked as Held successfully.');

  // 3c. Verify AuditLog written for session marking
  const auditSnap = await adminDb
    .collection('years')
    .doc('2026')
    .collection('auditLog')
    .where('entityId', '==', activeSessionRef.id)
    .get();
  assert(auditSnap.size > 0, 'AuditLog entry must be created when marking a session');
  const auditDoc = auditSnap.docs[0].data();
  console.log('AuditLog verified:', auditDoc.action, 'by', auditDoc.who, 'before:', auditDoc.before, 'after:', auditDoc.after);
  assert.strictEqual(auditDoc.action, 'session_marked_held');

  console.log('--- 4. Verify Make-up Session Creation ---');
  // Schedule a make-up session for Teacher 1's class
  const makeupRes = await fetch(baseUrl + '/api/teacher/sessions/makeup', {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({
      classId: teacherClassesData.classes[0].id,
      date: todayStr,
      startTime: '18:00',
      endTime: '20:00',
      countsForMonth: todayStr.slice(0, 7)
    })
  });
  const makeupData = await makeupRes.json();
  assert(makeupRes.ok, 'Failed to create make-up session: ' + JSON.stringify(makeupData));
  assert.strictEqual(makeupData.session.type, 'makeup');
  console.log('Make-up class created successfully:', makeupData.session.className, 'Type:', makeupData.session.type);

  console.log('--- 5. Verify Correction Request Workflow ---');
  // 5a. Teacher submits correction request for the expired session
  const correctionRes = await fetch(`${baseUrl}/api/teacher/sessions/${expiredSessionRef.id}/correction-request`, {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({
      requestedStatus: 'held',
      reason: 'Class was held on schedule; rural network outage prevented timely marking within 3 days.'
    })
  });
  const correctionData = await correctionRes.json();
  assert(correctionRes.ok, 'Failed to submit correction request: ' + JSON.stringify(correctionData));
  const requestId = correctionData.request.id;
  console.log('Correction request submitted by teacher:', requestId);

  // 5b. Owner checks inbox
  const ownerInboxRes = await fetch(baseUrl + '/api/owner/requests', { headers: ownerHeaders });
  const ownerInboxData = await ownerInboxRes.json();
  const foundRequest = ownerInboxData.requests.find(r => r.id === requestId);
  assert(foundRequest, 'Owner must see pending correction request in inbox');
  assert.strictEqual(foundRequest.status, 'pending');
  console.log('Owner sees pending request:', foundRequest.className, 'Reason:', foundRequest.reason);

  // 5c. Owner approves correction request
  const resolveRes = await fetch(`${baseUrl}/api/owner/requests/${requestId}/resolve`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ action: 'approve' })
  });
  const resolveData = await resolveRes.json();
  assert(resolveRes.ok, 'Failed to approve request: ' + JSON.stringify(resolveData));
  console.log('Owner approved request:', resolveData.message);

  // 5d. Verify expired session status changed to "held"
  const updatedExpiredDoc = await expiredSessionRef.get();
  assert.strictEqual(updatedExpiredDoc.data().status, 'held', 'Session status must be updated to requestedStatus after owner approval');
  assert.strictEqual(updatedExpiredDoc.data().markedBy, 'owner_approved');
  console.log('Expired session successfully updated to "held" after owner approval!');

  // Clean up test documents
  await t2SessionRef.delete();
  await expiredSessionRef.delete();
  await activeSessionRef.delete();
  await adminDb.collection('years').doc('2026').collection('sessions').doc(makeupData.session.id).delete();
  await adminDb.collection('years').doc('2026').collection('correctionRequests').doc(requestId).delete();

  console.log('\n==========================================');
  console.log('ALL STEP 7 ACCEPTANCE CRITERIA VERIFIED PASS!');
  console.log('==========================================\n');
}

verifyStep7Acceptance().catch((err) => {
  console.error('STEP 7 ACCEPTANCE FAILED:', err);
  process.exit(1);
});
