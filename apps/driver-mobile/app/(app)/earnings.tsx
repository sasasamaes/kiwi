import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { earningsApi } from '../../src/api/earnings';
import { http } from '../../src/api/client';

const api = earningsApi(http);
const PERIODS = ['today', 'week', 'month', 'all'] as const;

const inputStyle = {
  backgroundColor: tokens.color.surface,
  color: tokens.color.ink,
  borderRadius: tokens.radius.md,
  padding: 12,
  marginBottom: 8,
} as const;

export default function Earnings() {
  const { t, translate } = useTranslation();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('week');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'sinpe' | 'bank_transfer'>('sinpe');
  const [sinpePhone, setSinpePhone] = useState('');
  const [sinpeName, setSinpeName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, any>>({});
  const [receiptLoading, setReceiptLoading] = useState<string | null>(null);

  const earn = useQuery({
    queryKey: ['earnings', period],
    queryFn: () => api.earnings(period),
  });
  const bal = useQuery({ queryKey: ['withdraw', 'balance'], queryFn: () => api.balance() });
  const hist = useQuery({ queryKey: ['withdraw', 'mine'], queryFn: () => api.myWithdrawals() });

  const e: any = earn.data ?? {};
  const available = Number((bal.data as any)?.availableBalance ?? 0);
  const moves = Array.isArray(hist.data) ? hist.data : [];

  const request = useMutation({
    mutationFn: () =>
      api.request({
        amount: Math.round(Number(amount)) || 0,
        paymentMethod: method,
        sinpePhone: method === 'sinpe' ? sinpePhone.trim() : undefined,
        sinpeName: method === 'sinpe' ? sinpeName.trim() : undefined,
        accountNumber: method === 'bank_transfer' ? accountNumber.trim() : undefined,
      }),
    onSuccess: () => {
      Alert.alert(t.withdraw.requested);
      setAmount('');
      void qc.invalidateQueries({ queryKey: ['withdraw'] });
    },
    onError: () => Alert.alert(t.withdraw.failed),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.cancelWithdrawal(id),
    onSuccess: () => {
      Alert.alert(t.withdraw.cancelled);
      void qc.invalidateQueries({ queryKey: ['withdraw'] });
    },
    onError: () => Alert.alert(t.withdraw.cancelFailed),
  });

  const toggleReceipt = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (receipts[id]) return;
    setReceiptLoading(id);
    try {
      const data = await api.receipt(id);
      setReceipts((prev) => ({ ...prev, [id]: data ?? null }));
    } catch {
      setReceipts((prev) => ({ ...prev, [id]: { error: true } }));
    } finally {
      setReceiptLoading(null);
    }
  };

  const refreshing = earn.isRefetching || bal.isRefetching || hist.isRefetching;
  const refetchAll = () => {
    void earn.refetch();
    void bal.refetch();
    void hist.refetch();
  };

  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
        {t.earnings.title}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
        {PERIODS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={{
              flex: 1,
              borderRadius: tokens.radius.md,
              paddingVertical: 8,
              alignItems: 'center',
              backgroundColor: period === p ? tokens.color.kiwi : tokens.color.surface,
            }}
          >
            <Text
              style={{
                color: period === p ? '#fff' : tokens.color.ink,
                fontWeight: '600',
                fontSize: 12,
              }}
            >
              {t.analytics[p as 'today' | 'week' | 'month']}
              {p === 'all' ? '∞' : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1, marginTop: 12 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} />}
      >
        <View
          style={{
            backgroundColor: tokens.color.surface,
            borderRadius: tokens.radius.lg,
            padding: tokens.space[4],
          }}
        >
          <Text style={{ color: tokens.color.muted, fontSize: 12 }}>
            {t.earnings.totalEarnings}
          </Text>
          <Text style={{ color: tokens.color.ink, fontSize: 28, fontWeight: '800' }}>
            ₡{Number(e.totalEarnings ?? 0).toLocaleString()}
          </Text>
          <Text style={{ color: tokens.color.muted, marginTop: 4 }}>
            {e.totalTrips ?? 0} {t.driver.totalTrips.toLowerCase()}
          </Text>
        </View>

        <Text
          style={{ color: tokens.color.ink, fontWeight: '700', marginTop: 16, marginBottom: 8 }}
        >
          {t.withdraw.title}
        </Text>
        <Text style={{ color: tokens.color.muted, marginBottom: 8 }}>
          {translate('withdraw.balance', { amount: available.toLocaleString() })}
        </Text>
        <TextInput
          placeholder={t.withdraw.amount}
          placeholderTextColor={tokens.color.muted}
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          style={inputStyle}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {(['sinpe', 'bank_transfer'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMethod(m)}
              style={{
                flex: 1,
                borderRadius: tokens.radius.md,
                paddingVertical: 10,
                alignItems: 'center',
                backgroundColor: method === m ? tokens.color.kiwi : tokens.color.surface,
              }}
            >
              <Text
                style={{
                  color: method === m ? '#fff' : tokens.color.ink,
                  fontWeight: '600',
                }}
              >
                {m === 'sinpe' ? t.withdraw.sinpe : t.withdraw.bank}
              </Text>
            </Pressable>
          ))}
        </View>
        {method === 'sinpe' ? (
          <>
            <TextInput
              placeholder={t.withdraw.sinpePhone}
              placeholderTextColor={tokens.color.muted}
              value={sinpePhone}
              onChangeText={setSinpePhone}
              keyboardType="phone-pad"
              style={inputStyle}
            />
            <TextInput
              placeholder={t.withdraw.sinpeName}
              placeholderTextColor={tokens.color.muted}
              value={sinpeName}
              onChangeText={setSinpeName}
              style={inputStyle}
            />
          </>
        ) : (
          <TextInput
            placeholder={t.withdraw.accountNumber}
            placeholderTextColor={tokens.color.muted}
            value={accountNumber}
            onChangeText={setAccountNumber}
            autoCapitalize="characters"
            style={inputStyle}
          />
        )}
        <Button
          label={request.isPending ? t.withdraw.requesting : t.withdraw.request}
          loading={request.isPending}
          onPress={() => request.mutate()}
        />

        <Text
          style={{ color: tokens.color.ink, fontWeight: '700', marginTop: 16, marginBottom: 8 }}
        >
          {t.withdraw.history}
        </Text>
        {moves.length === 0 ? (
          <Text style={{ color: tokens.color.muted }}>{t.withdraw.empty}</Text>
        ) : (
          moves.map((w: any) => (
            <View key={w.id}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: tokens.color.surface,
                  borderRadius: tokens.radius.md,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: tokens.color.ink, fontWeight: '700' }}>
                    ₡{Number(w.amount ?? 0).toLocaleString()}
                  </Text>
                  <Text style={{ color: tokens.color.muted, fontSize: 12 }}>{w.status ?? ''}</Text>
                </View>
                <Pressable onPress={() => void toggleReceipt(w.id)} style={{ padding: 6 }}>
                  <Text style={{ color: tokens.color.kiwi, fontWeight: '600' }}>
                    {t.withdraw.receiptShow}
                  </Text>
                </Pressable>
                {w.status === 'pending' && (
                  <Pressable onPress={() => cancel.mutate(w.id)} style={{ padding: 6 }}>
                    <Text style={{ color: '#ef4444', fontWeight: '600' }}>{t.withdraw.cancel}</Text>
                  </Pressable>
                )}
              </View>
              {expandedId === w.id && (
                <View
                  style={{
                    backgroundColor: tokens.color.surface,
                    borderRadius: tokens.radius.md,
                    padding: 12,
                    marginTop: -4,
                    marginBottom: 8,
                  }}
                >
                  {receiptLoading === w.id ? (
                    <Text style={{ color: tokens.color.muted }}>…</Text>
                  ) : !receipts[w.id] || receipts[w.id].error ? (
                    <Text style={{ color: tokens.color.muted }}>{t.withdraw.receiptEmpty}</Text>
                  ) : (
                    <View>
                      <Text style={{ color: tokens.color.ink, fontWeight: '700', marginBottom: 4 }}>
                        {t.withdraw.receiptTitle} ({receipts[w.id].tripCount ?? 0})
                      </Text>
                      {(receipts[w.id].trips ?? []).slice(0, 30).map((tr: any) => (
                        <View
                          key={tr.orderId}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginBottom: 2,
                          }}
                        >
                          <Text style={{ color: tokens.color.muted, flex: 1 }} numberOfLines={1}>
                            {tr.merchant ?? tr.orderId.slice(0, 8)}
                          </Text>
                          <Text style={{ color: tokens.color.ink }}>
                            ₡{Number(tr.payout ?? 0).toLocaleString()}
                          </Text>
                        </View>
                      ))}
                      <Text style={{ color: tokens.color.ink, fontWeight: '700', marginTop: 4 }}>
                        Total: ₡{Number(receipts[w.id].tripsTotal ?? 0).toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
