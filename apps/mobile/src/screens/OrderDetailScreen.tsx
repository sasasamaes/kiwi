import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { colors, gradients, shadows } from '../utils/theme';
import { api, Order } from '../services/api';

const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string; next?: string }> = {
  assigned: { label: 'Asignado', icon: 'checkmark-circle', color: '#3b82f6', next: 'in_transit_to_pickup' },
  in_transit_to_pickup: { label: 'En camino a recoger', icon: 'navigate', color: '#8b5cf6', next: 'picked_up' },
  picked_up: { label: 'Recogido', icon: 'cube', color: '#f59e0b', next: 'in_transit_to_delivery' },
  in_transit_to_delivery: { label: 'Entregando', icon: 'rocket', color: '#06b6d4', next: 'delivered' },
  delivered: { label: 'Entregado', icon: 'trophy', color: '#22c55e' },
  cancelled: { label: 'Cancelado', icon: 'close-circle', color: '#ef4444' },
};

const NEXT_STATUS_LABELS: Record<string, string> = {
  'in_transit_to_pickup': 'Voy en camino a recoger',
  'picked_up': 'Recogí el pedido',
  'in_transit_to_delivery': 'En camino a entregar',
  'delivered': 'Entregado al cliente',
};

export default function OrderDetailScreen({ route, navigation }: any) {
  const { orderId } = route.params;
  const { isDark } = useTheme();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const data = await api.getOrder(orderId);
      setOrder(data);
    } catch (error) {
      console.error('Failed to fetch order:', error);
      Alert.alert('Error', 'No se pudo cargar el pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStatus = async () => {
    if (!order) return;

    const config = STATUS_CONFIG[order.status];
    if (!config?.next) return;

    const nextStatus = config.next;
    const label = NEXT_STATUS_LABELS[nextStatus] || 'Actualizar estado';

    Alert.alert(
      'Actualizar pedido',
      `${label}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              setUpdating(true);
              await api.updateOrderStatus(order.id, nextStatus);
              await fetchOrder();
              Alert.alert('✅ Estado actualizado', `Pedido: ${STATUS_CONFIG[nextStatus]?.label}`);
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'No se pudo actualizar');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleCallCustomer = () => {
    if (order?.merchant?.phone) {
      Linking.openURL(`tel:${order.merchant.phone}`);
    }
  };

  const handleOpenMaps = (address: string) => {
    const url = `https://maps.google.com/?q=${encodeURIComponent(address)}`;
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.surface[950] : colors.surface[50 }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.kiwi[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.surface[950] : colors.surface[50 }]}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: isDark ? colors.surface[400] : colors.surface[600] }}>Pedido no encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.assigned;

  return (
    <SafeAreaView style={[styles.container, { 
      backgroundColor: isDark ? colors.surface[950] : colors.surface[50] 
    }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={isDark ? colors.surface[100] : colors.surface[900]} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Pedido #{order.id.slice(-6).toUpperCase()}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Status Card */}
        <LinearGradient
          colors={[config.color, `${config.color}cc`]}
          style={[styles.statusCard, shadows.large]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name={config.icon as any} size={32} color="#fff" />
          <Text style={styles.statusText}>{config.label}</Text>
          <Text style={styles.statusId}>#{order.id.slice(-8).toUpperCase()}</Text>
        </LinearGradient>

        {/* Route */}
        <View style={[styles.card, { backgroundColor: isDark ? colors.surface[800] : '#fff' }, shadows.soft]}>
          <Text style={[styles.cardTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            🗺️ Ruta
          </Text>
          
          <TouchableOpacity style={styles.routePoint} onPress={() => handleOpenMaps(order.pickupAddress)}>
            <View style={[styles.routeDot, { backgroundColor: colors.kiwi[500] }]} />
            <View style={styles.routeInfo}>
              <Text style={[styles.routeLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>Recoger en</Text>
              <Text style={[styles.routeAddress, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>{order.pickupAddress}</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.kiwi[500]} />
          </TouchableOpacity>

          <View style={styles.routeLine} />

          <TouchableOpacity style={styles.routePoint} onPress={() => handleOpenMaps(order.deliveryAddress)}>
            <View style={[styles.routeDot, { backgroundColor: colors.red[500] }]} />
            <View style={styles.routeInfo}>
              <Text style={[styles.routeLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>Entregar en</Text>
              <Text style={[styles.routeAddress, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>{order.deliveryAddress}</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.red[500]} />
          </TouchableOpacity>
        </View>

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <View style={[styles.card, { backgroundColor: isDark ? colors.surface[800] : '#fff' }, shadows.soft]}>
            <Text style={[styles.cardTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              📦 Productos
            </Text>
            {order.items.map((item, index) => (
              <View key={item.id || index} style={styles.itemRow}>
                <Text style={[styles.itemQty, { color: colors.kiwi[600] }]}>{item.quantity}x</Text>
                <Text style={[styles.itemName, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>{item.name}</Text>
                <Text style={[styles.itemPrice, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                  ₡{(item.price * item.quantity).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Payment */}
        <View style={[styles.card, { backgroundColor: isDark ? colors.surface[800] : '#fff' }, shadows.soft]}>
          <Text style={[styles.cardTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            💳 Pago
          </Text>
          <View style={styles.paymentRow}>
            <Text style={[styles.paymentLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>Tu ganancia</Text>
            <Text style={[styles.paymentValue, { color: colors.kiwi[600] }]}>
              ₡{Number(order.driverPayout || 0).toLocaleString()}
            </Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={[styles.paymentLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>Total pedido</Text>
            <Text style={[styles.paymentTotal, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              ₡{Number(order.totalAmount || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Special Instructions */}
        {order.specialInstructions && (
          <View style={[styles.card, { backgroundColor: isDark ? colors.surface[800] : '#fff' }, shadows.soft]}>
            <Text style={[styles.cardTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              📝 Instrucciones
            </Text>
            <Text style={[styles.instructions, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
              {order.specialInstructions}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {config.next && (
            <TouchableOpacity
              style={[styles.actionButton, updating && styles.actionButtonDisabled]}
              onPress={handleNextStatus}
              disabled={updating}
            >
              <LinearGradient colors={gradients.kiwi} style={styles.actionGradient}>
                {updating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                    <Text style={styles.actionText}>{NEXT_STATUS_LABELS[config.next]}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.secondaryButton} onPress={handleCallCustomer}>
            <Ionicons name="call" size={20} color={colors.kiwi[500]} />
            <Text style={[styles.secondaryText, { color: colors.kiwi[500] }]}>Llamar comercio</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '700' },
  statusCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16 },
  statusText: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 8 },
  statusId: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  routePoint: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeInfo: { flex: 1 },
  routeLabel: { fontSize: 12 },
  routeAddress: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  routeLine: { width: 2, height: 20, backgroundColor: colors.surface[200], marginLeft: 4, marginVertical: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  itemQty: { fontSize: 14, fontWeight: '700', width: 30 },
  itemName: { flex: 1, fontSize: 14 },
  itemPrice: { fontSize: 14 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  paymentLabel: { fontSize: 14 },
  paymentValue: { fontSize: 18, fontWeight: '800' },
  paymentTotal: { fontSize: 14, fontWeight: '600' },
  instructions: { fontSize: 14, lineHeight: 20 },
  actions: { gap: 12, marginTop: 10 },
  actionButton: { borderRadius: 12, overflow: 'hidden' },
  actionButtonDisabled: { opacity: 0.6 },
  actionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.kiwi[500] },
  secondaryText: { fontSize: 14, fontWeight: '600' },
});
