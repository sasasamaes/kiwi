import Link from 'next/link';
import type { LegalDoc, LegalDocKind } from './legal';
import { privacyPolicy, termsOfService, cookiePolicy, refundPolicy } from './legal';

const DOCS: Record<LegalDocKind, LegalDoc> = {
  privacy: privacyPolicy,
  terms: termsOfService,
  cookies: cookiePolicy,
  refunds: refundPolicy,
};

export interface LegalDocViewProps {
  doc: LegalDocKind;
  /**
   * Enlaces cruzados del encabezado. Por defecto enlaza a los otros dos
   * documentos en rutas `/privacy`, `/terms`, `/cookies`; pasá `[]` para
   * ocultarlos (p. ej. apps que solo publican uno) o valores custom.
   */
  crossLinks?: Array<{ href: string; label: string }>;
}

/**
 * Vista legal compartida por las superficies web de Kiwi (web, driver, client).
 * Server component: cero JS de cliente y cero framer-motion — debe cargar
 * aunque la conexión sea mala y sin login.
 */
export function LegalDocView({ doc, crossLinks }: LegalDocViewProps) {
  const content = DOCS[doc];
  const links = crossLinks ?? DEFAULT_CROSS_LINKS[doc];

  return (
    <main id="main-content" className="min-h-[100dvh] bg-surface-50 dark:bg-surface-950">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link
          href="/"
          className="text-sm font-medium text-kiwi-700 hover:underline dark:text-kiwi-400"
        >
          ← Volver
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-surface-900 dark:text-surface-50">
          {content.title}
        </h1>
        {/* meta: light 500 (4.63) / dark 400 (7.16) — texto informativo AA */}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-surface-500 dark:text-surface-400">
          <span>Última actualización: {content.updated}</span>
          {links.map((link) => (
            <span key={link.href}>
              {' · '}
              <Link
                href={link.href}
                className="font-medium text-kiwi-700 hover:underline dark:text-kiwi-400"
              >
                {link.label}
              </Link>
            </span>
          ))}
        </p>

        <div className="mt-6 space-y-8 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
          {content.intro.map((text, i) => (
            <p key={i}>{text}</p>
          ))}

          {content.sections.map((section, i) => (
            <section key={i}>
              <h2 className="mb-2 text-lg font-semibold text-surface-800 dark:text-surface-100">
                {section.heading}
              </h2>
              <div className="space-y-3">
                {section.paragraphs.map((text, j) => (
                  <p key={j}>{text}</p>
                ))}
              </div>
              {section.table && <LegalTable table={section.table} />}
            </section>
          ))}

          <p className="border-t border-surface-200 pt-6 text-surface-500 dark:border-surface-700 dark:text-surface-400">
            {content.contactNote}
          </p>
        </div>
      </div>
    </main>
  );
}

const DEFAULT_CROSS_LINKS: Record<LegalDocKind, Array<{ href: string; label: string }>> = {
  privacy: [
    { href: '/terms', label: 'Términos de uso' },
    { href: '/cookies', label: 'Cookies' },
    { href: '/refunds', label: 'Reembolsos' },
  ],
  terms: [
    { href: '/privacy', label: 'Política de privacidad' },
    { href: '/cookies', label: 'Cookies' },
    { href: '/refunds', label: 'Reembolsos' },
  ],
  cookies: [
    { href: '/privacy', label: 'Política de privacidad' },
    { href: '/terms', label: 'Términos de uso' },
    { href: '/refunds', label: 'Reembolsos' },
  ],
  refunds: [
    { href: '/privacy', label: 'Política de privacidad' },
    { href: '/terms', label: 'Términos de uso' },
    { href: '/cookies', label: 'Cookies' },
  ],
};

function LegalTable({ table }: { table: { headers: string[]; rows: string[][] } }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-700">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-surface-200 bg-surface-100/60 dark:border-surface-700 dark:bg-surface-900/60">
            {table.headers.map((header) => (
              <th
                key={header}
                className="px-3 py-2 font-semibold text-surface-700 dark:text-surface-200"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-surface-100 last:border-0 dark:border-surface-800"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top text-surface-600 dark:text-surface-300">
                  {j === 0 ? (
                    <code className="rounded bg-surface-100 px-1.5 py-0.5 font-mono text-[11px] text-surface-700 dark:bg-surface-800 dark:text-surface-200">
                      {cell}
                    </code>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
// Nota de contraste de la tabla: celdas dark:text-surface-300 sobre 950 =
// 9.7:1 ✓ (calculado); headers 200 sobre 900/60 ≈ ok. No tocar a 400/500.
