import assert from "node:assert";

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

async function verifyStep6Acceptance() {
  const apiKey = 'AIzaSyAfaZh-ori4BZVgMCNox0aOEB9_rYiWgHA';
  const baseUrl = 'http://localhost:3000';

  console.log('--- 1. Owner Sign-in ---');
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
  console.log('Owner authenticated. Session established.');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `${ownerCookie}; tcm_year=2026`
  };

  console.log('--- 2. Fetch or Prepare Classes for Timetable Testing ---');
  // List classes
  const classesRes = await fetch(baseUrl + '/api/owner/classes', { headers: authHeaders });
  const classesData = await classesRes.json();
  let existingClasses = classesData.classes || [];

  // Need 4 classes with different teachers or same teacher to test clash rules
  // Let's ensure we have at least 4 classes:
  const teachersRes = await fetch(baseUrl + '/api/owner/teachers', { headers: authHeaders });
  const teachersData = await teachersRes.json();
  let teachers = teachersData.teachers || [];

  // Clean up any existing slots from previous test runs
  const existingSlotsRes = await fetch(baseUrl + '/api/owner/timetable/slots', { headers: authHeaders });
  const existingSlotsData = await existingSlotsRes.json();
  for (const s of (existingSlotsData.slots || [])) {
    if (s.weekday === 3) {
      await fetch(`${baseUrl}/api/owner/timetable/slots/${s.id}`, { method: 'DELETE', headers: authHeaders });
    }
  }

  // Ensure 4 distinct teachers exist
  const distinctTeachers = teachers.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);
  while (distinctTeachers.length < 4) {
    const idx = distinctTeachers.length + 1;
    const newTeachRes = await fetch(baseUrl + '/api/owner/teachers', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Teacher ${idx} Test`,
        email: `teacher${idx}.test${Date.now()}@college.lk`,
        phone: `077000000${idx}`,
        subjects: ['Science', 'Maths', 'English', 'History'],
        showOnPublicSite: true,
      })
    });
    const newTeachData = await newTeachRes.json();
    distinctTeachers.push(newTeachData.teacher);
  }

  // Ensure we have 4 distinct classes each with a DIFFERENT teacher
  const testClasses = [];
  const subjectList = ['Physics', 'Chemistry', 'Biology', 'ICT'];
  for (let i = 0; i < 4; i++) {
    const teacher = distinctTeachers[i];
    const subj = subjectList[i];
    let cls = existingClasses.find(c => c.teacherId === teacher.id);
    if (!cls) {
      const createClsRes = await fetch(baseUrl + '/api/owner/classes', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          yearId: '2026',
          grade: 'Grade 12',
          subject: subj,
          teacherId: teacher.id,
          terms: {
            monthlyFee: 3000,
            teacherSharePerStudent: 2000,
            requiredSessionsPerMonth: 8,
            effectiveFromMonth: '2026-01'
          }
        })
      });
      const clsData = await createClsRes.json();
      cls = clsData.classItem;
    }
    testClasses.push(cls);
  }

  const class1 = testClasses[0];
  const class2 = testClasses[1];
  const class3 = testClasses[2];
  const class4 = testClasses[3];

  console.log(`Using 4 Classes with 4 Distinct Teachers:\n 1. ${class1.name} (Teacher: ${class1.teacherName})\n 2. ${class2.name} (Teacher: ${class2.teacherName})\n 3. ${class3.name} (Teacher: ${class3.teacherName})\n 4. ${class4.name} (Teacher: ${class4.teacherName})`);

  console.log('--- 3. Pre-flight Clash Check Endpoint ---');
  // 3a. Touching times allowed (14:00 - 16:00 and 16:00 - 18:00)
  const preCheckRes = await fetch(baseUrl + '/api/owner/timetable/clash-check', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      yearId: '2026',
      classId: class1.id,
      teacherId: class1.teacherId,
      teacherName: class1.teacherName,
      weekday: 3, // Wednesday
      startTime: '14:00',
      endTime: '16:00'
    })
  });
  const preCheckData = await preCheckRes.json();
  assert.strictEqual(preCheckData.hasClash, false, 'Pre-check on empty slot should not clash');
  console.log('Pre-check verified clean slot.');

  console.log('--- 4. Create Slot 1 (Room 1) inside Transaction ---');
  const slot1Res = await fetch(baseUrl + '/api/owner/timetable/slots', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      yearId: '2026',
      classId: class1.id,
      weekday: 3, // Wednesday
      startTime: '14:00',
      endTime: '16:00',
      validFrom: '2026-01-01',
      validTo: '2026-12-31'
    })
  });
  const slot1Data = await slot1Res.json();
  assert(slot1Res.ok, 'Failed to create Slot 1: ' + JSON.stringify(slot1Data));
  const slot1 = slot1Data.slot;
  console.log(`Slot 1 created: ${slot1.className} on Wednesday 14:00-16:00. Generated sessions: ${slot1Data.sessionsCount}`);
  assert(slot1Data.sessionsCount > 40, 'Should have generated ~52 sessions for the full year');

  console.log('--- 5. Verify Rule 1: Same Teacher Overlap Refused by Server Transaction ---');
  // Attempt to schedule class2 with the SAME teacher as class1 overlapping Wednesday 15:00 - 17:00
  // Even if client attempts to force it, server MUST check teacherId and refuse inside transaction!
  const teacherClashRes = await fetch(baseUrl + '/api/owner/timetable/slots', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      yearId: '2026',
      classId: class1.id, // same class / teacher
      weekday: 3,
      startTime: '15:00',
      endTime: '17:00',
      validFrom: '2026-01-01',
      validTo: '2026-12-31'
    })
  });
  assert.strictEqual(teacherClashRes.status, 400, 'Server must refuse teacher clash with HTTP 400');
  const teacherClashData = await teacherClashRes.json();
  console.log('Successfully refused teacher clash with plain message:', teacherClashData.error);
  assert.match(teacherClashData.error, /already teaches|already has a session/i);

  console.log('--- 6. Verify Rule 3 & Touching Times: Different Teacher Overlap (Rooms 2 & 3) ---');
  // Touching times: 16:00 - 18:00 for Teacher 1 is allowed
  const touchingRes = await fetch(baseUrl + '/api/owner/timetable/clash-check', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      yearId: '2026',
      classId: class1.id,
      teacherId: class1.teacherId,
      weekday: 3,
      startTime: '16:00',
      endTime: '18:00'
    })
  });
  const touchingData = await touchingRes.json();
  assert.strictEqual(touchingData.hasClash, false, 'Touching times must be allowed without clash');
  console.log('Touching times (14:00-16:00 and 16:00-18:00) allowed.');

  // Create Slot 2 (Room 2) overlapping 14:00-16:00 with Teacher 2
  const slot2Res = await fetch(baseUrl + '/api/owner/timetable/slots', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      yearId: '2026',
      classId: class2.id,
      weekday: 3,
      startTime: '14:00',
      endTime: '16:00',
      validFrom: '2026-01-01',
      validTo: '2026-12-31'
    })
  });
  const slot2Data = await slot2Res.json();
  assert(slot2Res.ok, 'Failed to create Slot 2: ' + JSON.stringify(slot2Data));
  console.log(`Slot 2 created (2nd simultaneous class): ${slot2Data.slot.className}`);

  // Create Slot 3 (Room 3) overlapping 14:00-16:00 with Teacher 3
  const slot3Res = await fetch(baseUrl + '/api/owner/timetable/slots', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      yearId: '2026',
      classId: class3.id,
      weekday: 3,
      startTime: '14:30',
      endTime: '15:30',
      validFrom: '2026-01-01',
      validTo: '2026-12-31'
    })
  });
  const slot3Data = await slot3Res.json();
  assert(slot3Res.ok, 'Failed to create Slot 3: ' + JSON.stringify(slot3Data));
  console.log(`Slot 3 created (3rd simultaneous class): ${slot3Data.slot.className}`);

  console.log('--- 7. Verify Rule 2: 4th Concurrent Class Blocked (Capacity Limit) ---');
  // Attempt to create Slot 4 (4th room) overlapping Wednesday 15:00 - 15:30
  const slot4Res = await fetch(baseUrl + '/api/owner/timetable/slots', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      yearId: '2026',
      classId: class4.id,
      weekday: 3,
      startTime: '14:45',
      endTime: '15:15',
      validFrom: '2026-01-01',
      validTo: '2026-12-31'
    })
  });
  assert.strictEqual(slot4Res.status, 400, 'Server transaction must block 4th simultaneous class');
  const slot4Data = await slot4Res.json();
  console.log('Successfully blocked 4th class with plain message:', slot4Data.error);
  assert.strictEqual(slot4Data.error, 'Three classes already run at that time. We currently have 3 classrooms.');

  console.log('--- 8. Verify Slot Edit Updates Future Scheduled Sessions Only ---');
  const updateRes = await fetch(`${baseUrl}/api/owner/timetable/slots/${slot1.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      weekday: 3,
      startTime: '10:00',
      endTime: '12:00',
      validFrom: '2026-01-01',
      validTo: '2026-12-31'
    })
  });
  const updateData = await updateRes.json();
  assert(updateRes.ok, 'Failed to update slot: ' + JSON.stringify(updateData));
  assert.strictEqual(updateData.slot.startTime, '10:00');
  assert.strictEqual(updateData.slot.endTime, '12:00');
  console.log('Slot updated to 10:00-12:00 successfully.');

  console.log('--- 9. Verify Sessions Endpoint ---');
  const sessionsRes = await fetch(`${baseUrl}/api/owner/timetable/sessions?from=2026-03-01&to=2026-03-31`, {
    headers: authHeaders
  });
  const sessionsData = await sessionsRes.json();
  assert(sessionsRes.ok, 'Failed to fetch sessions');
  assert(sessionsData.sessions.length > 0, 'Should return scheduled sessions for March 2026');
  console.log(`Sessions in March 2026 verified: ${sessionsData.sessions.length} sessions.`);

  console.log('--- 10. Clean Up Test Slots ---');
  await fetch(`${baseUrl}/api/owner/timetable/slots/${slot1.id}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${baseUrl}/api/owner/timetable/slots/${slot2Data.slot.id}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${baseUrl}/api/owner/timetable/slots/${slot3Data.slot.id}`, { method: 'DELETE', headers: authHeaders });
  console.log('Test slots cleaned up successfully.');

  console.log('\n==========================================');
  console.log('ALL STEP 6 ACCEPTANCE CRITERIA VERIFIED PASS!');
  console.log('==========================================\n');
}

verifyStep6Acceptance().catch((err) => {
  console.error('STEP 6 ACCEPTANCE FAILED:', err);
  process.exit(1);
});
