#!/usr/bin/env node
/** Copy dashboard.css and share.css from parent app/ so they exist at Vite build time (avoids "doesn't exist at build time" warnings). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const appDir = path.join(root, '..', 'app');
const outDir = path.join(root, 'public', 'app');

const files = ['dashboard.css', 'share.css'];
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
for (const name of files) {
  const src = path.join(appDir, name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(outDir, name));
    console.log('Copied', name, '→ public/app/');
  }
}
