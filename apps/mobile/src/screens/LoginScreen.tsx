import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
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

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? colors.surface[950] : colors.surface[50] }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={gradients.kiwi}
            style={styles.logoBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.logoEmoji}></Text>
          </LinearGradient>
          <Text style={[styles.title, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Kiwi Driver
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
            Tu app de repartos
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={[styles.inputContainer, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff',
            borderColor: isDark ? colors.surface[700] : colors.surface[200],
          }]}>
            <Ionicons name="mail-outline" size={20} color={colors.surface[400]} />
            <TextInput
              style={[styles.input, { color: isDark ? colors.surface[100] : colors.surface[900] }]}
              placeholder="Email"
              placeholderTextColor={colors.surface[400]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.inputContainer, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff',
            borderColor: isDark ? colors.surface[700] : colors.surface[200],
          }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.surface[400]} />
            <TextInput
              style={[styles.input, { color: isDark ? colors.surface[100] : colors.surface[900] }]}
              placeholder="Contraseña"
              placeholderTextColor={colors.surface[400]}
              value={password}
              onChangeText={setPassword}
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

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={[styles.forgotPasswordText, { color: colors.kiwi[500] }]}>
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, shadows.large]}
            onPress={handleLogin}
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
                <Text style={styles.buttonText}>Iniciar Sesión</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.registerButton, { 
              borderColor: isDark ? colors.surface[700] : colors.surface[200],
            }]}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={[styles.registerText, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
              ¿No tienes cuenta?{' '}
              <Text style={{ color: colors.kiwi[500], fontWeight: '600' }}>
                Regístrate
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoBackground: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    gap: 16,
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
  forgotPassword: {
    alignItems: 'flex-end',
    marginTop: -4,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
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
  registerButton: {
    marginTop: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
  },
  registerText: {
    fontSize: 14,
  },
});
