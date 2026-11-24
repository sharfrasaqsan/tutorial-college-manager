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

async function verifyStep4Acceptance() {
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

  console.log('--- 2. Create Teacher ---');
  const createTeacherRes = await fetch(baseUrl + '/api/owner/teachers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': ownerCookie },
    body: JSON.stringify({
      name: 'Mr. Sunil Fernando',
      email: 'sunil.fernando@college.lk',
      phone: '0771234567',
      subjects: ['Combined Maths', 'Physics'],
      showOnPublicSite: true,
      bio: 'Senior Mathematics teacher with 12 years of tutorial college experience.'
    })
  });
  const teacherCreated = await createTeacherRes.json();
  if (!createTeacherRes.ok) throw new Error('Create teacher failed: ' + JSON.stringify(teacherCreated));
  console.log('Teacher created:', teacherCreated.teacher.name, 'UID:', teacherCreated.teacher.id);
  console.log('Setup link generated:', Boolean(teacherCreated.resetLink));

  const teacherId = teacherCreated.teacher.id;

  console.log('--- 3. Teacher Login Verification ---');
  // Set password for the teacher to verify login
  const { adminAuth } = await import('../lib/firebase-admin.ts');
  await adminAuth.updateUser(teacherId, { password: 'TeacherSunil2026!' });

  const teacherAuthRes = await fetchWithRetry('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sunil.fernando@college.lk', password: 'TeacherSunil2026!', returnSecureToken: true })
  });
  const teacherAuthData = await teacherAuthRes.json();
  if (!teacherAuthData.idToken) throw new Error('Teacher auth failed: ' + JSON.stringify(teacherAuthData));

  const teacherSessionRes = await fetch(baseUrl + '/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: teacherAuthData.idToken })
  });
  const teacherSessionData = await teacherSessionRes.json();
  const teacherCookie = teacherSessionRes.headers.get('set-cookie');
  console.log('Teacher session role:', teacherSessionData.role);
  if (teacherSessionData.role !== 'teacher') throw new Error('Expected role teacher!');

  // Verify teacher CANNOT access owner routes
  const teacherForbiddenRes = await fetch(baseUrl + '/api/owner/teachers', {
    headers: { 'Cookie': teacherCookie }
  });
  console.log('Teacher access to /api/owner/teachers status (must be 403):', teacherForbiddenRes.status);
  if (teacherForbiddenRes.status !== 403) throw new Error('Expected 403 for teacher accessing owner API!');

  console.log('--- 4. Teacher Deactivation & Reactivation ---');
  const deactRes = await fetch(baseUrl + '/api/owner/teachers/' + teacherId + '/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': ownerCookie },
    body: JSON.stringify({ active: false })
  });
  console.log('Deactivate teacher response:', await deactRes.json());

  // Attempt login with disabled teacher
  const disabledLoginRes = await fetchWithRetry('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sunil.fernando@college.lk', password: 'TeacherSunil2026!', returnSecureToken: true })
  });
  const disabledLoginData = await disabledLoginRes.json();
  console.log('Disabled teacher login error:', disabledLoginData.error?.message);
  if (disabledLoginData.error?.message !== 'USER_DISABLED') {
    throw new Error('Expected USER_DISABLED error when logging in as deactivated teacher!');
  }

  // Reactivate teacher
  await fetch(baseUrl + '/api/owner/teachers/' + teacherId + '/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': ownerCookie },
    body: JSON.stringify({ active: true })
  });
  console.log('Teacher reactivated successfully.');

  console.log('--- 5. Create Student ---');
  const createStudentRes = await fetch(baseUrl + '/api/owner/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': ownerCookie },
    body: JSON.stringify({
      name: 'Nimal Perera',
      school: 'Royal College Colombo',
      address: '14/2 Flower Road, Colombo 07',
      guardianName: 'Lalith Perera',
      guardianPhone: '0712345678',
      studentPhone: '0761112233',
      grade: 'Grade 11',
      yearId: '2026',
      admissionFee: {
        amount: 2500,
        status: 'unpaid'
      }
    })
  });
  const studentCreated = await createStudentRes.json();
  if (!createStudentRes.ok) throw new Error('Create student failed: ' + JSON.stringify(studentCreated));
  const studentId = studentCreated.student.id;
  const originalJoinedAt = studentCreated.student.joinedAt;
  console.log('Student created:', studentCreated.student.name, 'ID:', studentId);
  console.log('Original joinedAt:', originalJoinedAt);
  if (!originalJoinedAt) throw new Error('Student missing joinedAt timestamp!');

  console.log('--- 6. Test Crafted Attack on joinedAt ---');
  // Attempt to maliciously modify joinedAt to 1985-05-05
  const maliciousJoinedAt = '1985-05-05T00:00:00.000Z';
  const updateRes = await fetch(baseUrl + '/api/owner/students/' + studentId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': ownerCookie },
    body: JSON.stringify({
      name: 'Nimal Perera (Updated)',
      school: 'Royal College Colombo',
      address: '14/2 Flower Road, Colombo 07',
      guardianName: 'Lalith Perera',
      guardianPhone: '0712345678',
      grade: 'Grade 11',
      yearId: '2026',
      admissionFee: {
        amount: 2500,
        status: 'paid',
        method: 'cash',
        paidDate: '2026-01-20',
        receiptNo: 'REC-001'
      },
      joinedAt: maliciousJoinedAt // Attacker tries to rewrite joinedAt
    })
  });
  const updateData = await updateRes.json();
  console.log('Updated student response joinedAt:', updateData.student.joinedAt);

  // Read back directly from Firestore database
  const { adminDb } = await import('../lib/firebase-admin.ts');
  const storedDoc = await adminDb.collection('students').doc(studentId).get();
  const storedJoinedAt = storedDoc.data().joinedAt;
  console.log('Firestore stored joinedAt:', storedJoinedAt);

  if (storedJoinedAt === maliciousJoinedAt) {
    throw new Error('SECURITY VIOLATION: joinedAt was altered by client request!');
  }
  if (storedJoinedAt !== originalJoinedAt) {
    throw new Error('joinedAt did not strictly preserve original timestamp!');
  }
  console.log('SUCCESS: joinedAt was strictly preserved and forged timestamp was rejected.');

  console.log('--- 7. Student Detail Page API ---');
  const detailRes = await fetch(baseUrl + '/api/owner/students/' + studentId, {
    headers: { 'Cookie': ownerCookie }
  });
  const detailData = await detailRes.json();
  console.log('Student detail name:', detailData.student.name, 'Grade:', detailData.gradeForYear);
  console.log('Enrolled classes array exists:', Array.isArray(detailData.enrolledClasses));
  console.log('Fee history placeholder array exists:', Array.isArray(detailData.feeHistoryPlaceholder));

  console.log('--- 8. Search & Grade Filter API ---');
  const searchRes = await fetch(baseUrl + '/api/owner/students?search=nimal&grade=Grade%2011', {
    headers: { 'Cookie': ownerCookie }
  });
  const searchData = await searchRes.json();
  console.log('Filtered students found count:', searchData.students.length);
  if (searchData.students.length !== 1 || searchData.students[0].id !== studentId) {
    throw new Error('Search and filter failed to match the created student!');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL STEP 4 ACCEPTANCE CRITERIA VERIFIED AND PASSED!');
  console.log('======================================================\n');
  process.exit(0);
}

verifyStep4Acceptance().catch(err => {
  console.error('ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
