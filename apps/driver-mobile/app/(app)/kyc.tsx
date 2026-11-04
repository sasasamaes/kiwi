import { Alert, Linking, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Button, Card, EmptyState } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { kycApi } from '../../src/api/kyc';
import { http } from '../../src/api/client';

const api = kycApi(http);

const STATUS_LABEL: Record<
  string,
  'pending' | 'submitted' | 'underReview' | 'approved' | 'rejected'
> = {
  pending: 'pending',
  submitted: 'submitted',
  under_review: 'underReview',
  approved: 'approved',
  rejected: 'rejected',
};

export default function Kyc() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isError, refetch, isRefetching } = useQuery({
    queryKey: ['kyc', 'status'],
    queryFn: () => api.status(),
  });

  const raw = String((data as any)?.status ?? 'pending').toLowerCase();
  const key = STATUS_LABEL[raw] ?? 'pending';
  const done = key === 'approved';

  const start = useMutation({
    mutationFn: () => api.startDidit(),
    onSuccess: async (res) => {
      if (res?.url) {
        try {
          await Linking.openURL(res.url);
        } catch {
          Alert.alert(t.kyc.loadFailed);
        }
      }
      void qc.invalidateQueries({ queryKey: ['kyc', 'status'] });
    },
    onError: () => Alert.alert(t.kyc.loadFailed),
  });

  const refresh = useMutation({
    mutationFn: () => api.refreshDidit(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kyc', 'status'] });
      void refetch();
    },
    onError: () => Alert.alert(t.kyc.loadFailed),
  });

  return (
    <Screen>
      <Text className="text-xl font-bold text-surface-800 dark:text-surface-100">
        {t.kyc.title}
      </Text>
      <Text className="mt-1 text-sm text-surface-500 dark:text-surface-400">{t.kyc.subtitle}</Text>

      <View className="mt-3">
        <Card>
          {isError ? (
            <EmptyState title={t.kyc.loadFailed} />
          ) : (
            <Text className="text-base font-bold text-surface-800 dark:text-surface-100">
              {t.kyc.status}: {t.kyc[key]}
            </Text>
          )}
        </Card>
      </View>

      <View className="mt-3 gap-2">
        {!done && (
          <Button
            label={t.kyc.verifyNow}
            loading={start.isPending}
            onPress={() => start.mutate()}
          />
        )}
        <Button
          label={t.kyc.refresh}
          variant="secondary"
          loading={refresh.isPending || isRefetching}
          onPress={() => refresh.mutate()}
        />
      </View>
    </Screen>
  );
}
