import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { colors, gradients, shadows } from '../utils/theme';
import { api } from '../services/api';
import OrderCard from '../components/OrderCard';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [isOnline, setIsOnline] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ trips: 0, earnings: 0, rating: 5.0 });
  const [refreshing, setRefreshing] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchOrders();
    fetchStats();
    startPulse();
  }, [isOnline]);

  const startPulse = () => {
    if (isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  };

  const fetchOrders = async () => {
    try {
      const data = await api.getAvailableOrders();
      setOrders(data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.getDriverProfile();
      setStats({
        trips: data.totalTrips || 0,
        earnings: data.totalEarnings || 0,
        rating: Number(data.rating) || 5.0,
      });
      setIsOnline(data.status === 'available');
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchOrders(), fetchStats()]);
    setRefreshing(false);
  };

  const toggleOnline = async () => {
    const newStatus = !isOnline;
    try {
      await api.updateDriverStatus(newStatus ? 'available' : 'offline');
      setIsOnline(newStatus);
      if (newStatus) fetchOrders();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      await api.acceptOrder(orderId);
      navigation.navigate('OrderDetail', { orderId });
    } catch (error) {
      console.error('Failed to accept order:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { 
      backgroundColor: isDark ? colors.surface[950] : colors.surface[50] 
    }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              ¡Hola! 👋
            </Text>
            <Text style={[styles.name, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {user?.driverProfile?.fullName || 'Repartidor'}
            </Text>
          </View>
          <TouchableOpacity style={[styles.notificationButton, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff' 
          }]}>
            <Ionicons name="notifications-outline" size={22} color={isDark ? colors.surface[100] : colors.surface[700]} />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>

        {/* Status Card */}
        <LinearGradient
          colors={isOnline ? gradients.kiwi : [colors.surface[400], colors.surface[500]]}
          style={[styles.statusCard, shadows.large]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.statusTitle}>Estado</Text>
              <Text style={styles.statusSubtitle}>
                {isOnline ? 'En línea - Recibiendo pedidos' : 'Desconectado'}
              </Text>
            </View>
            <TouchableOpacity onPress={toggleOnline}>
              <Animated.View style={[styles.statusToggle, { transform: [{ scale: isOnline ? pulseAnim : 1 }] }]}>
                <View style={[styles.toggleTrack, { backgroundColor: isOnline ? '#fff' : 'rgba(255,255,255,0.2)' }]}>
                  <View style={[styles.toggleThumb, { 
                    backgroundColor: isOnline ? colors.kiwi[500] : colors.surface[300],
                    transform: [{ translateX: isOnline ? 28 : 0 }],
                  }]}>
                    <Ionicons 
                      name={isOnline ? 'checkmark' : 'close'} 
                      size={16} 
                      color="#fff" 
                    />
                  </View>
                </View>
              </Animated.View>
            </TouchableOpacity>
          </View>

          {isOnline && (
            <View style={styles.statusStats}>
              <View style={styles.statusStat}>
                <Ionicons name="radio" size={14} color="#fff" />
                <Text style={styles.statusText}>En línea</Text>
              </View>
              <View style={styles.statusStat}>
                <Ionicons name="location" size={14} color="#fff" />
                <Text style={styles.statusText}>GPS activo</Text>
              </View>
            </View>
          )}
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff' 
          }]}>
            <Text style={styles.statValue}>{stats.trips}</Text>
            <Text style={[styles.statLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Viajes
            </Text>
          </View>
          <View style={[styles.statCard, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff' 
          }]}>
            <Text style={[styles.statValue, { color: colors.gold[600] }]}>
              ₡{(stats.earnings / 1000).toFixed(0)}k
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Ganancias
            </Text>
          </View>
          <View style={[styles.statCard, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff' 
          }]}>
            <Text style={[styles.statValue, { color: colors.gold[500] }]}>
              ⭐ {stats.rating.toFixed(1)}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Rating
            </Text>
          </View>
        </View>

        {/* Available Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              Pedidos Disponibles
            </Text>
            <Text style={[styles.sectionCount, { color: colors.kiwi[500] }]}>
              {orders.length}
            </Text>
          </View>

          {!isOnline ? (
            <View style={[styles.emptyState, { 
              backgroundColor: isDark ? colors.surface[800] : '#fff' 
            }]}>
              <Ionicons name="wifi-off" size={48} color={colors.surface[300]} />
              <Text style={[styles.emptyTitle, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                Estás desconectado
              </Text>
              <Text style={[styles.emptyText, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                Conectate para ver pedidos disponibles
              </Text>
            </View>
          ) : orders.length === 0 ? (
            <View style={[styles.emptyState, { 
              backgroundColor: isDark ? colors.surface[800] : '#fff' 
            }]}>
              <Ionicons name="search" size={48} color={colors.surface[300]} />
              <Text style={[styles.emptyTitle, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                No hay pedidos
              </Text>
              <Text style={[styles.emptyText, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                Esperando nuevos pedidos cerca de ti...
              </Text>
            </View>
          ) : (
            <View style={styles.ordersList}>
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onAccept={() => handleAcceptOrder(order.id)}
                  onReject={() => console.log('Reject', order.id)}
                />
              ))}
            </View>
          )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 20,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    marginBottom: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.soft,
  },
  notificationBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red[500],
  },
  statusCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statusSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statusToggle: {
    marginLeft: 16,
  },
  toggleTrack: {
    width: 56,
    height: 32,
    borderRadius: 16,
    padding: 2,
  },
  toggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusStats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
  },
  statusStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
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
    ...shadows.soft,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.kiwi[500],
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  ordersList: {
    gap: 12,
  },
  emptyState: {
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    ...shadows.soft,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
