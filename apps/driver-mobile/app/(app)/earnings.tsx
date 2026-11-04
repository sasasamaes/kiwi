import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Screen,
  Button,
  Card,
  GradientHeader,
  SegmentedTabs,
  Stat,
  EmptyState,
} from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { earningsApi } from '../../src/api/earnings';
import { http } from '../../src/api/client';

const api = earningsApi(http);
const PERIODS = ['today', 'yesterday', 'week', 'month', 'all'] as const;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export default function Earnings() {
  const { t, translate } = useTranslation();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<(typeof PERIODS)[number] | 'custom'>('week');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'sinpe' | 'bank_transfer'>('sinpe');
  const [sinpePhone, setSinpePhone] = useState('');
  const [sinpeName, setSinpeName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, any>>({});
  const [receiptLoading, setReceiptLoading] = useState<string | null>(null);

  const earn = useQuery({
    queryKey: ['earnings', period, range?.from ?? '', range?.to ?? ''],
    queryFn: () =>
      api.earnings(
        period,
        period === 'custom' ? range?.from : undefined,
        period === 'custom' ? range?.to : undefined,
      ),
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
      <Text className="mb-4 font-display text-lg font-semibold text-surface-800 dark:text-surface-100">
        {t.earnings.title}
      </Text>

      {/* Total par PWA */}
      <GradientHeader>
        <Text className="text-sm font-medium text-white/80">
          {period === 'custom' && range ? `${range.from} – ${range.to}` : t.earnings.totalEarnings}
        </Text>
        <Text className="mt-1 text-4xl font-bold text-white">
          ₡{Number(e.totalEarnings ?? 0).toLocaleString()}
        </Text>
        <Text className="mt-4 text-sm text-white/80">
          {e.totalTrips ?? 0} {t.driver.totalTrips.toLowerCase()}
        </Text>
      </GradientHeader>

      <View className="mt-4">
        <SegmentedTabs
          value={period === 'custom' ? 'week' : period}
          onChange={(p) => setPeriod(p)}
          options={[
            { id: 'today', label: t.earnings.today },
            { id: 'yesterday', label: t.earnings.yesterday },
            { id: 'week', label: t.analytics.week },
            { id: 'month', label: t.analytics.month },
            { id: 'all', label: t.driverRanking.all },
          ]}
        />
      </View>

      {/* Rango libre */}
      <Card>
        <View className="flex-row items-end gap-2">
          <View className="flex-1">
            <Text className="mb-1 text-xs font-medium text-surface-500 dark:text-surface-400">
              {t.earnings.from}
            </Text>
            <TextInput
              placeholder="AAAA-MM-DD"
              placeholderTextColor="#94a3b8"
              value={from}
              onChangeText={(v) => setFrom(v.replace(/[^0-9-]/g, '').slice(0, 10))}
              keyboardType="numbers-and-punctuation"
              className="rounded-lg bg-surface-100 px-3 py-2.5 text-sm text-surface-800 dark:bg-surface-700 dark:text-surface-100"
            />
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-xs font-medium text-surface-500 dark:text-surface-400">
              {t.earnings.to}
            </Text>
            <TextInput
              placeholder="AAAA-MM-DD"
              placeholderTextColor="#94a3b8"
              value={to}
              onChangeText={(v) => setTo(v.replace(/[^0-9-]/g, '').slice(0, 10))}
              keyboardType="numbers-and-punctuation"
              className="rounded-lg bg-surface-100 px-3 py-2.5 text-sm text-surface-800 dark:bg-surface-700 dark:text-surface-100"
            />
          </View>
          <Pressable
            onPress={() => {
              if (!ISO_DAY.test(from.trim())) {
                Alert.alert(t.earnings.invalidRange);
                return;
              }
              setRange({
                from: from.trim(),
                to: ISO_DAY.test(to.trim()) ? to.trim() : from.trim(),
              });
              setPeriod('custom');
            }}
            className={`rounded-lg px-4 py-2.5 ${period === 'custom' ? 'bg-kiwi-700' : 'bg-surface-400 dark:bg-surface-600'}`}
          >
            <Text className="text-sm font-semibold text-white">{t.earnings.apply}</Text>
          </Pressable>
        </View>
      </Card>

      <ScrollView
        style={{ flex: 1, marginTop: 12 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} />}
      >
        {/* Stats par PWA */}
        <View className="mb-4 flex-row gap-3">
          <View className="flex-1">
            <Stat value={String(e.totalTrips ?? 0)} label={t.driver.totalTrips} />
          </View>
          <View className="flex-1">
            <Stat
              value={`₡${Number(e.averagePerTrip ?? (e.totalTrips ? Math.round(Number(e.totalEarnings ?? 0) / Number(e.totalTrips)) : 0)).toLocaleString()}`}
              label={t.earnings.averagePerDelivery}
              accent="kiwi"
            />
          </View>
        </View>

        <Card>
          <Text className="mb-1 text-sm font-semibold text-surface-800 dark:text-surface-100">
            {t.withdraw.title}
          </Text>
          <Text className="mb-2 text-xs text-surface-500 dark:text-surface-400">
            {translate('withdraw.balance', { amount: available.toLocaleString() })}
          </Text>
          <TextInput
            placeholder={t.withdraw.amount}
            placeholderTextColor="#94a3b8"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            className="mb-2 rounded-lg bg-surface-100 px-3 py-2.5 text-sm text-surface-800 dark:bg-surface-700 dark:text-surface-100"
          />
          <View className="mb-2 flex-row gap-2">
            {(['sinpe', 'bank_transfer'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMethod(m)}
                className={`flex-1 items-center rounded-lg py-2.5 ${method === m ? 'bg-kiwi-700' : 'bg-surface-100 dark:bg-surface-700'}`}
              >
                <Text
                  className={`font-semibold ${method === m ? 'text-white' : 'text-surface-800 dark:text-surface-100'}`}
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
                placeholderTextColor="#94a3b8"
                value={sinpePhone}
                onChangeText={setSinpePhone}
                keyboardType="phone-pad"
                className="mb-2 rounded-lg bg-surface-100 px-3 py-2.5 text-sm text-surface-800 dark:bg-surface-700 dark:text-surface-100"
              />
              <TextInput
                placeholder={t.withdraw.sinpeName}
                placeholderTextColor="#94a3b8"
                value={sinpeName}
                onChangeText={setSinpeName}
                className="mb-2 rounded-lg bg-surface-100 px-3 py-2.5 text-sm text-surface-800 dark:bg-surface-700 dark:text-surface-100"
              />
            </>
          ) : (
            <TextInput
              placeholder={t.withdraw.accountNumber}
              placeholderTextColor="#94a3b8"
              value={accountNumber}
              onChangeText={setAccountNumber}
              autoCapitalize="characters"
              className="mb-2 rounded-lg bg-surface-100 px-3 py-2.5 text-sm text-surface-800 dark:bg-surface-700 dark:text-surface-100"
            />
          )}
          <Button
            label={request.isPending ? t.withdraw.requesting : t.withdraw.request}
            loading={request.isPending}
            onPress={() => request.mutate()}
          />
        </Card>

        <Text className="mb-2 mt-4 text-sm font-semibold text-surface-800 dark:text-surface-100">
          {t.withdraw.history}
        </Text>
        {moves.length === 0 ? (
          <EmptyState title={t.withdraw.empty} />
        ) : (
          moves.map((w: any) => (
            <View key={w.id} className="mb-2">
              <Card>
                <Pressable
                  onPress={() => void toggleReceipt(w.id)}
                  className="flex-row items-center justify-between"
                >
                  <View className="flex-1">
                    <Text className="font-bold text-surface-800 dark:text-surface-100">
                      ₡{Number(w.amount ?? 0).toLocaleString()}
                    </Text>
                    <Text className="text-xs text-surface-500 dark:text-surface-400">
                      {w.status ?? ''}
                    </Text>
                  </View>
                  <Text className="px-1.5 py-1 font-semibold text-kiwi-700 dark:text-kiwi-400">
                    {t.withdraw.receiptShow}
                  </Text>
                  {w.status === 'pending' && (
                    <Pressable onPress={() => cancel.mutate(w.id)} className="px-1.5 py-1">
                      <Text className="font-semibold text-red-500">{t.withdraw.cancel}</Text>
                    </Pressable>
                  )}
                </Pressable>
                {expandedId === w.id && (
                  <View className="mt-2 border-t border-surface-200/60 pt-2 dark:border-surface-700">
                    {receiptLoading === w.id ? (
                      <Text className="text-surface-500 dark:text-surface-400">…</Text>
                    ) : !receipts[w.id] || receipts[w.id].error ? (
                      <Text className="text-surface-500 dark:text-surface-400">
                        {t.withdraw.receiptEmpty}
                      </Text>
                    ) : (
                      <View>
                        <Text className="mb-1 font-bold text-surface-800 dark:text-surface-100">
                          {t.withdraw.receiptTitle} ({receipts[w.id].tripCount ?? 0})
                        </Text>
                        {(receipts[w.id].trips ?? []).slice(0, 30).map((tr: any) => (
                          <View key={tr.orderId} className="mb-0.5 flex-row justify-between">
                            <Text
                              className="flex-1 text-surface-500 dark:text-surface-400"
                              numberOfLines={1}
                            >
                              {tr.merchant ?? tr.orderId.slice(0, 8)}
                            </Text>
                            <Text className="text-surface-800 dark:text-surface-100">
                              ₡{Number(tr.payout ?? 0).toLocaleString()}
                            </Text>
                          </View>
                        ))}
                        <Text className="mt-1 font-bold text-surface-800 dark:text-surface-100">
                          Total: ₡{Number(receipts[w.id].tripsTotal ?? 0).toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </Card>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
