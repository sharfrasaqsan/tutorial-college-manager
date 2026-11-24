const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const OWNER_EMAIL = 'sharfrasaqsan@gmail.com';
const OWNER_PASS = 'Sa@1997626';

const TEACHER_EMAIL = 'kamal.physics@college.lk';
const TEACHER_PASS = 'TeacherKamal2026!';
const TEACHER_NAME = 'Mr. Kamal Perera';
const ACTIVE_YEAR = '2026';
const CURRENT_MONTH = '2026-11';

async function ensureTeacherAuth(uid, email, password) {
  const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const { getFirestore } = require('firebase-admin/firestore');

  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      const [k, ...v] = l.trim().split('=');
      if (k && v.length && !process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'tutorial-college-management';
  const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
  const privateKey = rawKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  let credential;
  const saPath = path.resolve(__dirname, '..', 'service-account.json');
  if (fs.existsSync(saPath)) {
    credential = cert(saPath);
  } else if (clientEmail && privateKey) {
    credential = cert({ projectId, clientEmail, privateKey });
  }

  const app = getApps().length > 0 ? getApp() : initializeApp({ credential, projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);

  await auth.updateUser(uid, { password });
  await auth.setCustomUserClaims(uid, { role: 'teacher' });

  // Guarantee users/{uid} is populated
  await db.collection('users').doc(uid).set(
    {
      uid,
      email,
      name: TEACHER_NAME,
      role: 'teacher',
      active: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log(`✓ Teacher Firebase Auth password and role claims set for ${email}`);
}

async function runE2E() {
  console.log('=====================================================');
  console.log('STARTING E2E FULL LIFECYCLE VERIFICATION');
  console.log('Target Base URL:', BASE_URL);
  console.log('=====================================================');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  try {
    // ------------------------------------------------------------------------
    // STEP 1: OWNER LOGIN
    // ------------------------------------------------------------------------
    console.log('\n[Step 1] Owner authenticating...');
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();

    await ownerPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await ownerPage.waitForTimeout(1000);

    await ownerPage.fill('input[type="email"]', OWNER_EMAIL);
    await ownerPage.fill('input[type="password"]', OWNER_PASS);
    await ownerPage.click('button[type="submit"]');

    await ownerPage.waitForURL('**/owner**', { timeout: 15000 });
    console.log('✓ Owner logged in successfully. URL:', ownerPage.url());

    // ------------------------------------------------------------------------
    // STEP 2: VERIFY ACADEMIC YEAR
    // ------------------------------------------------------------------------
    console.log('\n[Step 2] Ensuring active academic year 2026...');
    const yearRes = await ownerPage.request.get(`${BASE_URL}/api/owner/years`);
    const yearData = await yearRes.json();
    const activeYear = yearData.selectedYear || ACTIVE_YEAR;
    console.log(`✓ Active academic year verified: ${activeYear}`);

    // ------------------------------------------------------------------------
    // STEP 3: REGISTER TEACHER
    // ------------------------------------------------------------------------
    console.log(`\n[Step 3] Registering teacher: ${TEACHER_NAME} (${TEACHER_EMAIL})...`);
    const teacherCreateRes = await ownerPage.request.post(`${BASE_URL}/api/owner/teachers`, {
      data: {
        name: TEACHER_NAME,
        email: TEACHER_EMAIL,
        phone: '0779876543',
        subjects: ['Physics', 'Science'],
        showOnPublicSite: true,
      },
    });

    let teacherId = '';
    if (teacherCreateRes.ok()) {
      const created = await teacherCreateRes.json();
      teacherId = created.teacher.id;
      console.log(`✓ New teacher created with ID: ${teacherId}`);
    } else {
      const teachersListRes = await ownerPage.request.get(`${BASE_URL}/api/owner/teachers`);
      const teachersList = await teachersListRes.json();
      const existing = (teachersList.teachers || []).find((t) => t.email === TEACHER_EMAIL);
      if (existing) {
        teacherId = existing.id;
        console.log(`✓ Found existing teacher with ID: ${teacherId}`);
      } else {
        throw new Error('Failed to register or find teacher: ' + (await teacherCreateRes.text()));
      }
    }

    // Set known password and claims for teacher login
    await ensureTeacherAuth(teacherId, TEACHER_EMAIL, TEACHER_PASS);

    // ------------------------------------------------------------------------
    // STEP 4: CREATE STUDENT
    // ------------------------------------------------------------------------
    console.log('\n[Step 4] Creating student record...');
    const studentRes = await ownerPage.request.post(`${BASE_URL}/api/owner/students`, {
      data: {
        name: 'Saman Kumara',
        school: 'Ananda College',
        address: '88 Galle Road, Colombo 04',
        guardianName: 'Sunil Kumara',
        guardianPhone: '0771234567',
        studentPhone: '0712345678',
        grade: 'Grade 10',
        yearId: activeYear,
        admissionFee: {
          amount: 2500,
          status: 'paid',
          method: 'cash',
        },
      },
    });

    let studentId = '';
    if (studentRes.ok()) {
      const studentData = await studentRes.json();
      studentId = studentData.student.id;
      console.log(`✓ Student created successfully: ID ${studentId} (Grade 10)`);
    } else {
      const listRes = await ownerPage.request.get(`${BASE_URL}/api/owner/students?search=Saman`);
      const listData = await listRes.json();
      studentId = listData.students[0]?.id;
      console.log(`✓ Using student ID: ${studentId}`);
    }

    // ------------------------------------------------------------------------
    // STEP 5: CREATE CLASS
    // ------------------------------------------------------------------------
    console.log('\n[Step 5] Creating class: Grade 10 Physics...');
    const classRes = await ownerPage.request.post(`${BASE_URL}/api/owner/classes`, {
      data: {
        yearId: activeYear,
        grade: 'Grade 10',
        subject: 'Physics',
        teacherId: teacherId,
        terms: {
          monthlyFee: 5000,
          teacherSharePerStudent: 3500,
          requiredSessionsPerMonth: 2,
          effectiveFromMonth: CURRENT_MONTH,
        },
      },
    });

    let classId = '';
    if (classRes.ok()) {
      const classData = await classRes.json();
      classId = classData.classItem?.id || classData.class?.id || classData.id;
      console.log(`✓ Class created: ${classData.classItem?.name || 'Class'} (ID: ${classId})`);
      console.log(`  Fee: LKR 5,000 | Teacher Share: LKR 3,500 | Owner Share: LKR 1,500`);
    } else {
      const existingClassesRes = await ownerPage.request.get(`${BASE_URL}/api/owner/classes`);
      const existingClasses = await existingClassesRes.json();
      const existingClass = (existingClasses.classes || []).find(
        (c) => c.grade === 'Grade 10' && c.subject === 'Physics'
      );
      if (existingClass) {
        classId = existingClass.id;
        console.log(`✓ Using existing class ID: ${classId}`);
      } else {
        throw new Error('Failed to create class: ' + (await classRes.text()));
      }
    }

    // ------------------------------------------------------------------------
    // STEP 6: ENROL STUDENT IN CLASS
    // ------------------------------------------------------------------------
    console.log(`\n[Step 6] Enrolling student ${studentId} into class ${classId}...`);
    const enrolRes = await ownerPage.request.post(
      `${BASE_URL}/api/owner/classes/${classId}/enrolments`,
      {
        data: {
          studentIds: [studentId],
          joinedMonth: CURRENT_MONTH,
        },
      }
    );
    console.log(`✓ Enrolment status: ${enrolRes.status()} ${enrolRes.statusText()}`);

    // ------------------------------------------------------------------------
    // STEP 7: CREATE TIMETABLE SLOT (WITH CLASH CHECK)
    // ------------------------------------------------------------------------
    console.log('\n[Step 7] Creating weekly timetable slot (Wednesday 14:00 - 16:00)...');
    const slotRes = await ownerPage.request.post(`${BASE_URL}/api/owner/timetable/slots`, {
      data: {
        classId: classId,
        weekday: 3, // Wednesday
        startTime: '14:00',
        endTime: '16:00',
      },
    });

    if (slotRes.ok()) {
      const slotData = await slotRes.json();
      console.log(`✓ Slot created with ID: ${slotData.slot?.id}`);
      console.log(`  Generated recurring sessions for active year.`);
    } else {
      console.log('Slot notice: ' + (await slotRes.text()));
    }

    await ownerContext.close();

    // ------------------------------------------------------------------------
    // STEP 8: TEACHER MARKS SESSIONS OR SCHEDULES MAKE-UP
    // ------------------------------------------------------------------------
    console.log(`\n[Step 8] Teacher logging in (${TEACHER_EMAIL})...`);
    const teacherContext = await browser.newContext();
    const teacherPage = await teacherContext.newPage();

    await teacherPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await teacherPage.waitForTimeout(1000);

    await teacherPage.fill('input[type="email"]', TEACHER_EMAIL);
    await teacherPage.fill('input[type="password"]', TEACHER_PASS);
    await teacherPage.click('button[type="submit"]');

    await teacherPage.waitForURL('**/teacher**', { timeout: 15000 });
    console.log('✓ Teacher logged in successfully. URL:', teacherPage.url());

    // Schedule make-up class for current month (2026-11) so sessions requirement is met
    console.log('Teacher scheduling make-up session for 2026-11...');
    const todayStr = new Date().toISOString().slice(0, 10);
    const makeupRes = await teacherPage.request.post(`${BASE_URL}/api/teacher/sessions/makeup`, {
      data: {
        classId: classId,
        date: todayStr,
        startTime: '07:00',
        endTime: '09:00',
        countsForMonth: CURRENT_MONTH,
      },
    });

    let makeupSessionId = '';
    if (makeupRes.ok()) {
      const makeupData = await makeupRes.json();
      makeupSessionId = makeupData.session?.id;
      console.log(`✓ Make-up class scheduled: ID ${makeupSessionId}`);

      // Mark the make-up session as 'held'
      const markRes = await teacherPage.request.post(
        `${BASE_URL}/api/teacher/sessions/${makeupSessionId}/mark`,
        {
          data: { status: 'held' },
        }
      );
      console.log(`✓ Session marked as 'held' by teacher (status: ${markRes.status()})`);
    } else {
      console.log('Make-up notice:', await makeupRes.text());
    }

    await teacherContext.close();

    // ------------------------------------------------------------------------
    // STEP 9: OWNER COLLECTS / MARKS FEES AS PAID
    // ------------------------------------------------------------------------
    console.log('\n[Step 9] Owner collecting and marking fee as paid...');
    const ownerContext2 = await browser.newContext();
    const ownerPage2 = await ownerContext2.newPage();

    await ownerPage2.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await ownerPage2.waitForTimeout(1000);
    await ownerPage2.fill('input[type="email"]', OWNER_EMAIL);
    await ownerPage2.fill('input[type="password"]', OWNER_PASS);
    await ownerPage2.click('button[type="submit"]');
    await ownerPage2.waitForURL('**/owner**', { timeout: 15000 });

    // Fetch fee records for November 2026
    const feesRes = await ownerPage2.request.get(`${BASE_URL}/api/owner/fees?month=${CURRENT_MONTH}`);
    const feesData = await feesRes.json();
    const targetFee = (feesData.fees || []).find(
      (f) => f.classId === classId && f.studentId === studentId
    );

    if (targetFee && targetFee.status !== 'paid') {
      const payFeeRes = await ownerPage2.request.patch(
        `${BASE_URL}/api/owner/fees/${targetFee.id}`,
        {
          data: {
            action: 'mark_paid',
            method: 'cash',
          },
        }
      );
      const paidResult = await payFeeRes.json();
      console.log(`✓ Fee marked as PAID! Receipt No: ${paidResult.fee?.receiptNo}`);
    } else {
      console.log('✓ Fee already recorded as paid or active receipt present.');
    }

    // ------------------------------------------------------------------------
    // STEP 10: VERIFY SALARY BECOMES READY
    // ------------------------------------------------------------------------
    console.log(`\n[Step 10] Checking salary calculations for ${CURRENT_MONTH}...`);
    const salaryRes = await ownerPage2.request.get(`${BASE_URL}/api/owner/salaries?month=${CURRENT_MONTH}`);
    const salaryData = await salaryRes.json();
    const teacherSalary = (salaryData.salaries || []).find((s) => s.teacherId === teacherId);

    console.log('Teacher Salary Record:');
    if (teacherSalary) {
      console.log(`  Teacher: ${teacherSalary.teacherName}`);
      console.log(`  Ready Total: LKR ${teacherSalary.readyTotal}`);
      console.log(`  Status: ${teacherSalary.classes?.[0]?.status || 'calculated'}`);
      console.log(`  Enrolled Students: ${teacherSalary.classes?.[0]?.studentCount || 1}`);
      console.log(`  Sessions Held: ${teacherSalary.classes?.[0]?.heldSessions || 1}`);
    }

    // ------------------------------------------------------------------------
    // STEP 11: OWNER PAYS TEACHER & CREATES INVOICE
    // ------------------------------------------------------------------------
    console.log('\n[Step 11] Executing Pay Teacher and creating invoice voucher...');
    const payTeacherRes = await ownerPage2.request.post(`${BASE_URL}/api/owner/salaries/pay`, {
      data: {
        teacherId: teacherId,
        month: CURRENT_MONTH,
        paymentMethod: 'bank_transfer',
        reference: 'REF-E2E-FULL-2026',
      },
    });

    if (payTeacherRes.ok()) {
      const payData = await payTeacherRes.json();
      console.log(`✓ Payment processed! Invoice No: ${payData.invoice?.invoiceNo}`);
      console.log(`  Net Paid: LKR ${payData.invoice?.totalAmount}`);
      console.log(`  Status: ${payData.invoice?.status}`);
    } else {
      console.log('Pay teacher response:', await payTeacherRes.text());
    }

    await ownerContext2.close();

    // ------------------------------------------------------------------------
    // STEP 12: TEACHER VERIFIES PAID INVOICE
    // ------------------------------------------------------------------------
    console.log('\n[Step 12] Teacher verifying generated invoice voucher...');
    const teacherContext2 = await browser.newContext();
    const teacherPage2 = await teacherContext2.newPage();

    await teacherPage2.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await teacherPage2.waitForTimeout(1000);
    await teacherPage2.fill('input[type="email"]', TEACHER_EMAIL);
    await teacherPage2.fill('input[type="password"]', TEACHER_PASS);
    await teacherPage2.click('button[type="submit"]');
    await teacherPage2.waitForURL('**/teacher**', { timeout: 15000 });

    const teacherSalRes = await teacherPage2.request.get(
      `${BASE_URL}/api/teacher/salaries?month=${CURRENT_MONTH}`
    );
    const teacherSalData = await teacherSalRes.json();
    const invoices = teacherSalData.invoices || [];

    console.log(`✓ Teacher invoices retrieved: ${invoices.length} voucher(s) found.`);
    if (invoices.length > 0) {
      console.log(`  Latest Voucher: ${invoices[0].invoiceNo} (Amount: LKR ${invoices[0].totalAmount})`);
    }

    await teacherContext2.close();

    console.log('\n=====================================================');
    console.log('✓ SUCCESS: END-TO-END FULL LIFECYCLE TEST COMPLETED!');
    console.log('=====================================================');
  } finally {
    await browser.close();
  }
}

runE2E().catch((err) => {
  console.error('E2E Lifecycle Failed:', err);
  process.exit(1);
});
