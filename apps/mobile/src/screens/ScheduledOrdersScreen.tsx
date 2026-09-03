import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { colors, gradients, shadows } from '../utils/theme';
import { api, Order, onSocket } from '../services/api';

const QUICK_TIMES = [
  { label: '15 min', value: '15 minutos' },
  { label: '30 min', value: '30 minutos' },
  { label: '45 min', value: '45 minutos' },
  { label: '1 hora', value: '1 hora' },
  { label: '1.5 horas', value: '1.5 horas' },
  { label: '2 horas', value: '2 horas' },
];

export default function ScheduledOrdersScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOrders, setSubmittedOrders] = useState<Set<string>>(new Set());

  // Proposal form
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchScheduledOrders();
    setupSocket();
  }, []);

  const setupSocket = () => {
    // Listen for new scheduled orders
    onSocket('order:scheduled', (data: any) => {
      console.log('Calendar New scheduled order:', data);
      fetchScheduledOrders();
    });

    // Listen for proposal accepted/rejected
    onSocket('order:proposalAccepted', (data: any) => {
      console.log('Check Proposal accepted:', data);
      Alert.alert('PartyPopper ¡Propuesta aceptada!', data.message || 'Tu propuesta fue seleccionada');
      fetchScheduledOrders();
    });

    onSocket('order:proposalRejected', (data: any) => {
      console.log('X Proposal rejected:', data);
      fetchScheduledOrders();
    });
  };

  const fetchScheduledOrders = async () => {
    try {
      const data = await api.getScheduledOrders();
      setOrders(data || []);
    } catch (error) {
      console.error('Failed to fetch scheduled orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchScheduledOrders();
    setRefreshing(false);
  };

  const openProposalForm = (order: Order) => {
    setSelectedOrder(order);
    setEstimatedArrival('');
    setMessage('');
    setShowProposalModal(true);
  };

  const submitProposal = async () => {
    if (!selectedOrder || !estimatedArrival.trim()) {
      Alert.alert('Error', 'Selecciona un tiempo estimado de llegada');
      return;
    }

    try {
      setSubmitting(true);
      await api.submitProposal(selectedOrder.id, {
        estimatedArrival,
        message: message.trim() || undefined,
      });

      setSubmittedOrders(prev => new Set(prev).add(selectedOrder.id));
      setShowProposalModal(false);
      setSelectedOrder(null);
      Alert.alert(
        'Propuesta enviada',
        'El comerciante será notificado. Espera su respuesta.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo enviar la propuesta');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => `₡${amount.toLocaleString()}`;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Sin fecha';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  if (loading) {
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
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={isDark ? colors.surface[100] : colors.surface[900]} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Pedidos Programados
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: isDark ? colors.surface[800] : '#fffbeb' }]}>
          <Text style={styles.infoIcon}>💡</Text>
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              Propón tu servicio
            </Text>
            <Text style={[styles.infoText, { color: isDark ? colors.surface[400] : colors.surface[600] }]}>
              Envía tu propuesta con tiempo estimado y mensaje. El comerciante elegirá al repartidor que mejor se adapte.
            </Text>
          </View>
        </View>

        {/* Orders List */}
        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={colors.surface[300]} />
            <Text style={[styles.emptyTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              No hay pedidos programados
            </Text>
            <Text style={[styles.emptyText, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
              Cuando los comerciantes creen pedidos programados, aparecerán aquí
            </Text>
          </View>
        ) : (
          orders.map((order) => {
            const isSubmitted = submittedOrders.has(order.id);
            return (
              <View
                key={order.id}
                style={[styles.orderCard, { 
                  backgroundColor: isDark ? colors.surface[800] : '#fff',
                  opacity: isSubmitted ? 0.6 : 1,
                }, shadows.soft]}
              >
                {/* Order Header */}
                <View style={styles.orderHeader}>
                  <View style={styles.orderIdRow}>
                    <Text style={[styles.orderId, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
                      #{order.id.slice(-6).toUpperCase()}
                    </Text>
                    <View style={[styles.scheduledBadge, { backgroundColor: `${colors.gold[500]}20` }]}>
                      <Ionicons name="time" size={12} color={colors.gold[500]} />
                      <Text style={[styles.scheduledText, { color: colors.gold[500] }]}>
                        Programado
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.orderAmount, { color: colors.kiwi[600] }]}>
                    {formatCurrency(Number(order.totalAmount) || 0)}
                  </Text>
                </View>

                {/* Scheduled Date/Time */}
                {order.scheduledDate && (
                  <View style={styles.scheduleInfo}>
                    <Ionicons name="calendar" size={16} color={colors.gold[500]} />
                    <Text style={[styles.scheduleText, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                      {formatDate(order.scheduledDate)}
                      {order.scheduledTime ? ` a las ${order.scheduledTime}` : ''}
                    </Text>
                  </View>
                )}

                {/* Route */}
                <View style={styles.routeContainer}>
                  <View style={styles.routePoint}>
                    <View style={[styles.routeDot, { backgroundColor: colors.kiwi[500] }]} />
                    <Text style={[styles.routeText, { color: isDark ? colors.surface[300] : colors.surface[600] }]} numberOfLines={1}>
                      {order.pickupAddress}
                    </Text>
                  </View>
                  <Ionicons name="arrow-down" size={14} color={colors.surface[300]} style={{ marginLeft: 3 }} />
                  <View style={styles.routePoint}>
                    <View style={[styles.routeDot, { backgroundColor: colors.red[500] }]} />
                    <Text style={[styles.routeText, { color: isDark ? colors.surface[300] : colors.surface[600] }]} numberOfLines={1}>
                      {order.deliveryAddress}
                    </Text>
                  </View>
                </View>

                {/* Merchant Info */}
                {order.merchant && (
                  <View style={styles.merchantInfo}>
                    <Ionicons name="storefront" size={14} color={colors.surface[400]} />
                    <Text style={[styles.merchantName, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                      {order.merchant.businessName || 'Comercio'}
                    </Text>
                  </View>
                )}

                {/* Items preview */}
                {order.items && order.items.length > 0 && (
                  <View style={styles.itemsPreview}>
                    <Text style={[styles.itemsText, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
                      {order.items.length} producto{order.items.length > 1 ? 's' : ''}: {order.items.map(i => i.name).join(', ').substring(0, 50)}...
                    </Text>
                  </View>
                )}

                {/* Action Button */}
                <TouchableOpacity
                  style={[
                    styles.proposeButton,
                    isSubmitted && styles.proposeButtonSubmitted,
                  ]}
                  onPress={() => !isSubmitted && openProposalForm(order)}
                  disabled={isSubmitted}
                >
                  <LinearGradient
                    colors={isSubmitted ? [colors.surface[400], colors.surface[500]] : gradients.kiwi}
                    style={styles.proposeGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons
                      name={isSubmitted ? 'checkmark-circle' : 'send'}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.proposeText}>
                      {isSubmitted ? 'Propuesta enviada' : 'Enviar propuesta'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Proposal Modal */}
      <Modal
        visible={showProposalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProposalModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: isDark ? colors.surface[800] : '#fff' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
                Enviar propuesta
              </Text>
              <TouchableOpacity onPress={() => setShowProposalModal(false)}>
                <Ionicons name="close" size={24} color={isDark ? colors.surface[400] : colors.surface[600]} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <View style={[styles.modalOrderInfo, { backgroundColor: isDark ? colors.surface[700] : colors.surface[100] }]}>
                <Text style={[styles.modalOrderId, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
                  Pedido #{selectedOrder.id.slice(-6).toUpperCase()}
                </Text>
                <Text style={[styles.modalOrderRoute, { color: isDark ? colors.surface[400] : colors.surface[600] }]}>
                  {selectedOrder.pickupAddress} → {selectedOrder.deliveryAddress}
                </Text>
              </View>
            )}

            {/* Quick Time Selection */}
            <Text style={[styles.fieldLabel, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
              Tiempo estimado de llegada *
            </Text>
            <View style={styles.quickTimes}>
              {QUICK_TIMES.map((qt) => (
                <TouchableOpacity
                  key={qt.value}
                  style={[
                    styles.quickTimeButton,
                    estimatedArrival === qt.value && styles.quickTimeButtonActive,
                  ]}
                  onPress={() => setEstimatedArrival(qt.value)}
                >
                  <Text style={[
                    styles.quickTimeText,
                    estimatedArrival === qt.value && styles.quickTimeTextActive,
                  ]}>
                    {qt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Time Input */}
            <TextInput
              style={[styles.input, { 
                backgroundColor: isDark ? colors.surface[700] : colors.surface[100],
                color: isDark ? colors.surface[100] : colors.surface[900],
                borderColor: isDark ? colors.surface[600] : colors.surface[200],
              }]}
              placeholder="O escribe tu tiempo personalizado"
              placeholderTextColor={colors.surface[400]}
              value={estimatedArrival}
              onChangeText={setEstimatedArrival}
            />

            {/* Message */}
            <Text style={[styles.fieldLabel, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
              Mensaje (opcional)
            </Text>
            <TextInput
              style={[styles.textArea, { 
                backgroundColor: isDark ? colors.surface[700] : colors.surface[100],
                color: isDark ? colors.surface[100] : colors.surface[900],
                borderColor: isDark ? colors.surface[600] : colors.surface[200],
              }]}
              placeholder="Ej: Llevo moto, puedo llegar rápido. Conozco bien la zona."
              placeholderTextColor={colors.surface[400]}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={3}
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, (!estimatedArrival.trim() || submitting) && styles.submitButtonDisabled]}
              onPress={submitProposal}
              disabled={!estimatedArrival.trim() || submitting}
            >
              <LinearGradient colors={gradients.kiwi} style={styles.submitGradient}>
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.submitText}>Enviar propuesta</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  infoBanner: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 20, gap: 12 },
  infoIcon: { fontSize: 24 },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  infoText: { fontSize: 13, lineHeight: 18 },
  emptyState: { padding: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyText: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  orderCard: { borderRadius: 16, padding: 16, marginBottom: 12 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderIdRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderId: { fontSize: 14, fontWeight: '700' },
  scheduledBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  scheduledText: { fontSize: 11, fontWeight: '600' },
  orderAmount: { fontSize: 16, fontWeight: '800' },
  scheduleInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  scheduleText: { fontSize: 13, fontWeight: '600' },
  routeContainer: { marginBottom: 12 },
  routePoint: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  routeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  routeText: { fontSize: 13, flex: 1 },
  merchantInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  merchantName: { fontSize: 12 },
  itemsPreview: { marginBottom: 12 },
  itemsText: { fontSize: 12, fontStyle: 'italic' },
  proposeButton: { borderRadius: 12, overflow: 'hidden' },
  proposeButtonSubmitted: { opacity: 0.7 },
  proposeGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  proposeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalOrderInfo: { borderRadius: 12, padding: 12, marginBottom: 20 },
  modalOrderId: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  modalOrderRoute: { fontSize: 13 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  quickTimes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  quickTimeButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)' },
  quickTimeButtonActive: { backgroundColor: colors.kiwi[500] },
  quickTimeText: { fontSize: 13, color: colors.surface[600] },
  quickTimeTextActive: { color: '#fff', fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, marginBottom: 16 },
  textArea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, marginBottom: 20, minHeight: 80, textAlignVertical: 'top' },
  submitButton: { borderRadius: 12, overflow: 'hidden' },
  submitButtonDisabled: { opacity: 0.5 },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
