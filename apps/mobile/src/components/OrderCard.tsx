import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { colors, shadows } from '../utils/theme';

interface OrderCardProps {
  order: {
    id: string;
    pickupAddress: string;
    deliveryAddress: string;
    totalAmount: number;
    distanceKm?: number;
    vehicleType?: string;
    items?: { name: string; quantity: number }[];
  };
  onAccept: () => void;
  onReject: () => void;
}

export default function OrderCard({ order, onAccept, onReject }: OrderCardProps) {
  const { isDark } = useTheme();

  return (
    <View style={[styles.container, { 
      backgroundColor: isDark ? colors.surface[800] : '#fff',
      borderColor: isDark ? colors.surface[700] : colors.surface[100],
    }, shadows.medium]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons name="cube" size={12} color={colors.kiwi[600]} />
          <Text style={styles.badgeText}>Package Delivery</Text>
        </View>
        <Text style={styles.price}>₡{order.totalAmount.toLocaleString()}</Text>
      </View>

      {/* Locations */}
      <View style={styles.locations}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: colors.kiwi[100] }]}>
            <View style={[styles.dot, { backgroundColor: colors.kiwi[500] }]} />
          </View>
          <View style={styles.locationInfo}>
            <Text style={[styles.locationLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Recoger
            </Text>
            <Text style={[styles.locationAddress, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {order.pickupAddress}
            </Text>
          </View>
        </View>

        <View style={styles.lineContainer}>
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
            <Text style={[styles.locationAddress, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              {order.deliveryAddress}
            </Text>
          </View>
        </View>
      </View>

      {/* Info Row */}
      <View style={styles.infoRow}>
        {order.distanceKm && (
          <View style={styles.infoItem}>
            <Ionicons name="location" size={14} color={colors.surface[400]} />
            <Text style={[styles.infoText, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              {order.distanceKm} km
            </Text>
          </View>
        )}
        {order.vehicleType && (
          <View style={styles.infoItem}>
            <Text style={styles.vehicleIcon}>
              {order.vehicleType === 'motorcycle' ? 'Bike' : 
               order.vehicleType === 'bicycle' ? 'Bike' :
               order.vehicleType === 'car' ? 'Car' : 'Truck'}
            </Text>
            <Text style={[styles.infoText, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              {order.vehicleType === 'motorcycle' ? 'Moto' :
               order.vehicleType === 'bicycle' ? 'Bici' :
               order.vehicleType === 'car' ? 'Carro' : 'Camión'}
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.rejectButton, { 
            borderColor: isDark ? colors.surface[700] : colors.surface[200],
          }]}
          onPress={onReject}
        >
          <Text style={[styles.rejectText, { color: isDark ? colors.surface[400] : colors.surface[600] }]}>
            Rechazar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.acceptButton}
          onPress={onAccept}
        >
          <Text style={styles.acceptText}>Aceptar</Text>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.kiwi[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.kiwi[700],
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.surface[900],
  },
  locations: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  locationDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
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
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 15,
    fontWeight: '600',
  },
  lineContainer: {
    paddingVertical: 8,
    paddingLeft: 11,
  },
  line: {
    width: 2,
    height: 16,
    borderRadius: 1,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surface[100],
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
  },
  vehicleIcon: {
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  rejectText: {
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.kiwi[500],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
