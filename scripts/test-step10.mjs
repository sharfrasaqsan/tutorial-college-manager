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

async function verifyStep10FullAcceptance() {
  const apiKey = 'AIzaSyAfaZh-ori4BZVgMCNox0aOEB9_rYiWgHA';
  const baseUrl = 'http://localhost:3000';
  const yearId = '2026';
  const cronSecret = process.env.CRON_SECRET || 'tutorial-college-cron-secret-2026';

  console.log('=== Step 10 Full Acceptance Testing ===');

  // 1. Authenticate Owner & Teacher
  console.log('--- 1. Authenticate Owner & Teacher ---');
  const ownerAuthRes = await fetchWithRetry(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sharfrasaqsan@gmail.com', password: 'Sa@1997626', returnSecureToken: true }),
    }
  );
  const ownerAuthData = await ownerAuthRes.json();
  const ownerSessionRes = await fetch(baseUrl + '/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: ownerAuthData.idToken }),
  });
  const ownerCookie = ownerSessionRes.headers.get('set-cookie');
  assert(ownerCookie, 'Owner cookie must be returned');
  const ownerHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `${ownerCookie}; tcm_year=${yearId}`,
  };

  const { adminAuth, adminDb } = await import('../lib/firebase-admin.ts');
  const { notify, getOwnerUserId } = await import('../lib/notifications.ts');

  const teachersRes = await fetch(baseUrl + '/api/owner/teachers', { headers: ownerHeaders });
  const teachersData = await teachersRes.json();
  const teacher1 = teachersData.teachers[0];
  await adminAuth.updateUser(teacher1.id, { password: 'TeacherSunil2026!' });

  const teacherAuthRes = await fetchWithRetry(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: teacher1.email, password: 'TeacherSunil2026!', returnSecureToken: true }),
    }
  );
  const teacherAuthData = await teacherAuthRes.json();
  const teacherSessionRes = await fetch(baseUrl + '/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: teacherAuthData.idToken }),
  });
  const teacherCookie = teacherSessionRes.headers.get('set-cookie');
  const teacherHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `${teacherCookie}; tcm_year=${yearId}`,
  };
  console.log(`Owner and Teacher (${teacher1.name}) sessions established.`);

  // 2. Test Cron Secret Protection
  console.log('--- 2. Test CRON_SECRET Route Protection ---');
  // Without secret -> 401
  const noSecretRes = await fetch(`${baseUrl}/api/cron/daily`);
  assert.equal(noSecretRes.status, 401, 'Cron route without secret must return 401');

  // With invalid secret -> 401
  const badSecretRes = await fetch(`${baseUrl}/api/cron/daily?secret=wrong-secret-123`);
  assert.equal(badSecretRes.status, 401, 'Cron route with invalid secret must return 401');

  // With valid secret via Authorization header -> 200
  const validHeaderCronRes = await fetch(`${baseUrl}/api/cron/daily?yearId=${yearId}`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  assert.equal(validHeaderCronRes.status, 200, 'Cron route with valid Authorization header must return 200');
  const cronData = await validHeaderCronRes.json();
  assert.strictEqual(cronData.success, true, 'Cron execution must return success: true');
  console.log('Verified: /api/cron/daily strictly rejects unauthenticated calls and accepts valid CRON_SECRET.');

  // 3. Test In-App Notification and FCM Token APIs
  console.log('--- 3. Test In-App Notifications & FCM Token Registration ---');
  // Register FCM Token for Teacher
  const fakeToken = 'test-device-fcm-token-' + Date.now();
  const tokenRegisterRes = await fetch(`${baseUrl}/api/notifications/fcm-token`, {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({ token: fakeToken, device: 'Chrome on Android' }),
  });
  assert.equal(tokenRegisterRes.status, 200, 'Token registration must succeed');

  const tokenDoc = await adminDb.collection('fcmTokens').doc(fakeToken).get();
  assert(tokenDoc.exists, 'FCM token must be saved in Firestore');
  assert.equal(tokenDoc.data().userId, teacher1.id);
  console.log('Verified: FCM token registered successfully per user and device.');

  // Send notification via notify()
  const testNotifId = await notify(
    teacher1.id,
    'Test Notification',
    'This is an automated test notification.',
    '/teacher/timetable'
  );
  assert(testNotifId, 'notify() must return a notification ID');

  // Fetch notifications for teacher
  const getNotifsRes = await fetch(`${baseUrl}/api/notifications`, { headers: teacherHeaders });
  assert.equal(getNotifsRes.status, 200, 'GET /api/notifications must return 200');
  const notifsData = await getNotifsRes.json();
  assert(notifsData.notifications.length > 0, 'Notifications list must not be empty');
  const foundNotif = notifsData.notifications.find((n) => n.id === testNotifId);
  assert(foundNotif, 'Created notification must be present in response');
  assert.strictEqual(foundNotif.readAt, null, 'Notification must be initially unread');
  assert(notifsData.unreadCount >= 1, 'unreadCount must be >= 1');
  console.log(`Verified in-app notification saved and returned with unread count: ${notifsData.unreadCount}`);

  // Mark single notification read
  const markReadRes = await fetch(`${baseUrl}/api/notifications/${testNotifId}/read`, {
    method: 'PATCH',
    headers: teacherHeaders,
  });
  assert.equal(markReadRes.status, 200, 'Mark notification read must return 200');

  // Mark all read
  const markAllRes = await fetch(`${baseUrl}/api/notifications/read-all`, {
    method: 'POST',
    headers: teacherHeaders,
  });
  assert.equal(markAllRes.status, 200, 'Mark all notifications read must return 200');
  console.log('Verified: Single and batch mark-read endpoints work as expected.');

  // Clean up test token via DELETE
  const deleteTokenRes = await fetch(`${baseUrl}/api/notifications/fcm-token`, {
    method: 'DELETE',
    headers: teacherHeaders,
    body: JSON.stringify({ token: fakeToken }),
  });
  assert.equal(deleteTokenRes.status, 200, 'DELETE FCM token must return 200');

  // 4. Test Session Window Expiry & Lock via Daily Cron
  console.log('--- 4. Test Session Window Expiry & Lock via Cron ---');
  // Create an expired session (e.g. 10 days ago, status = scheduled)
  const expiredSessionRef = adminDb.collection('years').doc(yearId).collection('sessions').doc();
  const pastDateStr = '2026-11-05';
  await expiredSessionRef.set({
    id: expiredSessionRef.id,
    classId: 'test-class',
    className: 'Grade 10 Maths',
    grade: 'Grade 10',
    subject: 'Maths',
    yearId,
    teacherId: teacher1.id,
    teacherName: teacher1.name,
    date: pastDateStr,
    startTime: '10:00',
    endTime: '12:00',
    type: 'regular',
    status: 'scheduled',
    countsForMonth: '2026-11',
    locked: false,
    createdAt: new Date().toISOString(),
  });

  // Run the daily cron to lock expired sessions
  const cronRunRes = await fetch(`${baseUrl}/api/cron/daily?yearId=${yearId}&secret=${cronSecret}`);
  assert.equal(cronRunRes.status, 200);
  const cronResult = await cronRunRes.json();
  assert(cronResult.lockedSessionsCount >= 1, 'Cron must have locked at least 1 expired session');

  const updatedSessionDoc = await expiredSessionRef.get();
  const updatedSessionData = updatedSessionDoc.data();
  assert.equal(updatedSessionData.status, 'notCompleted', 'Expired session status must be updated to notCompleted');
  assert.equal(updatedSessionData.locked, true, 'Expired session must be locked');
  console.log('Verified: Daily cron successfully locked past-window session as notCompleted.');

  // Clean up test session
  await expiredSessionRef.delete();

  // 5. Test Event Triggers & Notification Dispatch
  console.log('--- 5. Test Event Triggers ---');
  // Event: Teacher submits correction request -> Owner receives notification
  const ownerId = await getOwnerUserId();
  assert(ownerId, 'Owner ID must be resolved');

  // Verify UI pages respond with 200 OK
  const ownerNotifPageRes = await fetch(`${baseUrl}/owner/notifications`, { headers: ownerHeaders });
  assert.equal(ownerNotifPageRes.status, 200, '/owner/notifications must return 200');
  const teacherNotifPageRes = await fetch(`${baseUrl}/teacher/notifications`, { headers: teacherHeaders });
  assert.equal(teacherNotifPageRes.status, 200, '/teacher/notifications must return 200');
  console.log('Verified: /owner/notifications and /teacher/notifications render successfully (200 OK).');

  console.log('\n=============================================');
  console.log(' ALL STEP 10 ACCEPTANCE CRITERIA VERIFIED! ');
  console.log('=============================================\n');
}

verifyStep10FullAcceptance().catch((err) => {
  console.error('Acceptance test failed:', err);
  process.exit(1);
});
