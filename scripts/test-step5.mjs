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

async function verifyStep5Acceptance() {
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
  let ownerCookie = ownerSessionRes.headers.get('set-cookie');
  console.log('Owner authenticated. Session established.');

  // Set academic year cookie
  const yearCookie = 'tcm_year=2026';
  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `${ownerCookie}; ${yearCookie}`
  };

  console.log('--- 2. Fetch Available Teachers & Students ---');
  const teachersRes = await fetch(baseUrl + '/api/owner/teachers', { headers: authHeaders });
  const teachersData = await teachersRes.json();
  assert(teachersData.teachers && teachersData.teachers.length > 0, 'At least one teacher should exist');
  const teacher = teachersData.teachers[0];
  console.log(`Found teacher: ${teacher.name} (${teacher.id})`);

  const studentsRes = await fetch(baseUrl + '/api/owner/students', { headers: authHeaders });
  const studentsData = await studentsRes.json();
  let student1 = studentsData.students?.[0];
  let student2 = studentsData.students?.[1];

  if (!student1) {
    console.log('Creating a test student...');
    const createStudRes = await fetch(baseUrl + '/api/owner/students', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Kavindu Perera',
        school: 'Ananda College',
        address: 'No 45, Galle Road, Colombo 03',
        guardianName: 'Nimal Perera',
        guardianPhone: '0711112233',
        grade: 'Grade 10',
        yearId: '2026',
        admissionFeeAmount: 2500,
      })
    });
    const created = await createStudRes.json();
    if (!createStudRes.ok) throw new Error('Create stud 1 failed: ' + JSON.stringify(created));
    student1 = created.student;
  }

  if (!student2) {
    console.log('Creating second test student...');
    const createStudRes2 = await fetch(baseUrl + '/api/owner/students', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Dinuka Silva',
        school: 'Royal College',
        address: 'No 12, Flower Road, Colombo 07',
        guardianName: 'Sunil Silva',
        guardianPhone: '0772223344',
        grade: 'Grade 10',
        yearId: '2026',
        admissionFeeAmount: 2500,
      })
    });
    const created2 = await createStudRes2.json();
    if (!createStudRes2.ok) {
      throw new Error(`Failed to create test student 2: ${JSON.stringify(created2)}`);
    }
    student2 = created2.student;
  }
  console.log(`Test students ready: ${student1.name} (${student1.id}), ${student2.name} (${student2.id})`);

  console.log('--- 3. Create Class with Terms Validation ---');
  // 3a. Reject teacher share > monthly fee
  const invalidTermsRes = await fetch(baseUrl + '/api/owner/classes', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      yearId: '2026',
      grade: 'Grade 10',
      subject: 'Science',
      teacherId: teacher.id,
      terms: {
        monthlyFee: 3000,
        teacherSharePerStudent: 3500, // Invalid: exceeds 3000
        requiredSessionsPerMonth: 8,
        effectiveFromMonth: '2026-01'
      }
    })
  });
  assert.strictEqual(invalidTermsRes.status, 400, 'Must refuse teacher share > monthly fee');
  const invalidJson = await invalidTermsRes.json();
  console.log('Successfully rejected invalid teacher share:', invalidJson.error);

  // 3b. Create valid class
  const createClassRes = await fetch(baseUrl + '/api/owner/classes', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      yearId: '2026',
      grade: 'Grade 10',
      subject: 'Science',
      teacherId: teacher.id,
      terms: {
        monthlyFee: 3500,
        teacherSharePerStudent: 2500,
        requiredSessionsPerMonth: 8,
        effectiveFromMonth: '2026-01'
      }
    })
  });
  const createdClass = await createClassRes.json();
  assert(createClassRes.ok, 'Class creation should succeed: ' + JSON.stringify(createdClass));
  assert.strictEqual(createdClass.classItem.name, 'Grade 10 Science', 'Class name must be generated as Grade + Subject');
  console.log(`Class created: ${createdClass.classItem.name} (ID: ${createdClass.classItem.id})`);

  const classId = createdClass.classItem.id;

  // 3c. Duplicate class rejection
  const dupRes = await fetch(baseUrl + '/api/owner/classes', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      yearId: '2026',
      grade: 'Grade 10',
      subject: 'Science',
      teacherId: teacher.id,
      terms: {
        monthlyFee: 4000,
        teacherSharePerStudent: 3000,
        requiredSessionsPerMonth: 8,
        effectiveFromMonth: '2026-01'
      }
    })
  });
  assert.strictEqual(dupRes.status, 400, 'Must reject duplicate grade + subject in the same year');
  const dupJson = await dupRes.json();
  console.log('Successfully rejected duplicate class:', dupJson.error);

  console.log('--- 4. Batch Enroll Students ---');
  const enrollRes = await fetch(`${baseUrl}/api/owner/classes/${classId}/enrolments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      studentIds: [student1.id, student2.id],
      joinedMonth: '2026-01'
    })
  });
  const enrollJson = await enrollRes.json();
  assert(enrollRes.ok, 'Batch enrolment failed: ' + JSON.stringify(enrollJson));
  assert.strictEqual(enrollJson.enrolledCount, 2, 'Should have enrolled 2 students');
  console.log(`Enrolled ${enrollJson.enrolledCount} students successfully.`);

  // Verify class detail returns enrolled students
  const classDetailRes = await fetch(`${baseUrl}/api/owner/classes/${classId}`, { headers: authHeaders });
  const classDetail = await classDetailRes.json();
  assert.strictEqual(classDetail.enrolledStudents.length, 2, 'Detail page should show 2 enrolled students');
  console.log('Class detail student count verified:', classDetail.enrolledStudents.length);

  console.log('--- 5. Verify Student in Multiple Classes ---');
  // Create another class: Grade 10 English
  const createClass2Res = await fetch(baseUrl + '/api/owner/classes', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      yearId: '2026',
      grade: 'Grade 10',
      subject: 'English',
      teacherId: teacher.id,
      terms: {
        monthlyFee: 3000,
        teacherSharePerStudent: 2000,
        requiredSessionsPerMonth: 8,
        effectiveFromMonth: '2026-01'
      }
    })
  });
  const class2Json = await createClass2Res.json();
  assert(createClass2Res.ok, 'Failed to create second class');
  const class2Id = class2Json.classItem.id;

  // Enroll student1 in the second class too
  const enrollClass2Res = await fetch(`${baseUrl}/api/owner/classes/${class2Id}/enrolments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      studentIds: [student1.id],
      joinedMonth: '2026-01'
    })
  });
  assert(enrollClass2Res.ok, 'Failed to enroll student in second class');
  console.log(`Student ${student1.name} successfully enrolled in multiple classes (Science & English).`);

  console.log('--- 6. Update Terms with Versioning ---');
  const updateTermsRes = await fetch(`${baseUrl}/api/owner/classes/${classId}/terms`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      monthlyFee: 4200,
      teacherSharePerStudent: 3000,
      requiredSessionsPerMonth: 8,
      effectiveFromMonth: '2026-07'
    })
  });
  const updatedTermsJson = await updateTermsRes.json();
  assert(updateTermsRes.ok, 'Update terms failed: ' + JSON.stringify(updatedTermsJson));
  console.log('New terms added with effective month 2026-07.');

  // Fetch class details and verify termsHistory
  const updatedClassRes = await fetch(`${baseUrl}/api/owner/classes/${classId}`, { headers: authHeaders });
  const updatedClassData = await updatedClassRes.json();
  assert(updatedClassData.classItem.termsHistory.length >= 2, 'Terms history must contain at least 2 versions');
  console.log('Terms history verified:', updatedClassData.classItem.termsHistory.map(t => `${t.effectiveFromMonth}: LKR ${t.monthlyFee}`));

  console.log('--- 7. Remove Student from Class ---');
  const removeRes = await fetch(`${baseUrl}/api/owner/classes/${classId}/enrolments/${student2.id}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  assert(removeRes.ok, 'Failed to remove student from class');

  const afterRemoveRes = await fetch(`${baseUrl}/api/owner/classes/${classId}`, { headers: authHeaders });
  const afterRemoveData = await afterRemoveRes.json();
  assert.strictEqual(afterRemoveData.enrolledStudents.length, 1, 'Enrolled count should now be 1');
  console.log('Student removed. Remaining students in class:', afterRemoveData.enrolledStudents.length);

  console.log('\n==========================================');
  console.log('ALL STEP 5 ACCEPTANCE CRITERIA VERIFIED PASS!');
  console.log('==========================================\n');
}

verifyStep5Acceptance().catch((err) => {
  console.error('STEP 5 ACCEPTANCE FAILED:', err);
  process.exit(1);
});
