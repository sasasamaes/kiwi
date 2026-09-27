// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Genera public/firebase-messaging-sw.js con la config pública de Firebase
 * tomada de NEXT_PUBLIC_FIREBASE_*.
 *
 * El service worker se sirve tal cual (sin bundling), por eso no puede leer
 * env vars en runtime: se inyectan en build. La config es pública por diseño
 * (igual viaja en el bundle del cliente); lo secreto es FIREBASE_SERVICE_ACCOUNT
 * del backend, que nunca sale del servidor.
 *
 * Si faltan vars, no rompe el build: escribe placeholders y avisa.
 */
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, 'firebase-messaging-sw.template.js');
const outPath = path.join(__dirname, '..', 'public', 'firebase-messaging-sw.js');

const pick = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

const config = {
  apiKey: pick(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: pick(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: pick(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: pick(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: pick(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: pick(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};

const missing = Object.entries(config)
  .filter(([, v]) => !v)
  .map(([k]) => k);

const template = fs.readFileSync(templatePath, 'utf8');
const filled = template.replace(
  /const firebaseConfig = \/\*__FIREBASE_CONFIG__\*\/ \{[\s\S]*?\};/,
  `const firebaseConfig = ${JSON.stringify(
    Object.fromEntries(Object.entries(config).map(([k, v]) => [k, v ?? 'MISSING'])),
    null,
    2,
  )};`,
);

fs.writeFileSync(outPath, filled);

if (missing.length > 0) {
  console.warn(
    `[gen-firebase-sw] Faltan NEXT_PUBLIC_FIREBASE_* (${missing.join(', ')}). ` +
      'El push no funcionará hasta configurarlas en Vercel.',
  );
} else {
  console.log('[gen-firebase-sw] firebase-messaging-sw.js generado con config real.');
}
