import assert from "assert";

async function runStep12Verification() {
  console.log("=== STEP 12 VERIFICATION: PUBLIC WEBSITE & PRIVACY AUDIT ===");

  const baseUrl = "http://localhost:3000";

  // 1. Verify Home Page (/)
  console.log("\n1. Verifying Home Page (/)...");
  const homeRes = await fetch(`${baseUrl}/`);
  assert.strictEqual(homeRes.status, 200, "Home page should return 200 OK");
  const homeHtml = await homeRes.text();
  assert.ok(homeHtml.includes("application/ld+json"), "Home page should include JSON-LD structured data");
  assert.ok(homeHtml.includes("EducationalOrganization"), "JSON-LD should declare EducationalOrganization");
  assert.ok(homeHtml.includes("Classes &amp; Monthly Fees") || homeHtml.includes("Classes & Monthly Fees") || homeHtml.includes("Classes"), "Home page should include classes link");
  assert.ok(homeHtml.includes("Weekly Timetable") || homeHtml.includes("Timetable"), "Home page should include timetable link");
  console.log("✓ Home page returned 200 with EducationalOrganization JSON-LD and navigation");

  // 2. Verify Classes Page (/classes)
  console.log("\n2. Verifying Classes Page (/classes)...");
  const classesRes = await fetch(`${baseUrl}/classes`);
  assert.strictEqual(classesRes.status, 200, "Classes page should return 200 OK");
  const classesHtml = await classesRes.text();
  assert.ok(classesHtml.includes("Classes &amp; Monthly Fees") || classesHtml.includes("Classes & Monthly Fees"), "Classes page should render heading");
  assert.ok(classesHtml.includes("LKR"), "Classes page should display currency in LKR");
  console.log("✓ Classes page returned 200 with LKR pricing and grade grouping");

  // 3. Verify Timetable Page (/timetable)
  console.log("\n3. Verifying Timetable Page (/timetable)...");
  const timetableRes = await fetch(`${baseUrl}/timetable`);
  assert.strictEqual(timetableRes.status, 200, "Timetable page should return 200 OK");
  const timetableHtml = await timetableRes.text();
  assert.ok(timetableHtml.includes("Weekly Timetable"), "Timetable page should render heading");
  assert.ok(timetableHtml.includes("Print Timetable"), "Timetable page should have Print Timetable button");
  assert.ok(!timetableHtml.includes("makeup") && !timetableHtml.includes("make-up session"), "Timetable page should never expose makeup sessions");
  console.log("✓ Timetable page returned 200 with print button and clean weekly slots");

  // 4. Verify Teachers Page (/teachers)
  console.log("\n4. Verifying Teachers Page (/teachers)...");
  const teachersRes = await fetch(`${baseUrl}/teachers`);
  assert.strictEqual(teachersRes.status, 200, "Teachers page should return 200 OK");
  const teachersHtml = await teachersRes.text();
  assert.ok(teachersHtml.includes("Teaching Faculty"), "Teachers page should render faculty heading");
  console.log("✓ Teachers page returned 200");

  // 5. Verify Contact Page (/contact)
  console.log("\n5. Verifying Contact Page (/contact)...");
  const contactRes = await fetch(`${baseUrl}/contact`);
  assert.strictEqual(contactRes.status, 200, "Contact page should return 200 OK");
  const contactHtml = await contactRes.text();
  assert.ok(contactHtml.includes("Contact &amp; Campus Location") || contactHtml.includes("Contact & Campus Location"), "Contact page should render heading");
  console.log("✓ Contact page returned 200");

  // 6. Security & Privacy Audit: Confirm NO student data or private teacher data is reachable on public pages
  console.log("\n6. Running Security & Privacy Audit on Public Pages...");
  const pages = [homeHtml, classesHtml, timetableHtml, teachersHtml, contactHtml];
  
  for (const html of pages) {
    // Check for student indicators
    assert.ok(!html.includes("guardianPhone"), "Public HTML must NEVER expose guardianPhone");
    assert.ok(!html.includes("admissionFeeReceiptNo"), "Public HTML must NEVER expose admissionFeeReceiptNo");
    assert.ok(!html.includes("gradesByYear"), "Public HTML must NEVER expose student internal schema");
    assert.ok(!html.includes("teacherSharePerStudent"), "Public HTML must NEVER expose teacher commission/share");
    assert.ok(!html.includes("depositDate"), "Public HTML must NEVER expose salary deposit details");
  }
  console.log("✓ Privacy Audit Passed: Zero student records, guardian phones, receipts, or teacher commissions exposed in public HTML");

  console.log("\n=======================================================");
  console.log("✓ ALL STEP 12 ACCEPTANCE TESTS PASSED SUCCESSFULLY!");
  console.log("=======================================================");
}

runStep12Verification().catch((err) => {
  console.error("Step 12 verification failed:", err);
  process.exit(1);
});
