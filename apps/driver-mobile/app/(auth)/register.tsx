import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { useSession } from '../../src/session/useSession';

const VEHICLES = ['motorcycle', 'bicycle', 'car'] as const;

const inputStyle = {
  backgroundColor: tokens.color.surface,
  color: tokens.color.ink,
  borderRadius: tokens.radius.md,
  padding: 14,
} as const;

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
      <View style={{ gap: tokens.space[3], marginTop: tokens.space[8] }}>
        <Text style={{ color: tokens.color.ink, fontSize: 24, fontWeight: '700' }}>
          {t.driverRegister.title}
        </Text>
        <TextInput
          placeholder={t.driverRegister.name}
          placeholderTextColor={tokens.color.muted}
          value={fullName}
          onChangeText={setFullName}
          style={inputStyle}
        />
        <TextInput
          placeholder={t.driverRegister.email}
          placeholderTextColor={tokens.color.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={inputStyle}
        />
        <TextInput
          placeholder={t.driverRegister.password}
          placeholderTextColor={tokens.color.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={inputStyle}
        />
        <TextInput
          placeholder={t.driverRegister.phone}
          placeholderTextColor={tokens.color.muted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          style={inputStyle}
        />
        <Text style={{ color: tokens.color.muted }}>{t.driverRegister.vehicle}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {VEHICLES.map((v) => (
            <Pressable
              key={v}
              onPress={() => setVehicle(v)}
              style={{
                flex: 1,
                borderRadius: tokens.radius.md,
                paddingVertical: 10,
                alignItems: 'center',
                backgroundColor: vehicle === v ? tokens.color.kiwi : tokens.color.surface,
              }}
            >
              <Text style={{ color: vehicle === v ? '#fff' : tokens.color.ink, fontWeight: '600' }}>
                {vehicleLabel(v)}
              </Text>
            </Pressable>
          ))}
        </View>
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
          <Text style={{ color: tokens.color.kiwi, textAlign: 'center', fontWeight: '600' }}>
            {t.driverRegister.haveAccount}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
