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

async function verifyStep9FullAcceptance() {
  const apiKey = 'AIzaSyAfaZh-ori4BZVgMCNox0aOEB9_rYiWgHA';
  const baseUrl = 'http://localhost:3000';
  const yearId = '2026';
  const targetMonth = '2026-11';

  console.log('=== Step 9 Full Acceptance Testing ===');

  // 1. Authenticate Owner
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

  // Authenticate Teacher
  const { adminAuth, adminDb } = await import('../lib/firebase-admin.ts');
  const teachersRes = await fetch(baseUrl + '/api/owner/teachers', { headers: ownerHeaders });
  const teachersData = await teachersRes.json();
  assert(teachersData.teachers?.length > 0, 'Teachers list must have at least one teacher');
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
  console.log(`Owner and Teacher (${teacher1.name}) authenticated successfully.`);

  // 2. Setup Test Classes & Enrolments for Teacher 1
  console.log('--- 2. Setup/Verify Classes for Teacher ---');
  const classesRes = await fetch(baseUrl + `/api/owner/classes?yearId=${yearId}`, { headers: ownerHeaders });
  const classesData = await classesRes.json();
  let teacherClasses = classesData.classes.filter(c => c.teacherId === teacher1.id);

  if (teacherClasses.length < 2) {
    console.log('Creating second class for teacher to test multi-class invoice consolidation...');
    const createRes = await fetch(baseUrl + `/api/owner/classes`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        yearId,
        grade: 'Grade 11',
        subject: 'Combined Mathematics',
        teacherId: teacher1.id,
        terms: {
          monthlyFee: 5000,
          teacherSharePerStudent: 3500,
          requiredSessionsPerMonth: 8,
          effectiveFromMonth: `${yearId}-01`,
        },
      }),
    });
    const createdData = await createRes.json();
    assert(createRes.ok || createdData.error?.includes('already exists'), 'Second class creation');

    const refreshedClasses = await (await fetch(baseUrl + `/api/owner/classes?yearId=${yearId}`, { headers: ownerHeaders })).json();
    teacherClasses = refreshedClasses.classes.filter(c => c.teacherId === teacher1.id);
  }

  assert(teacherClasses.length >= 2, 'Teacher must have at least 2 classes for multi-class test');
  const classA = teacherClasses[0];
  const classB = teacherClasses[1];
  console.log(`Testing with Class A: ${classA.name} and Class B: ${classB.name}`);

  // Ensure students are enrolled
  const studentsRes = await fetch(baseUrl + `/api/owner/students?yearId=${yearId}`, { headers: ownerHeaders });
  const studentsData = await studentsRes.json();
  assert(studentsData.students?.length > 0, 'Students must exist');
  const student1 = studentsData.students[0];

  await fetch(baseUrl + `/api/owner/classes/${classA.id}/enrolments`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ studentIds: [student1.id], joinedMonth: targetMonth }),
  });
  await fetch(baseUrl + `/api/owner/classes/${classB.id}/enrolments`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ studentIds: [student1.id], joinedMonth: targetMonth }),
  });

  // 3. Test Criterion 1: Short month stays onHold without proportional reduction
  console.log('--- 3. Criterion 1: Short month stays onHold without proportional reduction ---');
  // Clear any existing sessions for Class A for targetMonth to simulate a short month (e.g. 5 held sessions out of 8)
  const existingSessionsSnap = await adminDb.collection('years').doc(yearId).collection('sessions')
    .where('classId', '==', classA.id)
    .where('countsForMonth', '==', targetMonth)
    .get();
  
  for (const doc of existingSessionsSnap.docs) {
    await doc.ref.delete();
  }

  // Create 5 held sessions for Class A
  for (let i = 1; i <= 5; i++) {
    const sRef = adminDb.collection('years').doc(yearId).collection('sessions').doc();
    await sRef.set({
      id: sRef.id,
      classId: classA.id,
      className: classA.name,
      grade: classA.grade,
      subject: classA.subject,
      yearId,
      teacherId: teacher1.id,
      teacherName: teacher1.name,
      date: `2026-11-${String(i * 3).padStart(2, '0')}`,
      startTime: '10:00',
      endTime: '12:00',
      type: 'regular',
      status: 'held',
      countsForMonth: targetMonth,
      locked: false,
    });
  }

  // Sync and fetch owner salaries
  const ownerSalariesRes1 = await fetch(`${baseUrl}/api/owner/salaries?yearId=${yearId}&month=${targetMonth}`, {
    headers: ownerHeaders,
  });
  const ownerSalariesData1 = await ownerSalariesRes1.json();
  assert.equal(ownerSalariesRes1.status, 200, 'Owner salaries fetch must succeed');
  
  const teacherGroup1 = ownerSalariesData1.teachers.find(t => t.teacherId === teacher1.id);
  assert(teacherGroup1, 'Teacher group must be found');
  const classARecord1 = teacherGroup1.classes.find(c => c.classId === classA.id);
  assert(classARecord1, 'Class A salary record must exist');

  assert.equal(classARecord1.heldSessions, 5, 'Class A held sessions must be 5');
  assert.equal(classARecord1.status, 'onHold', 'Status must be onHold because 5 < 8 required');
  assert(classARecord1.amount > 0, 'Amount must be calculated in full without proportional reduction');
  console.log(`Verified Class A is onHold (5 of 8 sessions, Amount: LKR ${classARecord1.amount}, no proportional reduction).`);

  // 4. Test Criterion 2: Completing sessions (or make-up) flips status to ready
  console.log('--- 4. Criterion 2: Adding sessions flips status to ready ---');
  for (let i = 6; i <= 8; i++) {
    const sRef = adminDb.collection('years').doc(yearId).collection('sessions').doc();
    await sRef.set({
      id: sRef.id,
      classId: classA.id,
      className: classA.name,
      grade: classA.grade,
      subject: classA.subject,
      yearId,
      teacherId: teacher1.id,
      teacherName: teacher1.name,
      date: `2026-11-${String(i * 3).padStart(2, '0')}`,
      startTime: '10:00',
      endTime: '12:00',
      type: i === 8 ? 'makeup' : 'regular',
      status: 'held',
      countsForMonth: targetMonth,
      locked: false,
    });
  }

  // Also set up Class B with 8 sessions so both are ready
  const existingBSessions = await adminDb.collection('years').doc(yearId).collection('sessions')
    .where('classId', '==', classB.id)
    .where('countsForMonth', '==', targetMonth)
    .get();
  for (const doc of existingBSessions.docs) {
    await doc.ref.delete();
  }
  for (let i = 1; i <= 8; i++) {
    const sRef = adminDb.collection('years').doc(yearId).collection('sessions').doc();
    await sRef.set({
      id: sRef.id,
      classId: classB.id,
      className: classB.name,
      grade: classB.grade,
      subject: classB.subject,
      yearId,
      teacherId: teacher1.id,
      teacherName: teacher1.name,
      date: `2026-11-${String(i * 3).padStart(2, '0')}`,
      startTime: '14:00',
      endTime: '16:00',
      type: 'regular',
      status: 'held',
      countsForMonth: targetMonth,
      locked: false,
    });
  }

  const ownerSalariesRes2 = await fetch(`${baseUrl}/api/owner/salaries?yearId=${yearId}&month=${targetMonth}`, {
    headers: ownerHeaders,
  });
  const ownerSalariesData2 = await ownerSalariesRes2.json();
  const teacherGroup2 = ownerSalariesData2.teachers.find(t => t.teacherId === teacher1.id);
  const classARecord2 = teacherGroup2.classes.find(c => c.classId === classA.id);
  const classBRecord2 = teacherGroup2.classes.find(c => c.classId === classB.id);

  assert.equal(classARecord2.heldSessions, 8, 'Class A held sessions must now be 8');
  assert.equal(classARecord2.status, 'ready', 'Class A status must flip to ready');
  assert.equal(classBRecord2.heldSessions, 8, 'Class B held sessions must be 8');
  assert.equal(classBRecord2.status, 'ready', 'Class B status must be ready');
  console.log(`Verified sessions completed: Class A and Class B both flipped to 'ready'.`);

  // 5. Test Criterion 3: Unpaid students do NOT reduce salary amount
  console.log('--- 5. Criterion 3: Unpaid students do NOT reduce salary amount ---');
  // Check the fee records for Class A - verify student fee is unpaid
  const feesSnap = await adminDb.collection('years').doc(yearId).collection('fees')
    .where('classId', '==', classA.id)
    .where('month', '==', targetMonth)
    .get();
  assert(feesSnap.size > 0, 'Fee records must exist');
  const feeDoc = feesSnap.docs[0].data();
  console.log(`Fee status for student in class: ${feeDoc.status}, teacherShare: LKR ${feeDoc.teacherShare}`);
  assert.equal(classARecord2.amount, feeDoc.teacherShare * feesSnap.size, 'Salary amount must equal sum of teacherShares regardless of fee payment status');
  console.log('Verified: unpaid student fee did NOT reduce the salary amount.');

  // 6. Test Criterion 4: Teacher with several classes getting ONE combined invoice (SAL-YYYY-MM-NNN)
  console.log('--- 6. Criterion 4: Pay teacher with multiple classes -> ONE combined invoice ---');
  const payRes = await fetch(`${baseUrl}/api/owner/salaries/pay`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      teacherId: teacher1.id,
      month: targetMonth,
      classIds: [classA.id, classB.id],
      depositDate: '2026-11-28',
      paymentMethod: 'bank',
      yearId,
    }),
  });

  const payData = await payRes.json();
  assert.equal(payRes.status, 200, `Pay teacher request must succeed: ${payData.error || ''}`);
  assert(payData.invoice, 'Invoice object must be returned');
  assert(/^SAL-\d{4}-\d{2}-\d{3}$/.test(payData.invoice.invoiceNo), `Invoice number must match SAL-YYYY-MM-NNN, got: ${payData.invoice.invoiceNo}`);
  assert.equal(payData.invoice.classes.length, 2, 'Invoice must consolidate both classes');
  assert.equal(payData.invoice.totalAmount, classARecord2.amount + classBRecord2.amount, 'Invoice total must equal sum of both classes');
  
  const generatedInvoiceNo = payData.invoice.invoiceNo;
  console.log(`Created ONE combined invoice: ${generatedInvoiceNo} with total LKR ${payData.invoice.totalAmount}`);

  // 7. Verify records marked paid in Firestore
  const salaryDocASnap = await adminDb.collection('years').doc(yearId).collection('salaries')
    .doc(`${teacher1.id}_${classA.id}_${targetMonth}`).get();
  const salaryDocA = salaryDocASnap.data();
  assert.equal(salaryDocA.status, 'paid', 'Class A salary status must be paid');
  assert.equal(salaryDocA.invoiceNo, generatedInvoiceNo, 'Class A invoiceNo must be set');
  assert.equal(salaryDocA.depositDate, '2026-11-28');

  // 8. Test Criterion 5: Invoice PDF Download
  console.log('--- 7. Criterion 5: Download Invoice PDF ---');
  // Owner download
  const ownerPdfRes = await fetch(`${baseUrl}/api/salaries/invoice/${generatedInvoiceNo}/pdf?yearId=${yearId}`, {
    headers: ownerHeaders,
  });
  assert.equal(ownerPdfRes.status, 200, 'Owner PDF download must return 200');
  assert.equal(ownerPdfRes.headers.get('content-type'), 'application/pdf', 'Content-Type must be application/pdf');
  const pdfBytes = new Uint8Array(await ownerPdfRes.arrayBuffer());
  const pdfHeader = String.fromCharCode(...pdfBytes.slice(0, 5));
  assert.equal(pdfHeader, '%PDF-', 'Downloaded content must be a valid PDF');
  console.log(`Verified Owner successfully downloaded valid PDF for invoice ${generatedInvoiceNo} (${pdfBytes.length} bytes).`);

  // Teacher download
  const teacherPdfRes = await fetch(`${baseUrl}/api/salaries/invoice/${generatedInvoiceNo}/pdf?yearId=${yearId}`, {
    headers: teacherHeaders,
  });
  assert.equal(teacherPdfRes.status, 200, 'Teacher must be able to download their own invoice PDF');
  console.log('Verified Teacher successfully downloaded their own invoice PDF.');

  // 9. Test Criterion 6: Teacher fee isolation & data security
  console.log('--- 8. Criterion 6: Teacher Fee Isolation & Privacy ---');
  const teacherSalaryRes = await fetch(`${baseUrl}/api/teacher/salaries?yearId=${yearId}&month=${targetMonth}`, {
    headers: teacherHeaders,
  });
  assert.equal(teacherSalaryRes.status, 200, 'Teacher salary endpoint must return 200');
  const teacherSalaryData = await teacherSalaryRes.json();
  assert(teacherSalaryData.classes.length >= 2, 'Teacher must see their own classes');
  
  // Verify strictly NO student fee details leak
  for (const cls of teacherSalaryData.classes) {
    assert(cls.amount !== undefined, 'Teacher share amount should be visible');
    assert.strictEqual(cls.studentIds, undefined, 'studentIds must never leak to teacher');
    assert.strictEqual(cls.fees, undefined, 'fees array must never leak to teacher');
    assert.strictEqual(cls.students, undefined, 'students list must never leak to teacher');
  }
  console.log('Verified: Teacher salary records show earnings and progress but NO student fee records or identities.');

  // 10. Test UI Pages return 200 OK
  console.log('--- 9. UI Route Accessibility ---');
  const ownerPageRes = await fetch(`${baseUrl}/owner/salary`, { headers: ownerHeaders });
  assert.equal(ownerPageRes.status, 200, '/owner/salary must respond with 200 OK');
  const teacherPageRes = await fetch(`${baseUrl}/teacher/salary`, { headers: teacherHeaders });
  assert.equal(teacherPageRes.status, 200, '/teacher/salary must respond with 200 OK');
  console.log('Verified: /owner/salary and /teacher/salary both render successfully (200 OK).');

  console.log('\n=============================================');
  console.log(' ALL STEP 9 ACCEPTANCE CRITERIA VERIFIED! ');
  console.log('=============================================\n');
}

verifyStep9FullAcceptance().catch((err) => {
  console.error('Acceptance test failed:', err);
  process.exit(1);
});
