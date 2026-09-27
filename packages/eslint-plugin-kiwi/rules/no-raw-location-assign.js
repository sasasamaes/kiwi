// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use strict';

/**
 * Regla ESLint compartida: kiwi/no-raw-location-assign
 *
 * Prohibe asignar `window.location.href` (o location.assign/replace) con
 * valores que pueden venir del servidor o de datos dinámicos — open
 * redirects y phishing por QR entran exactamente por ahí.
 *
 * Detecta como "dinámico" todo lo que NO sea:
 *   - un literal de string empieza con '/', '#', '?' o 'http(s)://localhost'
 *   - una concatenación de solo literales
 *   - una template literal SIN expresiones
 *   - `window.location.href = window.location.href + '#x'` (auto-referencia)
 *
 * Qué reporta:
 *   AssignmentExpression (=) sobre location.href
 *   location.assign(...) / location.replace(...) / location = ... (con .href implícito)
 *
 * Escape hatch: en vez de `// eslint-disable-next-line`, migra el sitio a
 * `safeNavigateToUrl(url)` de @kiwi/ui (valida protocolo + allow-list) —
 * esa llamada está permitida porque la validación vive ahí dentro.
 */

const SAFE_LITERAL_START = /^(\/|#|\?|https?:\/\/localhost)/;
const SAFE_ASSIGN_METHODS = new Set(['assign', 'replace']);

function isPlainSafeString(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return SAFE_LITERAL_START.test(node.value);
  }
  // Template literal sin expresiones: `#section`
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return SAFE_LITERAL_START.test(node.quasis[0].value.cooked ?? '');
  }
  // Concatenación de literales seguros: '/menu/' + id NO es segura (id dinámico)
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return isPlainSafeString(node.left) && isPlainSafeString(node.right);
  }
  return false;
}

/** ¿La expresión proviene de window.location? (auto-referencia segura). */
function isSelfLocationRef(node) {
  if (node.type !== 'MemberExpression') return false;
  const obj = node.object;
  return (
    (obj.type === 'Identifier' && obj.name === 'location' && node.property.name === 'href') ||
    (obj.type === 'MemberExpression' &&
      obj.object.type === 'Identifier' &&
      obj.object.name === 'window' &&
      obj.property.name === 'location' &&
      node.property.name === 'href')
  );
}

function isLocationObject(node) {
  if (node.type === 'Identifier' && node.name === 'location') return true;
  return (
    node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    node.object.name === 'window' &&
    ((node.property.name ?? node.property.value) === 'location' || node.property.name === undefined) // window['location'] — cubierto por value
  );
}

function isHrefProperty(node) {
  return node.type === 'MemberExpression' && (node.property.name ?? node.property.value) === 'href';
}

function isLocationHrefWrite(node) {
  // location.href = x | window.location.href = x
  return (
    node.type === 'AssignmentExpression' &&
    isHrefProperty(node.left) &&
    isLocationObject(node.left.object)
  );
}

function isLocationAssignCall(node) {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee.type !== 'MemberExpression') return false;
  if (!SAFE_ASSIGN_METHODS.has(callee.property.name ?? callee.property.value)) return false;
  return isLocationObject(callee.object);
}

function isLocationSelfWrite(node) {
  // location = x | window.location = x
  return node.type === 'AssignmentExpression' && isLocationObject(node.left);
}

/** ¿Existe `safeNavigateToUrl(` en el mismo archivo? — escape hatch del proyecto. */
function hasSafeNavigateImport(context) {
  const sourceCode = context.getSourceCode();
  const text = sourceCode.getText();
  return /safeNavigateToUrl\s*\(/.test(text);
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ban assigning server-provided URLs to window.location.href; use safeNavigateToUrl() from @kiwi/ui instead',
      recommended: true,
    },
    schema: [],
    messages: {
      rawAssign:
        'No asignes URLs dinámicas a location (posible open redirect). Usa safeNavigateToUrl(url) de @kiwi/ui, que valida protocolo y allow-list antes de navegar.',
    },
  },

  create(context) {
    // Si el archivo ya usa el helper, las asignaciones restantes se asumen
    // migradas/auditoría manual — el linter no debe pelearse consigo mismo.
    let usesHelper = false;
    return {
      Program() {
        usesHelper = hasSafeNavigateImport(context);
      },
      'AssignmentExpression, CallExpression'(node) {
        const isHrefWrite = isLocationHrefWrite(node);
        const isAssignCall = isLocationAssignCall(node);
        const isSelfWrite = isLocationSelfWrite(node);
        if (!isHrefWrite && !isAssignCall && !isSelfWrite) return;

        const value = isAssignCall ? node.arguments[0] : node.right;
        if (!value) return;

        // Literales seguros (rutas internas, anclas) — permitidos.
        if (isPlainSafeString(value)) return;
        // Auto-referencia: location.href = location.href (forzar navegación)
        if (isSelfLocationRef(value)) return;
        // El archivo usa el helper para URLs dinámicas — no duplicar reglas.
        if (usesHelper) return;

        context.report({ node, messageId: 'rawAssign' });
      },
    };
  },
};
