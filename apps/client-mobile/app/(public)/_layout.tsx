import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useSession } from '../../src/session/useSession';

export default function PublicLayout() {
  const hydrated = useSession((s) => s.hydrated);
  const hydrate = useSession((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
