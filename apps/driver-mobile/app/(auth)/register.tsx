import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, SegmentedTabs } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { useSession } from '../../src/session/useSession';

const VEHICLES = ['motorcycle', 'bicycle', 'car'] as const;

const inputCls =
  'rounded-xl bg-white border border-surface-200 px-3.5 py-3.5 text-surface-800 dark:bg-surface-800 dark:border-surface-700 dark:text-surface-100';

export default function Register() {
  const { t } = useTranslation();
  const router = useRouter();
  const signUp = useSession((s) => s.signUp);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState<(typeof VEHICLES)[number]>('motorcycle');
  const [busy, setBusy] = useState(false);

  const vehicleLabel = (v: string) =>
    v === 'motorcycle' ? t.driver.motorcycle : v === 'bicycle' ? t.driver.bicycle : t.driver.car;

  return (
    <Screen>
      <View className="mt-8 gap-3">
        <Text className="text-2xl font-bold text-surface-800 dark:text-surface-100">
          {t.driverRegister.title}
        </Text>
        <TextInput
          placeholder={t.driverRegister.name}
          placeholderTextColor="#94a3b8"
          value={fullName}
          onChangeText={setFullName}
          className={inputCls}
        />
        <TextInput
          placeholder={t.driverRegister.email}
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          className={inputCls}
        />
        <TextInput
          placeholder={t.driverRegister.password}
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          className={inputCls}
        />
        <TextInput
          placeholder={t.driverRegister.phone}
          placeholderTextColor="#94a3b8"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          className={inputCls}
        />
        <Text className="text-surface-500 dark:text-surface-400">{t.driverRegister.vehicle}</Text>
        <SegmentedTabs
          value={vehicle}
          onChange={setVehicle}
          options={VEHICLES.map((v) => ({ id: v, label: vehicleLabel(v) }))}
        />
        <Button
          label={busy ? t.driverRegister.registering : t.driverRegister.register}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await signUp({
                email: email.trim(),
                password,
                fullName: fullName.trim(),
                phone: phone.trim() || undefined,
                vehicleType: vehicle,
              });
              router.replace('/(app)');
            } catch {
              Alert.alert(t.driverRegister.failed);
            } finally {
              setBusy(false);
            }
          }}
        />
        <Pressable onPress={() => router.replace('/(auth)/login')}>
          <Text className="text-center font-semibold text-kiwi-700 dark:text-kiwi-400">
            {t.driverRegister.haveAccount}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
