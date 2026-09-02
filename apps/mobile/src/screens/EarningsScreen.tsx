import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { colors, gradients, shadows } from '../utils/theme';
import { api } from '../services/api';

export default function EarningsScreen() {
  const { isDark } = useTheme();
  const [period, setPeriod] = useState('week');
  const [earnings, setEarnings] = useState({
    total: 0,
    average: 0,
    deliveries: 0,
    breakdown: { trips: 0, tips: 0, bonus: 0 },
  });

  useEffect(() => {
    fetchEarnings();
  }, [period]);

  const fetchEarnings = async () => {
    try {
      const data = await api.getEarnings(period);
      setEarnings(data);
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₡${amount.toLocaleString()}`;
  };

  return (
    <SafeAreaView style={[styles.container, { 
      backgroundColor: isDark ? colors.surface[950] : colors.surface[50] 
    }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
          <Text style={styles.totalAmount}>{formatCurrency(earnings.total)}</Text>
          <Text style={styles.totalPeriod}>
            {period === 'week' ? 'Esta semana' : 
             period === 'month' ? 'Este mes' : 'Hoy'}
          </Text>
        </LinearGradient>

        {/* Period Selector */}
        <View style={[styles.periodContainer, { 
          backgroundColor: isDark ? colors.surface[800] : colors.surface[100] 
        }]}>
          {(['today', 'week', 'month'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodTab, period === p && styles.periodTabActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff' 
          }]}>
            <Ionicons name="cube" size={24} color={colors.kiwi[500]} />
            <Text style={[styles.statValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {earnings.deliveries}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Entregas
            </Text>
          </View>
          <View style={[styles.statCard, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff' 
          }]}>
            <Ionicons name="trending-up" size={24} color={colors.gold[500]} />
            <Text style={[styles.statValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {formatCurrency(earnings.average)}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Promedio
            </Text>
          </View>
        </View>

        {/* Breakdown */}
        <View style={[styles.breakdownCard, { 
          backgroundColor: isDark ? colors.surface[800] : '#fff' 
        }, shadows.soft]}>
          <Text style={[styles.breakdownTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Desglose
          </Text>
          
          <View style={styles.breakdownItem}>
            <View style={styles.breakdownLeft}>
              <View style={[styles.breakdownDot, { backgroundColor: colors.kiwi[500] }]} />
              <Text style={[styles.breakdownLabel, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                Comisión por viaje
              </Text>
            </View>
            <Text style={[styles.breakdownValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {formatCurrency(earnings.breakdown.trips)}
            </Text>
          </View>

          <View style={styles.breakdownItem}>
            <View style={styles.breakdownLeft}>
              <View style={[styles.breakdownDot, { backgroundColor: colors.gold[500] }]} />
              <Text style={[styles.breakdownLabel, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                Propinas
              </Text>
            </View>
            <Text style={[styles.breakdownValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {formatCurrency(earnings.breakdown.tips)}
            </Text>
          </View>

          <View style={styles.breakdownItem}>
            <View style={styles.breakdownLeft}>
              <View style={[styles.breakdownDot, { backgroundColor: colors.bark[500] }]} />
              <Text style={[styles.breakdownLabel, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                Bonificaciones
              </Text>
            </View>
            <Text style={[styles.breakdownValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {formatCurrency(earnings.breakdown.bonus)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  totalCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 42,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  totalPeriod: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  periodContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  periodTabActive: {
    backgroundColor: '#fff',
    ...shadows.soft,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface[500],
  },
  periodTextActive: {
    color: colors.kiwi[600],
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    ...shadows.soft,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  breakdownCard: {
    borderRadius: 20,
    padding: 20,
    ...shadows.soft,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[100],
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  breakdownLabel: {
    fontSize: 14,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});
