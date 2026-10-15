import { Redirect } from 'expo-router';

// Guest-first: the app opens straight into discovery. No login gate.
export default function Index() {
  return <Redirect href="/(public)/comercios" />;
}
