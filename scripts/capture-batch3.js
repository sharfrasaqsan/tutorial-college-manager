const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outDir = 'C:/Users/Victus/.gemini/antigravity/brain/54304324-582a-473d-807f-cd506d8d25fd/screenshots/batch3';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const viewports = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1024', width: 1024, height: 800 },
  { name: 'wide-1440', width: 1440, height: 900 },
];

async function run() {
  console.log('Starting Playwright screenshot capture for Batch 3...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  // 1. Owner Session
  console.log('Logging in as Owner...');
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await ownerPage.waitForTimeout(1000);

  await ownerPage.fill('input[type="email"]', 'sharfrasaqsan@gmail.com');
  await ownerPage.fill('input[type="password"]', 'Sa@1997626');
  await ownerPage.click('button[type="submit"]');

  await ownerPage.waitForURL('**/owner**', { timeout: 15000 });
  console.log('Owner logged in successfully.');

  const ownerPages = [
    { name: 'owner-notifications', url: 'http://localhost:3000/owner/notifications' },
    { name: 'owner-more', url: 'http://localhost:3000/owner/more' },
    { name: 'owner-college', url: 'http://localhost:3000/owner/more/college' },
    { name: 'owner-academic', url: 'http://localhost:3000/owner/more/academic' },
    { name: 'owner-next-year', url: 'http://localhost:3000/owner/more/next-year' },
    { name: 'owner-public-site', url: 'http://localhost:3000/owner/more/public-site' },
    { name: 'owner-requests', url: 'http://localhost:3000/owner/requests' },
  ];

  for (const item of ownerPages) {
    console.log(`Capturing ${item.name}...`);
    for (const vp of viewports) {
      const page = await ownerContext.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(item.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const file = path.join(outDir, `${item.name}-${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`Saved: ${file}`);
      await page.close();
    }
  }

  await ownerContext.close();

  // 2. Teacher Session
  console.log('Logging in as Teacher...');
  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await teacherPage.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await teacherPage.waitForTimeout(1000);

  await teacherPage.fill('input[type="email"]', 'silva.maths@college.lk');
  await teacherPage.fill('input[type="password"]', 'TeacherSilva2026!');
  await teacherPage.click('button[type="submit"]');

  await teacherPage.waitForURL('**/teacher**', { timeout: 15000 });
  console.log('Teacher logged in successfully.');

  const teacherPages = [
    { name: 'teacher-notifications', url: 'http://localhost:3000/teacher/notifications' },
    { name: 'teacher-more', url: 'http://localhost:3000/teacher/more' },
  ];

  for (const item of teacherPages) {
    console.log(`Capturing ${item.name}...`);
    for (const vp of viewports) {
      const page = await teacherContext.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(item.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const file = path.join(outDir, `${item.name}-${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`Saved: ${file}`);
      await page.close();
    }
  }

  await teacherContext.close();
  await browser.close();
  console.log('Batch 3 screenshots completed successfully!');
}

run().catch((err) => {
  console.error('Batch 3 screenshot capture failed:', err);
  process.exit(1);
});
