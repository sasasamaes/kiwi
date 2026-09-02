import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { colors, shadows } from '../utils/theme';
import { api } from '../services/api';

export default function ActiveOrdersScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const fetchOrders = async () => {
    try {
      const status = filter === 'active' ? 'in_progress' : 'completed';
      const data = await api.getMyOrders(status);
      setOrders(data);
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
      case 'in_progress': return colors.kiwi[500];
      case 'completed': return colors.surface[400];
      case 'cancelled': return colors.red[500];
      default: return colors.surface[400];
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_progress': return 'En progreso';
      case 'completed': return 'Completado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
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
                ₡{item.totalAmount?.toLocaleString() || '0'}
              </Text>
            </View>
            
            <View style={styles.orderLocations}>
              <Text style={[styles.orderRoute, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                {item.pickupAddress} → {item.deliveryAddress}
              </Text>
            </View>

            <View style={styles.orderFooter}>
              <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                  {getStatusLabel(item.status)}
                </Text>
              </View>
              <Text style={[styles.orderTime, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                {new Date(item.createdAt).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </TouchableOpacity>
        )}
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
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
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
    alignItems: 'center',
    borderRadius: 10,
  },
  filterTabActive: {
    backgroundColor: '#fff',
    ...shadows.soft,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface[500],
  },
  filterTextActive: {
    color: colors.kiwi[600],
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  orderItem: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  orderId: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  orderLocations: {
    marginBottom: 12,
  },
  orderRoute: {
    fontSize: 14,
    lineHeight: 20,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderTime: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 16,
  },
});
