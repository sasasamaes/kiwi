import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { colors, gradients, shadows } from '../utils/theme';
import { api, Earnings } from '../services/api';

export default function EarningsScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const [period, setPeriod] = useState('week');
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchEarnings();
  }, [period]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const data = await api.getEarnings(period);
      setEarnings(data);
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEarnings();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => `₡${amount.toLocaleString()}`;

  if (loading && !earnings) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.surface[950] : colors.surface[50] }]>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.kiwi[500]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { 
      backgroundColor: isDark ? colors.surface[950] : colors.surface[50] 
    }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.kiwi[500]} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Mis Ganancias
          </Text>
        </View>

        {/* Total Earnings Card */}
        <LinearGradient
          colors={gradients.kiwi}
          style={[styles.totalCard, shadows.large]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.totalLabel}>Ganancias totales</Text>
          <Text style={styles.totalAmount}>{formatCurrency(earnings?.totalEarnings || 0)}</Text>
          <Text style={styles.totalPeriod}>
            {period === 'today' ? 'Hoy' : period === 'week' ? 'Esta semana' : period === 'month' ? 'Este mes' : 'Total'}
          </Text>
        </LinearGradient>

        {/* Period Selector */}
        <View style={[styles.periodContainer, { 
          backgroundColor: isDark ? colors.surface[800] : colors.surface[100] 
        }]}>
          {(['today', 'week', 'month', 'all'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodTab, period === p && styles.periodTabActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Total'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: isDark ? colors.surface[800] : '#fff' }]}>
            <Ionicons name="cube" size={24} color={colors.kiwi[500]} />
            <Text style={[styles.statValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {earnings?.totalTrips || 0}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Entregas
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? colors.surface[800] : '#fff' }]}>
            <Ionicons name="trending-up" size={24} color={colors.gold[500]} />
            <Text style={[styles.statValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {formatCurrency(earnings?.averagePerTrip || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Promedio/viaje
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? colors.surface[800] : '#fff' }]}>
            <Ionicons name="time" size={24} color={colors.bark[500]} />
            <Text style={[styles.statValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {formatCurrency(earnings?.earningsPerHour || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Por hora
            </Text>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={[styles.summaryCard, { backgroundColor: isDark ? colors.surface[800] : '#fff' }, shadows.soft]}>
          <Text style={[styles.summaryTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Resumen
          </Text>
          
          <View style={styles.summaryItem}>
            <View style={styles.summaryLeft}>
              <Ionicons name="today" size={16} color={colors.kiwi[500]} />
              <Text style={[styles.summaryLabel, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                Hoy
              </Text>
            </View>
            <Text style={[styles.summaryValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {formatCurrency(earnings?.summary?.today || 0)}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <View style={styles.summaryLeft}>
              <Ionicons name="calendar" size={16} color={colors.gold[500]} />
              <Text style={[styles.summaryLabel, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                Esta semana
              </Text>
            </View>
            <Text style={[styles.summaryValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {formatCurrency(earnings?.summary?.thisWeek || 0)}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <View style={styles.summaryLeft}>
              <Ionicons name="calendar-outline" size={16} color={colors.bark[500]} />
              <Text style={[styles.summaryLabel, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                Este mes
              </Text>
            </View>
            <Text style={[styles.summaryValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {formatCurrency(earnings?.summary?.thisMonth || 0)}
            </Text>
          </View>
        </View>

        {/* Recent Transactions */}
        {earnings?.transactions && earnings.transactions.length > 0 && (
          <View style={[styles.transactionsCard, { backgroundColor: isDark ? colors.surface[800] : '#fff' }, shadows.soft]}>
            <Text style={[styles.transactionsTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              Últimas transacciones
            </Text>
            {earnings.transactions.slice(0, 5).map((tx: any, index: number) => (
              <View key={tx.id || index} style={styles.transactionItem}>
                <View style={styles.transactionLeft}>
                  <View style={[styles.transactionDot, { backgroundColor: colors.kiwi[500] }]} />
                  <View>
                    <Text style={[styles.transactionName, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
                      {tx.merchantName || 'Pedido'}
                    </Text>
                    <Text style={[styles.transactionAddress, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                      {tx.deliveryAddress?.substring(0, 30)}...
                    </Text>
                  </View>
                </View>
                <View style={styles.transactionRight}>
                  <Text style={[styles.transactionAmount, { color: colors.kiwi[600] }]}>
                    +{formatCurrency(tx.amount || 0)}
                  </Text>
                  <Text style={[styles.transactionDate, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                    {new Date(tx.date).toLocaleDateString('es-CR', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Withdraw Button */}
        <TouchableOpacity
          style={styles.withdrawButton}
          onPress={() => navigation.navigate('Withdraw')}
        >
          <LinearGradient colors={gradients.kiwi} style={styles.withdrawGradient}>
            <Ionicons name="wallet-outline" size={20} color="#fff" />
            <Text style={styles.withdrawText}>Retirar ganancias</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700' },
  totalCard: { borderRadius: 20, padding: 24, marginBottom: 16 },
  totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  totalAmount: { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4 },
  totalPeriod: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 },
  periodContainer: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 16 },
  periodTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  periodTabActive: { backgroundColor: colors.kiwi[500] },
  periodText: { fontSize: 13, fontWeight: '600', color: colors.surface[500] },
  periodTextActive: { color: '#fff' },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, padding: 14, borderRadius: 16, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  statLabel: { fontSize: 11, marginTop: 4 },
  summaryCard: { borderRadius: 16, padding: 16, marginBottom: 16 },
  summaryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  transactionsCard: { borderRadius: 16, padding: 16, marginBottom: 16 },
  transactionsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  transactionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  transactionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  transactionDot: { width: 8, height: 8, borderRadius: 4 },
  transactionName: { fontSize: 14, fontWeight: '600' },
  transactionAddress: { fontSize: 12, marginTop: 2 },
  transactionRight: { alignItems: 'flex-end' },
  transactionAmount: { fontSize: 14, fontWeight: '700' },
  transactionDate: { fontSize: 11, marginTop: 2 },
  withdrawButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  withdrawGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  withdrawText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
