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
}

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

['styles.css', 'script.js', 'index.html'].forEach((file) => {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(publicDir, file));
    console.log('Copied', file);
  }
});

['media', 'app', 'messages'].forEach((dir) => {
  const src = path.join(root, dir);
  const dest = path.join(publicDir, dir);
  if (fs.existsSync(src)) {
    copyRecursive(src, dest);
    console.log('Copied', dir + '/');
  }
});

// Favicon (fix 404 for /favicon.ico and /favicon.png)
const iconLogo = path.join(root, 'media', 'iconlogo.png');
if (fs.existsSync(iconLogo)) {
  fs.copyFileSync(iconLogo, path.join(publicDir, 'favicon.png'));
  fs.copyFileSync(iconLogo, path.join(publicDir, 'favicon.ico'));
  console.log('Copied favicon.png, favicon.ico');
}

const dashboardBuild = path.join(root, 'dashboard-build');
const publicDashboard = path.join(publicDir, 'dashboard-app');
if (fs.existsSync(dashboardBuild)) {
  copyRecursive(dashboardBuild, publicDashboard);
  console.log('Copied dashboard-build → public/dashboard-app');
}

console.log('public/ ready for Vercel');
