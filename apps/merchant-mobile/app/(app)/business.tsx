import { useState } from 'react';
import { Alert, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { profileApi } from '../../src/api/profile';
import { http } from '../../src/api/client';
import { BottomNav } from '../../src/ui/BottomNav';

const api = profileApi(http);

const inputStyle = {
  backgroundColor: tokens.color.surface,
  color: tokens.color.ink,
  borderRadius: tokens.radius.md,
  padding: 12,
  marginBottom: 8,
} as const;

export default function Business() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [listed, setListed] = useState<boolean | null>(null);

  const { data, isError } = useQuery({
    queryKey: ['merchant', 'profile'],
    queryFn: () => api.merchantProfile(),
  });

  const m: any = data ?? {};
  const v = (draft: string | null, fallback: any) => draft ?? fallback ?? '';

  const save = useMutation({
    mutationFn: () =>
      api.updateMerchantProfile({
        businessName: v(name, m.businessName),
        description: v(description, m.description),
        address: v(address, m.address),
        phone: v(phone, m.phone ?? m.user?.phone),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merchant', 'profile'] });
      Alert.alert(t.merchantProfile.saved);
    },
    onError: () => Alert.alert(t.merchantProfile.saveFailed),
  });

  const visibility = useMutation({
    mutationFn: (value: boolean) => api.setVisibility(value),
    onSuccess: (_res, value) => {
      setListed(value);
      void qc.invalidateQueries({ queryKey: ['merchant', 'profile'] });
    },
    onError: () => Alert.alert(t.merchantProfile.saveFailed),
  });

  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
        {t.merchantProfile.title}
      </Text>
      {isError ? (
        <Text style={{ color: tokens.color.muted, marginTop: 8 }}>
          {t.merchantProfile.loadFailed}
        </Text>
      ) : null}
      <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <TextInput
          placeholder={t.merchantProfile.businessName}
          placeholderTextColor={tokens.color.muted}
          value={v(name, m.businessName)}
          onChangeText={setName}
          style={inputStyle}
        />
        <TextInput
          placeholder={t.merchantProfile.description}
          placeholderTextColor={tokens.color.muted}
          value={v(description, m.description)}
          onChangeText={setDescription}
          multiline
          style={[inputStyle, { minHeight: 70, textAlignVertical: 'top' }]}
        />
        <TextInput
          placeholder={t.merchantProfile.address}
          placeholderTextColor={tokens.color.muted}
          value={v(address, m.address)}
          onChangeText={setAddress}
          style={inputStyle}
        />
        <TextInput
          placeholder={t.merchantProfile.phone}
          placeholderTextColor={tokens.color.muted}
          value={v(phone, m.phone)}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={inputStyle}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: tokens.color.surface,
            borderRadius: tokens.radius.md,
            padding: 12,
            marginBottom: 8,
          }}
        >
          <Text style={{ color: tokens.color.ink }}>{t.merchantProfile.listed}</Text>
          <Switch
            value={listed ?? m.listed ?? m.isListed ?? true}
            onValueChange={(val) => visibility.mutate(val)}
          />
        </View>
        <Button
          label={save.isPending ? t.merchantProfile.saving : t.merchantProfile.save}
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
      </ScrollView>
      <BottomNav active="profile" />
    </Screen>
  );
}
