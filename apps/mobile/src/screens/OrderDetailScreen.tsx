import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { colors, shadows } from '../utils/theme';
import { api } from '../services/api';

export default function OrderDetailScreen({ route, navigation }: any) {
  const { orderId } = route.params;
  const { isDark } = useTheme();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      // In production, fetch from API
      // const data = await api.getOrder(orderId);
      setOrder({
        id: orderId,
        pickupAddress: 'Restaurante El Sabor',
        pickupDetail: 'Nicoya Centro, 200m norte del parque',
        deliveryAddress: 'Casa del Cliente',
        deliveryDetail: 'Santa Cruz, Barrio Los Ángeles',
        totalAmount: 2500,
        status: 'in_progress',
        customerName: 'María García',
        customerPhone: '+506 8888 8888',
        items: [
          { name: 'Bowl de Pollo', quantity: 2, price: 4500 },
          { name: 'Café Americano', quantity: 1, price: 1200 },
        ],
        notes: 'Sin cebolla por favor',
        distanceKm: 2.5,
        estimatedTime: 15,
      });
    } catch (error) {
      console.error('Failed to fetch order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOrder = async () => {
    Alert.alert(
      'Completar Pedido',
      '¿Confirmas que entregaste el pedido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await api.updateOrderStatus(orderId, 'delivered');
              Alert.alert('Éxito', 'Pedido completado', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              Alert.alert('Error', 'No se pudo completar el pedido');
            }
          },
        },
      ]
    );
  };

  const handleCallCustomer = () => {
    if (order?.customerPhone) {
      Linking.openURL(`tel:${order.customerPhone}`);
    }
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={[styles.container, { 
        backgroundColor: isDark ? colors.surface[950] : colors.surface[50] 
      }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
            Cargando...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { 
      backgroundColor: isDark ? colors.surface[950] : colors.surface[50] 
    }]}>
      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: isDark ? colors.surface[900] : '#fff',
        borderBottomColor: isDark ? colors.surface[700] : colors.surface[200],
      }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={isDark ? colors.surface[100] : colors.surface[900]} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
          Pedido #{order.id.slice(-6).toUpperCase()}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: colors.kiwi[100] }]}>
          <Ionicons name="cube" size={20} color={colors.kiwi[600]} />
          <Text style={[styles.statusText, { color: colors.kiwi[700] }]}>
            En progreso
          </Text>
        </View>

        {/* Locations */}
        <View style={[styles.card, { 
          backgroundColor: isDark ? colors.surface[800] : '#fff' 
        }, shadows.soft]}>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.kiwi[100] }]}>
              <View style={[styles.dot, { backgroundColor: colors.kiwi[500] }]} />
            </View>
            <View style={styles.locationInfo}>
              <Text style={[styles.locationLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                Recoger
              </Text>
              <Text style={[styles.locationName, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
                {order.pickupAddress}
              </Text>
              <Text style={[styles.locationDetail, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                {order.pickupDetail}
              </Text>
            </View>
          </View>

          <View style={styles.lineContainer}>
            <View style={[styles.line, { backgroundColor: isDark ? colors.surface[700] : colors.surface[200] }]} />
            <Text style={[styles.distanceText, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              {order.distanceKm} km • ~{order.estimatedTime} min
            </Text>
            <View style={[styles.line, { backgroundColor: isDark ? colors.surface[700] : colors.surface[200] }]} />
          </View>

          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.gold[100] }]}>
              <View style={[styles.dot, { backgroundColor: colors.gold[500] }]} />
            </View>
            <View style={styles.locationInfo}>
              <Text style={[styles.locationLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                Entregar
              </Text>
              <Text style={[styles.locationName, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
                {order.deliveryAddress}
              </Text>
              <Text style={[styles.locationDetail, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                {order.deliveryDetail}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer */}
        <View style={[styles.card, { 
          backgroundColor: isDark ? colors.surface[800] : '#fff' 
        }, shadows.soft]}>
          <Text style={[styles.cardTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Cliente
          </Text>
          <View style={styles.customerRow}>
            <View style={styles.customerInfo}>
              <Text style={[styles.customerName, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
                {order.customerName}
              </Text>
            </View>
            <TouchableOpacity style={styles.callButton} onPress={handleCallCustomer}>
              <Ionicons name="call" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Items */}
        <View style={[styles.card, { 
          backgroundColor: isDark ? colors.surface[800] : '#fff' 
        }, shadows.soft]}>
          <Text style={[styles.cardTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Artículos
          </Text>
          {order.items.map((item: any, index: number) => (
            <View key={index} style={styles.itemRow}>
              <Text style={[styles.itemQuantity, { color: colors.kiwi[600] }]}>
                {item.quantity}x
              </Text>
              <Text style={[styles.itemName, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
                {item.name}
              </Text>
              <Text style={[styles.itemPrice, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                ₡{(item.price * item.quantity).toLocaleString()}
              </Text>
            </View>
          ))}
          {order.notes && (
            <View style={[styles.notesContainer, { 
              backgroundColor: isDark ? colors.surface[700] : colors.surface[100] 
            }]}>
              <Text style={[styles.notesLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                📝 Notas:
              </Text>
              <Text style={[styles.notesText, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                {order.notes}
              </Text>
            </View>
          )}
        </View>

        {/* Total */}
        <View style={[styles.card, { 
          backgroundColor: isDark ? colors.surface[800] : '#fff' 
        }, shadows.soft]}>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Total del pedido
            </Text>
            <Text style={[styles.totalAmount, { color: colors.kiwi[600] }]}>
              ₡{order.totalAmount.toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionsContainer, { 
        backgroundColor: isDark ? colors.surface[900] : '#fff',
        borderTopColor: isDark ? colors.surface[700] : colors.surface[200],
      }]}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleCallCustomer}>
          <Ionicons name="call" size={20} color={colors.kiwi[500]} />
          <Text style={[styles.secondaryButtonText, { color: colors.kiwi[500] }]}>
            Llamar
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.primaryButton} onPress={handleCompleteOrder}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>
            Completar
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 120,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...shadows.soft,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 16,
  },
  locationDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  locationDetail: {
    fontSize: 13,
  },
  lineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 11,
  },
  line: {
    flex: 1,
    height: 1,
  },
  distanceText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.kiwi[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[100],
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '600',
    width: 40,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
  },
  notesContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },
  notesLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  actionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 40,
    gap: 12,
    borderTopWidth: 1,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.kiwi[500],
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.kiwi[500],
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
