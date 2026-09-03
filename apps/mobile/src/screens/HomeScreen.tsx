import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { colors, gradients, shadows } from '../utils/theme';
import { api, connectSocket, disconnectSocket, onSocket, Order } from '../services/api';
import OrderCard from '../components/OrderCard';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [isOnline, setIsOnline] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({ trips: 0, earnings: 0, rating: 5.0 });
  const [refreshing, setRefreshing] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchStats();
    setupSocket();
    startPulse();

    return () => {
      disconnectSocket();
    };
  }, [isOnline]);

  const setupSocket = async () => {
    try {
      const token = await import('expo-secure-store').then(m => m.default.getItemAsync('auth_token'));
      if (token) {
        const sock = await connectSocket(token);
        if (sock) {
          sock.on('connect', () => setSocketConnected(true));
          sock.on('disconnect', () => setSocketConnected(false));

          // Listen for new orders assigned to this driver
          onSocket('order:assigned', (data: any) => {
            console.log('📦 New order assigned:', data);
            fetchOrders();
            Alert.alert('📦 Nuevo Pedido', data.message || 'Te asignaron un nuevo pedido');
          });

          // Listen for order status changes
          onSocket('order:statusChanged', (data: any) => {
            console.log('📋 Order status changed:', data);
            fetchOrders();
          });
        }
      }
    } catch (error) {
      console.warn('Socket setup failed:', error);
    }
  };

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
      setOrders(data || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const driverProfile = await api.getDriverProfile();
      setStats({
        trips: driverProfile.totalTrips || 0,
        earnings: 0, // Will be fetched from earnings endpoint
        rating: Number(driverProfile.rating) || 5.0,
      });
      setIsOnline(driverProfile.status === 'available');

      // Fetch earnings separately
      try {
        const earnings = await api.getEarnings('week');
        setStats(prev => ({
          ...prev,
          earnings: earnings.totalEarnings || 0,
        }));
      } catch {}
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
      if (newStatus) {
        fetchOrders();
        startPulse();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      Alert.alert('Error', 'No se pudo cambiar el estado');
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      await api.acceptOrder(orderId);
      Alert.alert('✅ Pedido aceptado', 'Ve a recoger el pedido', [
        { text: 'Ver detalle', onPress: () => navigation.navigate('OrderDetail', { orderId }) },
      ]);
      fetchOrders(); // Refresh available orders
    } catch (error: any) {
      const message = error.response?.data?.message || 'No se pudo aceptar el pedido';
      Alert.alert('Error', message);
    }
  };

  const formatCurrency = (amount: number) => `₡${amount.toLocaleString()}`;

  return (
    <SafeAreaView style={[styles.container, { 
      backgroundColor: isDark ? colors.surface[950] : colors.surface[50] 
    }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.kiwi[500]} />
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
          <View style={styles.headerRight}>
            {/* Socket status indicator */}
            <View style={[styles.socketIndicator, { backgroundColor: socketConnected ? '#22c55e' : '#ef4444' }]} />
            <TouchableOpacity 
              style={[styles.notificationButton, { 
                backgroundColor: isDark ? colors.surface[800] : '#fff' 
              }]}
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons name="notifications-outline" size={22} color={isDark ? colors.surface[100] : colors.surface[700]} />
            </TouchableOpacity>
          </View>
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

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={[styles.quickStat, { backgroundColor: isDark ? colors.surface[800] : '#fff' }]}>
            <Ionicons name="cube" size={20} color={colors.kiwi[500]} />
            <Text style={[styles.quickStatValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {stats.trips}
            </Text>
            <Text style={[styles.quickStatLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Viajes
            </Text>
          </View>
          <View style={[styles.quickStat, { backgroundColor: isDark ? colors.surface[800] : '#fff' }]}>
            <Ionicons name="wallet" size={20} color={colors.gold[500]} />
            <Text style={[styles.quickStatValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {formatCurrency(stats.earnings)}
            </Text>
            <Text style={[styles.quickStatLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Esta semana
            </Text>
          </View>
          <View style={[styles.quickStat, { backgroundColor: isDark ? colors.surface[800] : '#fff' }]}>
            <Ionicons name="star" size={20} color={colors.gold[500]} />
            <Text style={[styles.quickStatValue, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {stats.rating.toFixed(1)}
            </Text>
            <Text style={[styles.quickStatLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Rating
            </Text>
          </View>
        </View>

        {/* Available Orders */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Pedidos disponibles ({orders.length})
          </Text>

          {orders.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: isDark ? colors.surface[800] : '#fff' }]}>
              <Ionicons name="cube-outline" size={48} color={colors.surface[300]} />
              <Text style={[styles.emptyText, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                {isOnline ? 'No hay pedidos disponibles' : 'Conectate para recibir pedidos'}
              </Text>
            </View>
          ) : (
            orders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={[styles.orderCard, { backgroundColor: isDark ? colors.surface[800] : '#fff' }, shadows.soft]}
                onPress={() => handleAcceptOrder(order.id)}
              >
                <View style={styles.orderHeader}>
                  <Text style={[styles.orderId, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
                    #{order.id.slice(-6).toUpperCase()}
                  </Text>
                  <Text style={[styles.orderAmount, { color: colors.kiwi[600] }]}>
                    {formatCurrency(Number(order.totalAmount) || 0)}
                  </Text>
                </View>
                
                <View style={styles.orderRoute}>
                  <View style={styles.routePoint}>
                    <View style={[styles.routeDot, { backgroundColor: colors.kiwi[500] }]} />
                    <Text style={[styles.routeText, { color: isDark ? colors.surface[300] : colors.surface[600] }]} numberOfLines={1}>
                      {order.pickupAddress}
                    </Text>
                  </View>
                  <Ionicons name="arrow-down" size={16} color={colors.surface[300]} />
                  <View style={styles.routePoint}>
                    <View style={[styles.routeDot, { backgroundColor: colors.red[500] }]} />
                    <Text style={[styles.routeText, { color: isDark ? colors.surface[300] : colors.surface[600] }]} numberOfLines={1}>
                      {order.deliveryAddress}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderFooter}>
                  <Text style={[styles.orderTime, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                    {new Date(order.createdAt).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <LinearGradient colors={gradients.kiwi} style={styles.acceptButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.acceptButtonText}>Aceptar</Text>
                  </LinearGradient>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greeting: { fontSize: 14, marginBottom: 2 },
  name: { fontSize: 22, fontWeight: '700' },
  socketIndicator: { width: 8, height: 8, borderRadius: 4 },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  statusToggle: { alignItems: 'center' },
  toggleTrack: {
    width: 60,
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
    gap: 16,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  statusStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { color: '#fff', fontSize: 12 },
  quickStats: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    gap: 10,
  },
  quickStat: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  quickStatValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  quickStatLabel: { fontSize: 11, marginTop: 2 },
  section: { marginHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  emptyState: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, marginTop: 12 },
  orderCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderId: { fontSize: 14, fontWeight: '700' },
  orderAmount: { fontSize: 16, fontWeight: '800' },
  orderRoute: { marginBottom: 12 },
  routePoint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeText: { fontSize: 13, flex: 1 },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTime: { fontSize: 12 },
  acceptButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  acceptButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
