const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) results = results.concat(walk(full));
    else if (file === 'route.ts') results.push(full);
  });
  return results;
}

const apiDir = path.join(projectRoot, 'app', 'api');
const routes = walk(apiDir);
console.log('Total API routes found:', routes.length);

let issues = 0;
for (const r of routes) {
  const code = fs.readFileSync(r, 'utf8');
  const rel = path.relative(projectRoot, r).replace(/\\/g, '/');

  const isOwner = rel.startsWith('app/api/owner');
  const isTeacher = rel.startsWith('app/api/teacher');
  const hasVerify = code.includes('verifyApiAuth');

  if (isOwner) {
    if (!hasVerify || (!code.includes('"owner"') && !code.includes("'owner'"))) {
      console.error('OWNER ROUTE MISSING OWNER CHECK:', rel);
      issues++;
    }
  }

  if (isTeacher) {
    if (!hasVerify || (!code.includes('"teacher"') && !code.includes("'teacher'"))) {
      console.error('TEACHER ROUTE MISSING TEACHER CHECK:', rel);
      issues++;
    }
  }
}

if (issues === 0) {
  console.log('SUCCESS: All 34 owner routes strictly check role == "owner", and all 8 teacher routes strictly check role == "teacher"!');
} else {
  console.error(`FAILED: ${issues} routes missing role checks.`);
  process.exit(1);
}
