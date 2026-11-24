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

async function verifyStep11FullAcceptance() {
  const apiKey = 'AIzaSyAfaZh-ori4BZVgMCNox0aOEB9_rYiWgHA';
  const baseUrl = 'http://localhost:3000';
  const yearId = '2026';
  const targetMonth = '2026-11';

  console.log('=== Step 11 Full Acceptance Testing: Reports & Statements ===');

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

  const { adminAuth } = await import('../lib/firebase-admin.ts');
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
  console.log('Owner and Teacher sessions established.');

  // 2. Strict Access Control (Owner Only)
  console.log('--- 2. Test Strict Access Control ---');
  const teacherDataAttempt = await fetch(`${baseUrl}/api/owner/reports/data?yearId=${yearId}&month=${targetMonth}`, {
    headers: teacherHeaders,
  });
  assert.equal(teacherDataAttempt.status, 403, 'Teacher must receive 403 for /api/owner/reports/data');

  const teacherPdfAttempt = await fetch(`${baseUrl}/api/owner/reports/pdf?yearId=${yearId}&month=${targetMonth}`, {
    headers: teacherHeaders,
  });
  assert.equal(teacherPdfAttempt.status, 403, 'Teacher must receive 403 for /api/owner/reports/pdf');
  console.log('Verified: Non-owners are strictly blocked with 403 Forbidden.');

  // 3. Fetch Official Baseline Screens Data (Fees & Salary)
  console.log('--- 3. Fetch Baseline Data from Fees and Salary Screens ---');
  const feesRes = await fetch(`${baseUrl}/api/owner/fees?yearId=${yearId}&month=${targetMonth}`, {
    headers: ownerHeaders,
  });
  assert.equal(feesRes.status, 200);
  const feesData = await feesRes.json();
  const feeSummary = feesData.summary;
  console.log(`Fees Screen Baseline: Collected = LKR ${feeSummary.totalCollected}, Unpaid = LKR ${feeSummary.totalUnpaid}`);

  const salaryRes = await fetch(`${baseUrl}/api/owner/salaries?yearId=${yearId}&month=${targetMonth}`, {
    headers: ownerHeaders,
  });
  assert.equal(salaryRes.status, 200);
  const salaryData = await salaryRes.json();
  const salaryReadyTotal = salaryData.teachers.reduce((sum, t) => sum + t.totalReadyAmount, 0);
  const salaryPaidTotal = salaryData.teachers.reduce((sum, t) => sum + t.totalPaidAmount, 0);
  const salaryOnHoldTotal = salaryData.teachers.reduce((sum, t) => sum + t.totalOnHoldAmount, 0);
  const salaryGrandTotal = salaryData.teachers.reduce((sum, t) => sum + t.totalAmount, 0);
  console.log(`Salary Screen Baseline: Ready = LKR ${salaryReadyTotal}, Paid = LKR ${salaryPaidTotal}, OnHold = LKR ${salaryOnHoldTotal}, Total = LKR ${salaryGrandTotal}`);

  // 4. Verify Report 1: Student Payments
  console.log('--- 4. Verify Report 1: Student Payments ---');
  const paymentsReportRes = await fetch(`${baseUrl}/api/owner/reports/data?type=student-payments&yearId=${yearId}&month=${targetMonth}`, {
    headers: ownerHeaders,
  });
  assert.equal(paymentsReportRes.status, 200);
  const paymentsReport = (await paymentsReportRes.json()).data;

  // Acceptance Criterion: Report totals equal totals shown on Fees screen
  assert.equal(
    paymentsReport.totalCollected,
    feeSummary.totalCollected,
    `Student payments totalCollected (${paymentsReport.totalCollected}) must exactly equal Fees screen totalCollected (${feeSummary.totalCollected})`
  );
  assert.equal(
    paymentsReport.totalPaidCount,
    feeSummary.paidCount,
    `Student payments totalPaidCount must equal Fees screen paidCount`
  );
  console.log(`Verified Student Payments Report: Total Collected = LKR ${paymentsReport.totalCollected} across ${paymentsReport.totalPaidCount} students.`);

  // 5. Verify Report 2: Pending Fees
  console.log('--- 5. Verify Report 2: Pending Fees ---');
  const pendingReportRes = await fetch(`${baseUrl}/api/owner/reports/data?type=pending-fees&yearId=${yearId}&month=${targetMonth}`, {
    headers: ownerHeaders,
  });
  assert.equal(pendingReportRes.status, 200);
  const pendingReport = (await pendingReportRes.json()).data;

  // Acceptance Criterion: Report tuition pending equals Fees screen totalUnpaid
  assert.equal(
    pendingReport.totalTuitionUnpaid,
    feeSummary.totalUnpaid,
    `Pending fees totalTuitionUnpaid (${pendingReport.totalTuitionUnpaid}) must equal Fees screen totalUnpaid (${feeSummary.totalUnpaid})`
  );
  console.log(`Verified Pending Fees Report: Tuition Pending = LKR ${pendingReport.totalTuitionUnpaid}, Grand Total with Admission = LKR ${pendingReport.grandTotalPending}.`);

  // Verify guardian phone present for each student
  for (const s of pendingReport.students) {
    assert(s.guardianPhone, 'Guardian phone must be present for student contact');
  }

  // 6. Verify Report 3: Teacher Salary
  console.log('--- 6. Verify Report 3: Teacher Salary ---');
  const teacherSalaryReportRes = await fetch(`${baseUrl}/api/owner/reports/data?type=teacher-salary&yearId=${yearId}&month=${targetMonth}`, {
    headers: ownerHeaders,
  });
  assert.equal(teacherSalaryReportRes.status, 200);
  const teacherSalaryReport = (await teacherSalaryReportRes.json()).data;

  // Acceptance Criterion: Report salary totals equal Salary screen totals
  assert.equal(
    teacherSalaryReport.totalReadyAmount,
    salaryReadyTotal,
    'Salary report totalReadyAmount must equal Salary screen ready total'
  );
  assert.equal(
    teacherSalaryReport.totalPaidAmount,
    salaryPaidTotal,
    'Salary report totalPaidAmount must equal Salary screen paid total'
  );
  assert.equal(
    teacherSalaryReport.totalOnHoldAmount,
    salaryOnHoldTotal,
    'Salary report totalOnHoldAmount must equal Salary screen on-hold total'
  );
  assert.equal(
    teacherSalaryReport.grandTotalSalary,
    salaryGrandTotal,
    'Salary report grandTotalSalary must equal Salary screen total'
  );
  console.log(`Verified Teacher Salary Report: Grand Total = LKR ${teacherSalaryReport.grandTotalSalary} (Paid: LKR ${teacherSalaryReport.totalPaidAmount}, Ready: LKR ${teacherSalaryReport.totalReadyAmount}, OnHold: LKR ${teacherSalaryReport.totalOnHoldAmount}).`);

  // 7. Verify Report 4: Month Summary
  console.log('--- 7. Verify Report 4: Month Summary ---');
  const monthSummaryRes = await fetch(`${baseUrl}/api/owner/reports/data?type=month-summary&yearId=${yearId}&month=${targetMonth}`, {
    headers: ownerHeaders,
  });
  assert.equal(monthSummaryRes.status, 200);
  const monthSummary = (await monthSummaryRes.json()).data;

  // Acceptance Criterion: Month summary financials match Fees & Salary screens
  assert.equal(monthSummary.financials.totalCollected, feeSummary.totalCollected);
  assert.equal(monthSummary.financials.totalUnpaid, feeSummary.totalUnpaid);
  assert.equal(monthSummary.financials.totalSalaryPaid, salaryPaidTotal);
  assert.equal(monthSummary.financials.totalSalaryReady, salaryReadyTotal);

  // Owner share rule: collected fees minus teacher amounts for same month
  const expectedOwnerShare = Math.max(0, feeSummary.totalCollected - feeSummary.totalTeacherShare);
  assert.equal(monthSummary.financials.ownerShare, expectedOwnerShare);
  console.log(`Verified Month Summary: Owner Share = LKR ${monthSummary.financials.ownerShare}, Collected = LKR ${monthSummary.financials.totalCollected}, Unpaid = LKR ${monthSummary.financials.totalUnpaid}.`);

  // Verify class operations sessions held vs required
  assert(monthSummary.classesPerformance.length > 0, 'Class performance list must not be empty');
  for (const c of monthSummary.classesPerformance) {
    assert(c.requiredSessions > 0, 'requiredSessions must be > 0');
    assert(typeof c.heldSessions === 'number', 'heldSessions must be a number');
    assert(typeof c.completionRate === 'number', 'completionRate must be a number');
  }
  console.log(`Verified Academic Operations table: ${monthSummary.classesPerformance.length} class(es) with sessions held vs required.`);

  // 8. Test PDF Downloads for All 4 Reports
  console.log('--- 8. Test PDF Downloads for all 4 Reports ---');
  const reportTypes = ['student-payments', 'pending-fees', 'teacher-salary', 'month-summary'];
  for (const rType of reportTypes) {
    const pdfRes = await fetch(`${baseUrl}/api/owner/reports/pdf?type=${rType}&yearId=${yearId}&month=${targetMonth}`, {
      headers: ownerHeaders,
    });
    assert.equal(pdfRes.status, 200, `PDF download for ${rType} must return 200`);
    assert.equal(pdfRes.headers.get('content-type'), 'application/pdf', 'Content-Type must be application/pdf');

    const pdfBuffer = new Uint8Array(await pdfRes.arrayBuffer());
    const magicHeader = String.fromCharCode(...pdfBuffer.slice(0, 5));
    assert.equal(magicHeader, '%PDF-', `Report ${rType} must stream a valid PDF file`);
    console.log(`Verified PDF generated for [${rType}] (${pdfBuffer.length} bytes).`);
  }

  // 9. Verify UI Screen Route Accessibility
  console.log('--- 9. Verify UI Screen Route ---');
  const uiPageRes = await fetch(`${baseUrl}/owner/reports`, { headers: ownerHeaders });
  assert.equal(uiPageRes.status, 200, '/owner/reports must render with 200 OK');
  console.log('Verified: /owner/reports renders successfully (200 OK).');

  console.log('\n=============================================');
  console.log(' ALL STEP 11 ACCEPTANCE CRITERIA VERIFIED! ');
  console.log('=============================================\n');
}

verifyStep11FullAcceptance().catch((err) => {
  console.error('Acceptance test failed:', err);
  process.exit(1);
});
