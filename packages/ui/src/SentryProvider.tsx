'use client';

import { useEffect } from 'react';
import { initSentry } from './sentry';

/**
 * SentryProvider
 *
 * Initializes Sentry error tracking.
 * Wrap your app with this component:
 *
 *   <SentryProvider>
 *     <App />
 *   </SentryProvider>
 */
export function SentryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initSentry();
  }, []);

  return <>{children}</>;
}

export default SentryProvider;
