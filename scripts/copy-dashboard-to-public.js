#!/usr/bin/env node
/** Copy dashboard-build to public/dashboard-app (for Vercel build step). */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'dashboard-build');
const dest = path.join(root, 'public', 'dashboard-app');

function copyRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    const s = path.join(srcDir, name);
    const d = path.join(destDir, name);
    if (fs.statSync(s).isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (fs.existsSync(src)) {
  copyRecursive(src, dest);
  console.log('Copied dashboard-build → public/dashboard-app');
} else {
  console.warn('dashboard-build not found (run npm run build:dashboard first)');
}
