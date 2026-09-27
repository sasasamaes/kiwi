// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use strict';

/**
 * @kiwi/eslint-plugin — reglas compartidas del monorepo Kiwi.
 *
 * Configuración: en cualquier .eslintrc del repo,
 *   "plugins": ["@kiwi"]
 *   "rules": { "@kiwi/no-raw-location-assign": "error" }
 *
 * (npm resuelve el prefijo `@kiwi/…` desde este workspace package).
 */

const fs = require('fs');
const path = require('path');

// Carga rules/*.js sin dependencias externas.
const rules = {};
for (const file of fs.readdirSync(path.join(__dirname, 'rules'))) {
  if (file.endsWith('.js')) {
    rules[path.basename(file, '.js')] = require(path.join(__dirname, 'rules', file));
  }
}

module.exports = {
  rules,
  configs: {
    recommended: {
      plugins: ['@kiwi'],
      rules: {
        '@kiwi/no-raw-location-assign': 'error',
      },
    },
  },
};
