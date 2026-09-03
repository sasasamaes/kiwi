import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { colors, shadows } from '../utils/theme';
import { api, Order } from '../services/api';

export default function ActiveOrdersScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const fetchOrders = async () => {
    try {
      // Map filter to API status parameter
      let status: string | undefined;
      if (filter === 'active') {
        // Active orders: assigned, in_transit_to_pickup, picked_up, in_transit_to_delivery
        status = undefined; // Get all and filter client-side
      } else {
        status = 'delivered';
      }
      
      const data = await api.getMyOrders(status);
      
      if (filter === 'active') {
        // Filter for active statuses
        const activeStatuses = ['assigned', 'in_transit_to_pickup', 'picked_up', 'in_transit_to_delivery'];
        setOrders(data.filter(o => activeStatuses.includes(o.status)));
      } else {
        setOrders(data);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return '#3b82f6';
      case 'in_transit_to_pickup': return '#8b5cf6';
      case 'picked_up': return '#f59e0b';
      case 'in_transit_to_delivery': return '#06b6d4';
      case 'delivered': return '#22c55e';
      case 'cancelled': return '#ef4444';
      default: return colors.surface[400];
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'assigned': return 'Asignado';
      case 'in_transit_to_pickup': return 'En camino a recoger';
      case 'picked_up': return 'Recogido';
      case 'in_transit_to_delivery': return 'Entregando';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'assigned': return 'checkmark-circle';
      case 'in_transit_to_pickup': return 'navigate';
      case 'picked_up': return 'cube';
      case 'in_transit_to_delivery': return 'rocket';
      case 'delivered': return 'trophy';
      case 'cancelled': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const handleNextStatus = async (order: Order) => {
    const statusFlow: Record<string, string> = {
      'assigned': 'in_transit_to_pickup',
      'in_transit_to_pickup': 'picked_up',
      'picked_up': 'in_transit_to_delivery',
      'in_transit_to_delivery': 'delivered',
    };

    const nextStatus = statusFlow[order.status];
    if (!nextStatus) return;

    const confirmMessages: Record<string, string> = {
      'in_transit_to_pickup': '¿Vas en camino a recoger el pedido?',
      'picked_up': '¿Recogiste el pedido?',
      'in_transit_to_delivery': '¿El pedido va en camino a entregar?',
      'delivered': '¿Entregaste el pedido al cliente?',
    };

    Alert.alert(
      'Actualizar estado',
      confirmMessages[nextStatus] || 'Actualizar estado del pedido',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await api.updateOrderStatus(order.id, nextStatus);
              fetchOrders();
              Alert.alert('✅ Estado actualizado', `Pedido marcado como: ${getStatusLabel(nextStatus)}`);
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'No se pudo actualizar');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={[styles.orderItem, { 
        backgroundColor: isDark ? colors.surface[800] : '#fff',
      }, shadows.soft]}
      onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
    >
      <View style={styles.orderHeader}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
        <Text style={[styles.orderId, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
          #{item.id.slice(-6).toUpperCase()}
        </Text>
        <Text style={[styles.orderAmount, { color: colors.kiwi[600] }]}>
          ₡{Number(item.totalAmount || 0).toLocaleString()}
        </Text>
      </View>
      
      <View style={styles.orderLocations}>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: colors.kiwi[500] }]} />
          <Text style={[styles.routeText, { color: isDark ? colors.surface[300] : colors.surface[600 }]} numberOfLines={1}>
            {item.pickupAddress}
          </Text>
        </View>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: colors.red[500] }]} />
          <Text style={[styles.routeText, { color: isDark ? colors.surface[300] : colors.surface[600] }]} numberOfLines={1}>
            {item.deliveryAddress}
          </Text>
        </View>
      </View>

      <View style={styles.orderFooter}>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
          <Ionicons name={getStatusIcon(item.status) as any} size={14} color={getStatusColor(item.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
        <Text style={[styles.orderTime, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
          {new Date(item.createdAt).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {filter === 'active' && statusFlow[item.status] && (
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: getStatusColor(statusFlow[item.status]) }]}
          onPress={() => handleNextStatus(item)}
        >
          <Text style={styles.nextButtonText}>
            Siguiente: {getStatusLabel(statusFlow[item.status])}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const statusFlow: Record<string, string> = {
    'assigned': 'in_transit_to_pickup',
    'in_transit_to_pickup': 'picked_up',
    'picked_up': 'in_transit_to_delivery',
    'in_transit_to_delivery': 'delivered',
  };

  return (
    <SafeAreaView style={[styles.container, { 
      backgroundColor: isDark ? colors.surface[950] : colors.surface[50] 
    }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
          Mis Pedidos
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { 
        backgroundColor: isDark ? colors.surface[800] : colors.surface[100] 
      }]}>
        {(['active', 'completed'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>
              {tab === 'active' ? 'Activos' : 'Completados'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Orders List */}
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.kiwi[500]} />}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color={colors.surface[300]} />
            <Text style={[styles.emptyText, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              No hay pedidos {filter === 'active' ? 'activos' : 'completados'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  filterContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterTabActive: { backgroundColor: colors.kiwi[500] },
  filterText: { fontSize: 14, fontWeight: '600', color: colors.surface[500] },
  filterTextActive: { color: '#fff' },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  orderItem: { borderRadius: 16, padding: 16, marginBottom: 10 },
  orderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  orderId: { fontSize: 14, fontWeight: '700', flex: 1 },
  orderAmount: { fontSize: 16, fontWeight: '800' },
  orderLocations: { marginBottom: 12 },
  routePoint: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  routeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  routeText: { fontSize: 13, flex: 1 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  orderTime: { fontSize: 12 },
  nextButton: { marginTop: 12, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  nextButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  emptyState: { padding: 60, alignItems: 'center' },
  emptyText: { fontSize: 14, marginTop: 12 },
});
