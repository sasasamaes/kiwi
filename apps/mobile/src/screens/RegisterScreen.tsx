import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { colors, gradients, shadows } from '../utils/theme';

const VEHICLES = [
  { id: 'motorcycle', label: 'Moto', icon: '🏍️' },
  { id: 'bicycle', label: 'Bici', icon: '🚲' },
  { id: 'car', label: 'Carro', icon: '🚗' },
  { id: 'truck', label: 'Camión', icon: '🚛' },
];

export default function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const { isDark } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    vehicleType: 'motorcycle',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      await register(formData);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al crear cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? colors.surface[950] : colors.surface[50] }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? colors.surface[100] : colors.surface[900]} />
        </TouchableOpacity>

        <View style={styles.header}>
          <LinearGradient
            colors={gradients.kiwi}
            style={styles.logoBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.logoEmoji}>🥝</Text>
          </LinearGradient>
          <Text style={[styles.title, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Crear Cuenta
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
            Únete a Kiwi como repartidor
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Vehicle Selection */}
          <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
            Tipo de vehículo
          </Text>
          <View style={styles.vehicleGrid}>
            {VEHICLES.map((vehicle) => (
              <TouchableOpacity
                key={vehicle.id}
                style={[
                  styles.vehicleOption,
                  {
                    backgroundColor: isDark ? colors.surface[800] : '#fff',
                    borderColor: formData.vehicleType === vehicle.id 
                      ? colors.kiwi[500] 
                      : isDark ? colors.surface[700] : colors.surface[200],
                  },
                ]}
                onPress={() => setFormData({ ...formData, vehicleType: vehicle.id })}
              >
                <Text style={styles.vehicleIcon}>{vehicle.icon}</Text>
                <Text style={[
                  styles.vehicleLabel, 
                  { color: isDark ? colors.surface[300] : colors.surface[600] }
                ]}>
                  {vehicle.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Name */}
          <View style={[styles.inputContainer, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff',
            borderColor: isDark ? colors.surface[700] : colors.surface[200],
          }]}>
            <Ionicons name="person-outline" size={20} color={colors.surface[400]} />
            <TextInput
              style={[styles.input, { color: isDark ? colors.surface[100] : colors.surface[900] }]}
              placeholder="Nombre completo"
              placeholderTextColor={colors.surface[400]}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
          </View>

          {/* Email */}
          <View style={[styles.inputContainer, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff',
            borderColor: isDark ? colors.surface[700] : colors.surface[200],
          }]}>
            <Ionicons name="mail-outline" size={20} color={colors.surface[400]} />
            <TextInput
              style={[styles.input, { color: isDark ? colors.surface[100] : colors.surface[900] }]}
              placeholder="Email"
              placeholderTextColor={colors.surface[400]}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Phone */}
          <View style={[styles.inputContainer, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff',
            borderColor: isDark ? colors.surface[700] : colors.surface[200],
          }]}>
            <Ionicons name="call-outline" size={20} color={colors.surface[400]} />
            <TextInput
              style={[styles.input, { color: isDark ? colors.surface[100] : colors.surface[900] }]}
              placeholder="Teléfono"
              placeholderTextColor={colors.surface[400]}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
            />
          </View>

          {/* Password */}
          <View style={[styles.inputContainer, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff',
            borderColor: isDark ? colors.surface[700] : colors.surface[200],
          }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.surface[400]} />
            <TextInput
              style={[styles.input, { color: isDark ? colors.surface[100] : colors.surface[900] }]}
              placeholder="Contraseña"
              placeholderTextColor={colors.surface[400]}
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons 
                name={showPassword ? 'eye-outline' : 'eye-off-outline'} 
                size={20} 
                color={colors.surface[400]} 
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <View style={[styles.inputContainer, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff',
            borderColor: isDark ? colors.surface[700] : colors.surface[200],
          }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.surface[400]} />
            <TextInput
              style={[styles.input, { color: isDark ? colors.surface[100] : colors.surface[900] }]}
              placeholder="Confirmar contraseña"
              placeholderTextColor={colors.surface[400]}
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              secureTextEntry={!showPassword}
            />
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.button, shadows.large]}
            onPress={handleRegister}
            disabled={loading}
          >
            <LinearGradient
              colors={gradients.kiwi}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Crear Cuenta</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Login Link */}
          <TouchableOpacity
            style={[styles.loginButton, { 
              borderColor: isDark ? colors.surface[700] : colors.surface[200],
            }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.loginText, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
              ¿Ya tienes cuenta?{' '}
              <Text style={{ color: colors.kiwi[500], fontWeight: '600' }}>
                Inicia sesión
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBackground: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 4,
  },
  vehicleGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  vehicleOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  vehicleIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  vehicleLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loginButton: {
    marginTop: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
  },
  loginText: {
    fontSize: 14,
  },
});
