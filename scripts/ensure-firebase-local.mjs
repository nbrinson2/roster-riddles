import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const example = path.join(root, 'src/config/firebase.local.example.ts');
const local = path.join(root, 'src/config/firebase.local.ts');

if (!fs.existsSync(local)) {
  fs.copyFileSync(example, local);
  console.warn(
    '[ensure-firebase-local] Created src/config/firebase.local.ts — add your Firebase web app config.',
  );
}
