#!/usr/bin/env node
/**
 * Copy static assets into public/ for Vercel.
 * Run first in build so public/ exists; dashboard-build is copied later by copy-dashboard-to-public.js.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');

function copyRecursive(src, dest) {
  try {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      for (const name of fs.readdirSync(src)) {
        copyRecursive(path.join(src, name), path.join(dest, name));
      }
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  } catch (err) {
    console.warn('Skip (copy failed):', src, err.message);
  }
}

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

['styles.css', 'script.js', 'index.html'].forEach((file) => {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(publicDir, file));
    console.log('Copied', file);
  }
});

['media', 'messages', 'app'].forEach((dir) => {
  const src = path.join(root, dir);
  const dest = path.join(publicDir, dir);
  if (fs.existsSync(src)) {
    copyRecursive(src, dest);
    console.log('Copied', dir + '/');
  }
});

// Favicon (fix 404 for /favicon.ico and /favicon.webp)
const iconLogo = path.join(root, 'media', 'iconlogo.png');
if (fs.existsSync(iconLogo)) {
  fs.copyFileSync(iconLogo, path.join(publicDir, 'favicon.webp'));
  fs.copyFileSync(iconLogo, path.join(publicDir, 'favicon.ico'));
  console.log('Copied favicon.webp, favicon.ico');
}
// Fix 404 for /media/iconlogo.webp (some clients request this path)
const publicMedia = path.join(publicDir, 'media');
if (fs.existsSync(iconLogo) && fs.existsSync(publicMedia)) {
  fs.copyFileSync(iconLogo, path.join(publicMedia, 'iconlogo.webp'));
  console.log('Copied media/iconlogo.webp');
}

const dashboardBuild = path.join(root, 'dashboard-build');
const publicDashboard = path.join(publicDir, 'dashboard-app');
if (fs.existsSync(dashboardBuild)) {
  copyRecursive(dashboardBuild, publicDashboard);
  console.log('Copied dashboard-build → public/dashboard-app');
}

console.log('public/ ready for Vercel');
