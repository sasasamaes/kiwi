import { useEffect } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../src/session/useSession';
import { flagsApi } from '../../src/api/flags';
import { http } from '../../src/api/http';

const api = flagsApi(http);

export default function PublicLayout() {
  const hydrated = useSession((s) => s.hydrated);
  const hydrate = useSession((s) => s.hydrate);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  // Gate de prelanzamiento: espejo del AppGate web (fail-open sin API).
  // El seguimiento siempre pasa: el pedido ya existe y solo se mira.
  const { data } = useQuery({
    queryKey: ['flags'],
    queryFn: () => api.features(),
    retry: 1,
  });

  useEffect(() => {
    const isTracking = pathname === '/tracking' || /(^|\/)tracking(\/|$)/.test(pathname ?? '');
    if (data && (data as any).clientAppEnabled === false && pathname !== '/closed' && !isTracking) {
      router.replace('/(public)/closed');
    }
  }, [data, pathname, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
