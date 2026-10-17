import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { Card, Field, Header, ui } from '../../src/components/ui';
import { useSession } from '../../src/session/useSession';
import { LanguageButton } from '../../src/i18n/LanguageButton';
import { useState } from 'react';

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useSession((s) => s);
  const [address, setAddress] = useState('');

  return (
    <Screen>
      <Header title={t.profile.title} />
      <Card style={{ marginBottom: 14 }}>
        <Text style={ui.muted}>{t.customer.account}</Text>
        <Text style={{ color: tokens.color.ink, fontSize: 16, fontWeight: '700', marginTop: 4 }}>
          {user?.fullName || user?.email || t.customer.guest}
        </Text>
        {!!user?.email && <Text style={ui.muted}>{user.email}</Text>}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Field label={t.checkout.deliveryAddress} value={address} onChangeText={setAddress} />
        <Text style={ui.muted}>{t.customer.saveAddressHint}</Text>
      </Card>

      <View style={{ marginBottom: 14 }}>
        <LanguageButton />
      </View>

      <Pressable onPress={() => router.push('/(account)/orders')} style={{ marginBottom: 16 }}>
        <Text style={{ color: tokens.color.lime, fontWeight: '600' }}>
          {t.customer.viewMyOrders}
        </Text>
      </Pressable>

      <Button
        label={t.auth.logout}
        variant="danger"
        onPress={async () => {
          await signOut();
          router.replace('/(public)/comercios');
        }}
      />
    </Screen>
  );
}
