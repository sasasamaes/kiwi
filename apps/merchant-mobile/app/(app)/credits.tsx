import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { creditsApi } from '../../src/api/credits';
import { http } from '../../src/api/client';
import { BottomNav } from '../../src/ui/BottomNav';

const api = creditsApi(http);

const QUICK = [5000, 10000, 20000];

export default function Credits() {
  const { t, translate } = useTranslation();
  const qc = useQueryClient();
  const [amount, setAmount] = useState('10000');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const bal = useQuery({ queryKey: ['credits', 'balance'], queryFn: () => api.balance() });
  const hist = useQuery({ queryKey: ['credits', 'history'], queryFn: () => api.history() });

  const topup = useMutation({
    mutationFn: () => api.topup(Math.round(Number(amount)) || 0),
    onSuccess: async (res) => {
      if (res?.topupId) setPendingId(res.topupId);
      if (res?.checkoutUrl) {
        try {
          await Linking.openURL(res.checkoutUrl);
        } catch {
          Alert.alert(t.credits.topupFailed);
        }
      }
    },
    onError: () => Alert.alert(t.credits.topupFailed),
  });

  const verify = useMutation({
    mutationFn: () => api.topupStatus(pendingId as string),
    onSuccess: (st) => {
      if (st?.status === 'completed') {
        setPendingId(null);
        void qc.invalidateQueries({ queryKey: ['credits'] });
      }
    },
    onError: () => Alert.alert(t.credits.topupFailed),
  });

  const balance = Number((bal.data as any)?.balance ?? 0);
  const moves = Array.isArray(hist.data) ? hist.data : [];

  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
        {t.credits.title}
      </Text>
      <View
        style={{
          backgroundColor: tokens.color.surface,
          borderRadius: tokens.radius.lg,
          padding: tokens.space[4],
          marginTop: tokens.space[3],
        }}
      >
        <Text style={{ color: tokens.color.ink, fontWeight: '700', fontSize: 18 }}>
          {translate('credits.balance', { amount: balance.toLocaleString() })}
        </Text>
        <Text style={{ color: tokens.color.muted, marginTop: 4, fontSize: 12 }}>
          {balance < 2000 ? t.credits.low : t.credits.ok}
        </Text>
      </View>

      <Text style={{ color: tokens.color.ink, fontWeight: '700', marginTop: 16 }}>
        {t.credits.recharge}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {QUICK.map((q) => (
          <Pressable
            key={q}
            onPress={() => setAmount(String(q))}
            style={{
              flex: 1,
              borderRadius: tokens.radius.md,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: amount === String(q) ? tokens.color.kiwi : tokens.color.surface,
            }}
          >
            <Text
              style={{
                color: amount === String(q) ? '#fff' : tokens.color.ink,
                fontWeight: '600',
              }}
            >
              ₡{q.toLocaleString()}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        placeholder={t.credits.amount}
        placeholderTextColor={tokens.color.muted}
        value={amount}
        onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
        keyboardType="numeric"
        style={{
          backgroundColor: tokens.color.surface,
          color: tokens.color.ink,
          borderRadius: tokens.radius.md,
          padding: 12,
          marginTop: 8,
        }}
      />
      <View style={{ marginTop: 8 }}>
        <Button
          label={t.credits.openCheckout}
          loading={topup.isPending}
          onPress={() => topup.mutate()}
        />
      </View>
      {pendingId && (
        <View style={{ marginTop: 8 }}>
          <Button
            label={t.credits.verifyPayment}
            variant="secondary"
            loading={verify.isPending}
            onPress={() => verify.mutate()}
          />
        </View>
      )}

      <Text style={{ color: tokens.color.ink, fontWeight: '700', marginTop: 16, marginBottom: 8 }}>
        {t.credits.history}
      </Text>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tokens.space[6] }}
        refreshControl={
          <RefreshControl
            refreshing={bal.isRefetching || hist.isRefetching}
            onRefresh={() => {
              void bal.refetch();
              void hist.refetch();
            }}
          />
        }
      >
        {moves.length === 0 ? (
          <Text style={{ color: tokens.color.muted }}>{t.credits.empty}</Text>
        ) : (
          moves.map((h: any, i: number) => (
            <View
              key={h.id ?? i}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                backgroundColor: tokens.color.surface,
                borderRadius: tokens.radius.md,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: tokens.color.ink, flex: 1 }}>{h.reason ?? h.type ?? ''}</Text>
              <Text
                style={{
                  color: Number(h.amount) >= 0 ? tokens.color.kiwi : tokens.color.ink,
                  fontWeight: '700',
                }}
              >
                {Number(h.amount) >= 0 ? '+' : ''}₡{Number(h.amount ?? 0).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
      <BottomNav active="profile" />
    </Screen>
  );
}
