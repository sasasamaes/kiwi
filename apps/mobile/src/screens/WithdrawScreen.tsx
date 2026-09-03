import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { colors, gradients, shadows } from '../utils/theme';
import { api } from '../services/api';

type PaymentMethod = 'sinpe' | 'bank_transfer';

interface Balance {
  totalEarnings: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
  availableBalance: number;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  processedAt?: string;
}

export default function WithdrawScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('sinpe');
  const [amount, setAmount] = useState('');
  const [sinpePhone, setSinpePhone] = useState('');
  const [sinpeName, setSinpeName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [balanceData, withdrawalsData] = await Promise.all([
        api.get('/withdrawals/balance'),
        api.get('/withdrawals/my'),
      ]);
      setBalance(balanceData);
      setWithdrawals(withdrawalsData);
    } catch (error) {
      console.error('Failed to fetch withdrawal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    const amountNum = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!amountNum || amountNum < 1000) {
      Alert.alert('Error', 'El monto mínimo de retiro es ₡1,000');
      return;
    }
    if (amountNum > (balance?.availableBalance || 0)) {
      Alert.alert('Error', 'Saldo insuficiente');
      return;
    }

    if (method === 'sinpe' && !sinpePhone) {
      Alert.alert('Error', 'El número SINPE es requerido');
      return;
    }

    if (method === 'bank_transfer' && (!bankName || !accountNumber || !accountHolder)) {
      Alert.alert('Error', 'Completa todos los datos bancarios');
      return;
    }

    Alert.alert(
      'Confirmar retiro',
      `Retirar ₡${amountNum.toLocaleString()} vía ${method === 'sinpe' ? 'SINPE' : 'transferencia bancaria'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: processWithdrawal },
      ]
    );
  };

  const processWithdrawal = async () => {
    setSubmitting(true);
    try {
      const amountNum = parseInt(amount.replace(/[^0-9]/g, ''), 10);
      await api.post('/withdrawals/request', {
        amount: amountNum,
        paymentMethod: method,
        sinpePhone: method === 'sinpe' ? sinpePhone : undefined,
        sinpeName: method === 'sinpe' ? sinpeName : undefined,
        bankName: method === 'bank_transfer' ? bankName : undefined,
        accountNumber: method === 'bank_transfer' ? accountNumber : undefined,
        accountHolder: method === 'bank_transfer' ? accountHolder : undefined,
      });

      Alert.alert(
        '✅ Solicitud enviada',
        'Tu solicitud de retiro está siendo procesada. Te notificaremos cuando se complete.',
        [{ text: 'OK', onPress: () => { resetForm(); fetchData(); } }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo procesar el retiro');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setSinpePhone('');
    setSinpeName('');
    setBankName('');
    setAccountNumber('');
    setAccountHolder('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'processing': return '#f59e0b';
      case 'pending': return '#3b82f6';
      case 'failed': case 'rejected': return '#ef4444';
      default: return colors.surface[400];
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completado';
      case 'processing': return 'Procesando';
      case 'pending': return 'Pendiente';
      case 'failed': return 'Fallido';
      case 'rejected': return 'Rechazado';
      default: return status;
    }
  };

  const formatCurrency = (amount: number) => `₡${amount.toLocaleString()}`;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.surface[950] : colors.surface[50 }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.kiwi[500]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.surface[950] : colors.surface[50] }]}>
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
            Retirar ganancias
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Balance Card */}
        <LinearGradient
          colors={gradients.kiwi}
          style={[styles.balanceCard, shadows.large]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.balanceLabel}>Saldo disponible</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(balance?.availableBalance || 0)}</Text>
          <View style={styles.balanceDetails}>
            <View style={styles.balanceDetailItem}>
              <Text style={styles.balanceDetailLabel}>Ganancias totales</Text>
              <Text style={styles.balanceDetailValue}>{formatCurrency(balance?.totalEarnings || 0)}</Text>
            </View>
            <View style={styles.balanceDetailItem}>
              <Text style={styles.balanceDetailLabel}>Retirado</Text>
              <Text style={styles.balanceDetailValue}>{formatCurrency(balance?.totalWithdrawn || 0)}</Text>
            </View>
            <View style={styles.balanceDetailItem}>
              <Text style={styles.balanceDetailLabel}>Pendiente</Text>
              <Text style={styles.balanceDetailValue}>{formatCurrency(balance?.pendingWithdrawals || 0)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Amount Buttons */}
        <Text style={[styles.sectionTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
          Monto rápido
        </Text>
        <View style={styles.quickAmounts}>
          {[1000, 2000, 5000, 10000].map((quickAmount) => (
            <TouchableOpacity
              key={quickAmount}
              style={[
                styles.quickAmountButton,
                { backgroundColor: isDark ? colors.surface[800] : colors.surface[100] },
                amount === quickAmount.toLocaleString() && styles.quickAmountButtonActive,
              ]}
              onPress={() => setAmount(quickAmount.toLocaleString())}
            >
              <Text style={[
                styles.quickAmountText,
                { color: isDark ? colors.surface[300] : colors.surface[600] },
                amount === quickAmount.toLocaleString() && styles.quickAmountTextActive,
              ]}>
                ₡{quickAmount.toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Amount Input */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
            Monto a retirar
          </Text>
          <View style={[styles.amountInputContainer, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff',
            borderColor: isDark ? colors.surface[700] : colors.surface[200],
          }]}>
            <Text style={[styles.amountPrefix, { color: colors.surface[400] }]}>₡</Text>
            <TextInput
              style={[styles.amountInput, { color: isDark ? colors.surface[100] : colors.surface[900] }]}
              placeholder="0"
              placeholderTextColor={colors.surface[400]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Payment Method */}
        <Text style={[styles.sectionTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
          Método de pago
        </Text>
        <View style={styles.methodContainer}>
          <TouchableOpacity
            style={[styles.methodButton, { 
              backgroundColor: isDark ? colors.surface[800] : colors.surface[100],
              borderColor: method === 'sinpe' ? colors.kiwi[500] : 'transparent',
            }]}
            onPress={() => setMethod('sinpe')}
          >
            <Text style={styles.methodEmoji}>📱</Text>
            <Text style={[styles.methodLabel, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              SINPE
            </Text>
            <Text style={[styles.methodSublabel, { color: colors.surface[400] }]}>
              Transferencia instantánea
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.methodButton, { 
              backgroundColor: isDark ? colors.surface[800] : colors.surface[100],
              borderColor: method === 'bank_transfer' ? colors.kiwi[500] : 'transparent',
            }]}
            onPress={() => setMethod('bank_transfer')}
          >
            <Text style={styles.methodEmoji}>🏦</Text>
            <Text style={[styles.methodLabel, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              Transferencia
            </Text>
            <Text style={[styles.methodSublabel, { color: colors.surface[400] }]}>
              Cuenta bancaria
            </Text>
          </TouchableOpacity>
        </View>

        {/* SINPE Form */}
        {method === 'sinpe' && (
          <View style={styles.formSection}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                Número SINPE *
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDark ? colors.surface[800] : '#fff',
                  color: isDark ? colors.surface[100] : colors.surface[900],
                  borderColor: isDark ? colors.surface[700] : colors.surface[200],
                }]}
                placeholder="8888-1234"
                placeholderTextColor={colors.surface[400]}
                value={sinpePhone}
                onChangeText={setSinpePhone}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                Nombre (opcional)
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDark ? colors.surface[800] : '#fff',
                  color: isDark ? colors.surface[100] : colors.surface[900],
                  borderColor: isDark ? colors.surface[700] : colors.surface[200],
                }]}
                placeholder="Tu nombre"
                placeholderTextColor={colors.surface[400]}
                value={sinpeName}
                onChangeText={setSinpeName}
              />
            </View>
          </View>
        )}

        {/* Bank Transfer Form */}
        {method === 'bank_transfer' && (
          <View style={styles.formSection}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                Banco *
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDark ? colors.surface[800] : '#fff',
                  color: isDark ? colors.surface[100] : colors.surface[900],
                  borderColor: isDark ? colors.surface[700] : colors.surface[200],
                }]}
                placeholder="Banco Nacional, BAC, etc."
                placeholderTextColor={colors.surface[400]}
                value={bankName}
                onChangeText={setBankName}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                Número de cuenta *
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDark ? colors.surface[800] : '#fff',
                  color: isDark ? colors.surface[100] : colors.surface[900],
                  borderColor: isDark ? colors.surface[700] : colors.surface[200],
                }]}
                placeholder="123456789"
                placeholderTextColor={colors.surface[400]}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
                Titular de la cuenta *
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDark ? colors.surface[800] : '#fff',
                  color: isDark ? colors.surface[100] : colors.surface[900],
                  borderColor: isDark ? colors.surface[700] : colors.surface[200],
                }]}
                placeholder="Nombre completo"
                placeholderTextColor={colors.surface[400]}
                value={accountHolder}
                onChangeText={setAccountHolder}
              />
            </View>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !amount}
        >
          <LinearGradient colors={gradients.kiwi} style={styles.submitButtonGradient}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="wallet-outline" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>
                  Retirar {amount ? `₡${parseInt(amount.replace(/[^0-9]/g, ''), 10).toLocaleString()}` : ''}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Withdrawal History */}
        {withdrawals.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
              Historial de retiros
            </Text>
            {withdrawals.map((w) => (
              <View
                key={w.id}
                style={[styles.historyItem, { 
                  backgroundColor: isDark ? colors.surface[800] : colors.surface[100],
                }]}
              >
                <View style={styles.historyLeft}>
                  <Text style={[styles.historyAmount, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
                    {formatCurrency(w.amount)}
                  </Text>
                  <Text style={[styles.historyDate, { color: colors.surface[400] }]}>
                    {new Date(w.createdAt).toLocaleDateString('es-CR')}
                  </Text>
                </View>
                <View style={[styles.historyStatus, { backgroundColor: `${getStatusColor(w.status)}20` }]}>
                  <Text style={[styles.historyStatusText, { color: getStatusColor(w.status) }]}>
                    {getStatusLabel(w.status)}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '800' },
  balanceCard: { borderRadius: 20, padding: 24, marginBottom: 24 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 4 },
  balanceAmount: { color: '#fff', fontSize: 36, fontWeight: '800', marginBottom: 16 },
  balanceDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceDetailItem: { alignItems: 'center' },
  balanceDetailLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 2 },
  balanceDetailValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  quickAmounts: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  quickAmountButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickAmountButtonActive: {
    backgroundColor: `${colors.kiwi[500]}20`,
    borderWidth: 1,
    borderColor: colors.kiwi[500],
  },
  quickAmountText: { fontSize: 14, fontWeight: '600' },
  quickAmountTextActive: { color: colors.kiwi[600] },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  amountPrefix: { fontSize: 20, fontWeight: '600', marginRight: 8 },
  amountInput: { flex: 1, paddingVertical: 14, fontSize: 24, fontWeight: '700' },
  methodContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  methodButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  methodEmoji: { fontSize: 24, marginBottom: 4 },
  methodLabel: { fontSize: 14, fontWeight: '700' },
  methodSublabel: { fontSize: 11, marginTop: 2 },
  formSection: { marginBottom: 20 },
  submitButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 24 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonGradient: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  historyLeft: { flex: 1 },
  historyAmount: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  historyDate: { fontSize: 12 },
  historyStatus: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  historyStatusText: { fontSize: 12, fontWeight: '600' },
});
