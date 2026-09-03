import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../hooks/useTheme';
import { colors, gradients, shadows } from '../utils/theme';
import { api } from '../services/api';

type KYCStep = 'intro' | 'identity' | 'license' | 'vehicle' | 'selfie' | 'review';

interface KYCData {
  idType: string;
  idNumber: string;
  idFrontUri: string | null;
  idBackUri: string | null;
  licenseNumber: string;
  licenseExpiry: string;
  licenseUri: string | null;
  vehicleRegisterUri: string | null;
  insuranceUri: string | null;
  selfieUri: string | null;
}

export default function KycScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const [step, setStep] = useState<KYCStep>('intro');
  const [kycStatus, setKycStatus] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<KYCData>({
    idType: 'cedula',
    idNumber: '',
    idFrontUri: null,
    idBackUri: null,
    licenseNumber: '',
    licenseExpiry: '',
    licenseUri: null,
    vehicleRegisterUri: null,
    insuranceUri: null,
    selfieUri: null,
  });

  useEffect(() => {
    fetchKYCStatus();
  }, []);

  const fetchKYCStatus = async () => {
    try {
      const status = await api.getKYCStatus();
      setKycStatus(status.status || 'pending');
      if (status.status === 'approved') {
        setStep('review');
      }
    } catch (error) {
      console.error('Failed to fetch KYC status:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (field: keyof KYCData) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir documentos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      setData({ ...data, [field]: result.assets[0].uri });
    }
  };

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar tu selfie');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      setData({ ...data, selfieUri: result.assets[0].uri });
    }
  };

  const handleSubmit = async () => {
    if (!data.idFrontUri || !data.idBackUri) {
      Alert.alert('Error', 'Debes subir fotos de tu cédula (frente y reverso)');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('idType', data.idType);
      formData.append('idNumber', data.idNumber);
      formData.append('licenseNumber', data.licenseNumber);
      formData.append('licenseExpiry', data.licenseExpiry);

      if (data.idFrontUri) {
        formData.append('idFront', {
          uri: data.idFrontUri,
          type: 'image/jpeg',
          name: 'id-front.jpg',
        } as any);
      }
      if (data.idBackUri) {
        formData.append('idBack', {
          uri: data.idBackUri,
          type: 'image/jpeg',
          name: 'id-back.jpg',
        } as any);
      }
      if (data.licenseUri) {
        formData.append('license', {
          uri: data.licenseUri,
          type: 'image/jpeg',
          name: 'license.jpg',
        } as any);
      }
      if (data.vehicleRegisterUri) {
        formData.append('vehicleRegister', {
          uri: data.vehicleRegisterUri,
          type: 'image/jpeg',
          name: 'vehicle-register.jpg',
        } as any);
      }
      if (data.insuranceUri) {
        formData.append('insurance', {
          uri: data.insuranceUri,
          type: 'image/jpeg',
          name: 'insurance.jpg',
        } as any);
      }
      if (data.selfieUri) {
        formData.append('selfie', {
          uri: data.selfieUri,
          type: 'image/jpeg',
          name: 'selfie.jpg',
        } as any);
      }

      await api.submitKYC(formData);
      Alert.alert(
        'Documentos enviados',
        'Tus documentos están siendo revisados. Te notificaremos cuando sea aprobado.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudieron enviar los documentos');
    } finally {
      setSubmitting(false);
    }
  };

  const renderImagePicker = (label: string, field: keyof KYCData, required = true) => (
    <TouchableOpacity
      style={[styles.imagePicker, { 
        backgroundColor: isDark ? colors.surface[800] : colors.surface[100],
        borderColor: data[field] ? colors.kiwi[500] : isDark ? colors.surface[700] : colors.surface[200],
      }]}
      onPress={() => pickImage(field)}
    >
      {data[field] ? (
        <Image source={{ uri: data[field] as string }} style={styles.previewImage} />
      ) : (
        <>
          <Ionicons name="camera-outline" size={32} color={colors.surface[400]} />
          <Text style={[styles.imagePickerText, { color: colors.surface[400] }]}>
            {label} {required && '*'}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );

  const renderIntroStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <LinearGradient colors={gradients.kiwi} style={styles.iconBackground}>
          <Ionicons name="shield-checkmark-outline" size={48} color="#fff" />
        </LinearGradient>
      </View>
      <Text style={[styles.stepTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
        Verificación KYC
      </Text>
      <Text style={[styles.stepSubtitle, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
        Para comenzar a trabajar en Kiwi, necesitamos verificar tu identidad. Esto protege a todos los usuarios de la plataforma.
      </Text>
      
      <View style={[styles.infoCard, { backgroundColor: isDark ? colors.surface[800] : colors.surface[100] }]}>
        <Text style={[styles.infoTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
          ClipboardList Documentos necesarios:
        </Text>
        <Text style={[styles.infoItem, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
          • Cédula de identidad (frente y reverso)
        </Text>
        <Text style={[styles.infoItem, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
          • Licencia de conducir vigente
        </Text>
        <Text style={[styles.infoItem, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
          • Registro del vehículo
        </Text>
        <Text style={[styles.infoItem, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
          • Selfie de verificación
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setStep('identity')}
      >
        <LinearGradient colors={gradients.kiwi} style={styles.primaryButtonGradient}>
          <Text style={styles.primaryButtonText}>Comenzar verificación</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderIdentityStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
        🪪 Identidad
      </Text>
      <Text style={[styles.stepSubtitle, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
        Sube fotos de tu cédula de identidad
      </Text>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
          Tipo de documento
        </Text>
        <View style={styles.radioGroup}>
          {['cedula', 'passport', 'dimex'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.radioOption, data.idType === type && styles.radioOptionActive]}
              onPress={() => setData({ ...data, idType: type })}
            >
              <Text style={[styles.radioText, data.idType === type && styles.radioTextActive]}>
                {type === 'cedula' ? 'Cédula' : type === 'passport' ? 'Pasaporte' : 'DIMEX'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
          Número de documento *
        </Text>
        <TextInput
          style={[styles.input, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff',
            color: isDark ? colors.surface[100] : colors.surface[900],
            borderColor: isDark ? colors.surface[700] : colors.surface[200],
          }]}
          placeholder="1-2345-6789"
          placeholderTextColor={colors.surface[400]}
          value={data.idNumber}
          onChangeText={(text) => setData({ ...data, idNumber: text })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.imageGrid}>
        <View style={styles.imageGridItem}>
          <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
            Frente *
          </Text>
          {renderImagePicker('Foto frente', 'idFrontUri')}
        </View>
        <View style={styles.imageGridItem}>
          <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
            Reverso *
          </Text>
          {renderImagePicker('Foto reverso', 'idBackUri')}
        </View>
      </View>

      <View style={styles.navButtons}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('intro')}>
          <Text style={[styles.secondaryButtonText, { color: colors.kiwi[500] }]}>Atrás</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { flex: 1 }]}
          onPress={() => setStep('license')}
        >
          <LinearGradient colors={gradients.kiwi} style={styles.primaryButtonGradient}>
            <Text style={styles.primaryButtonText}>Siguiente</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLicenseStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
        Car Licencia de conducir
      </Text>
      <Text style={[styles.stepSubtitle, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
        Sube tu licencia de conducir vigente
      </Text>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
          Número de licencia
        </Text>
        <TextInput
          style={[styles.input, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff',
            color: isDark ? colors.surface[100] : colors.surface[900],
            borderColor: isDark ? colors.surface[700] : colors.surface[200],
          }]}
          placeholder="123456789"
          placeholderTextColor={colors.surface[400]}
          value={data.licenseNumber}
          onChangeText={(text) => setData({ ...data, licenseNumber: text })}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
          Fecha de expiración
        </Text>
        <TextInput
          style={[styles.input, { 
            backgroundColor: isDark ? colors.surface[800] : '#fff',
            color: isDark ? colors.surface[100] : colors.surface[900],
            borderColor: isDark ? colors.surface[700] : colors.surface[200],
          }]}
          placeholder="2025-12-31"
          placeholderTextColor={colors.surface[400]}
          value={data.licenseExpiry}
          onChangeText={(text) => setData({ ...data, licenseExpiry: text })}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
          Foto de la licencia
        </Text>
        {renderImagePicker('Subir licencia', 'licenseUri', false)}
      </View>

      <View style={styles.navButtons}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('identity')}>
          <Text style={[styles.secondaryButtonText, { color: colors.kiwi[500] }]}>Atrás</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { flex: 1 }]}
          onPress={() => setStep('vehicle')}
        >
          <LinearGradient colors={gradients.kiwi} style={styles.primaryButtonGradient}>
            <Text style={styles.primaryButtonText}>Siguiente</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderVehicleStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
        🚙 Documentos del vehículo
      </Text>
      <Text style={[styles.stepSubtitle, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
        Sube los documentos de tu vehículo (opcional pero recomendado)
      </Text>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
          Registro del vehículo
        </Text>
        {renderImagePicker('Subir registro', 'vehicleRegisterUri', false)}
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
          Seguro del vehículo
        </Text>
        {renderImagePicker('Subir seguro', 'insuranceUri', false)}
      </View>

      <View style={styles.navButtons}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('license')}>
          <Text style={[styles.secondaryButtonText, { color: colors.kiwi[500] }]}>Atrás</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { flex: 1 }]}
          onPress={() => setStep('selfie')}
        >
          <LinearGradient colors={gradients.kiwi} style={styles.primaryButtonGradient}>
            <Text style={styles.primaryButtonText}>Siguiente</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSelfieStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
        🤳 Selfie de verificación
      </Text>
      <Text style={[styles.stepSubtitle, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
        Toma una selfie para verificar tu identidad
      </Text>

      <TouchableOpacity
        style={[styles.selfieButton, { 
          backgroundColor: isDark ? colors.surface[800] : colors.surface[100],
          borderColor: data.selfieUri ? colors.kiwi[500] : isDark ? colors.surface[700] : colors.surface[200],
        }]}
        onPress={takeSelfie}
      >
        {data.selfieUri ? (
          <Image source={{ uri: data.selfieUri }} style={styles.selfieImage} />
        ) : (
          <>
            <Ionicons name="camera" size={48} color={colors.kiwi[500]} />
            <Text style={[styles.selfieText, { color: isDark ? colors.surface[300] : colors.surface[600] }]}>
              Tocar para tomar selfie
            </Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.navButtons}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('vehicle')}>
          <Text style={[styles.secondaryButtonText, { color: colors.kiwi[500] }]}>Atrás</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { flex: 1 }]}
          onPress={() => setStep('review')}
        >
          <LinearGradient colors={gradients.kiwi} style={styles.primaryButtonGradient}>
            <Text style={styles.primaryButtonText}>Revisar</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReviewStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
        ClipboardList Resumen
      </Text>
      <Text style={[styles.stepSubtitle, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
        Revisa tu información antes de enviar
      </Text>

      <View style={[styles.summaryCard, { backgroundColor: isDark ? colors.surface[800] : colors.surface[100] }]}>
        <SummaryRow label="Tipo de documento" value={data.idType === 'cedula' ? 'Cédula' : data.idType === 'passport' ? 'Pasaporte' : 'DIMEX'} isDark={isDark} />
        <SummaryRow label="Número" value={data.idNumber || 'No especificado'} isDark={isDark} />
        <SummaryRow label="Licencia" value={data.licenseNumber || 'No especificado'} isDark={isDark} />
        <SummaryRow label="Fotos subidas" value={`${[data.idFrontUri, data.idBackUri, data.licenseUri, data.selfieUri].filter(Boolean).length}/4`} isDark={isDark} />
      </View>

      <View style={styles.navButtons}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('selfie')}>
          <Text style={[styles.secondaryButtonText, { color: colors.kiwi[500] }]}>Atrás</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { flex: 1 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <LinearGradient colors={gradients.kiwi} style={styles.primaryButtonGradient}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Enviar documentos</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderApprovedView = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <LinearGradient colors={['#22c55e', '#16a34a']} style={styles.iconBackground}>
          <Ionicons name="checkmark-circle" size={48} color="#fff" />
        </LinearGradient>
      </View>
      <Text style={[styles.stepTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
        Verificado
      </Text>
      <Text style={[styles.stepSubtitle, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>
        Tu identidad ha sido verificada exitosamente. Ya puedes comenzar a trabajar en Kiwi.
      </Text>
    </View>
  );

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
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.surface[950] : colors.surface[50] }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={isDark ? colors.surface[100] : colors.surface[900]} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDark ? colors.surface[100] : colors.surface[900] }]}>
            Verificación KYC
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Progress Bar */}
        {kycStatus !== 'approved' && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: isDark ? colors.surface[800] : colors.surface[200] }]}>
              <LinearGradient
                colors={gradients.kiwi}
                style={[styles.progressFill, { width: `${(Object.keys(data).filter(k => data[k as keyof KYCData]).length / 7) * 100}%` }]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.surface[400] }]}>
              Paso {step === 'intro' ? '0' : step === 'identity' ? '1' : step === 'license' ? '2' : step === 'vehicle' ? '3' : step === 'selfie' ? '4' : '5'} de 5
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {kycStatus === 'approved' && renderApprovedView()}
          {kycStatus !== 'approved' && step === 'intro' && renderIntroStep()}
          {kycStatus !== 'approved' && step === 'identity' && renderIdentityStep()}
          {kycStatus !== 'approved' && step === 'license' && renderLicenseStep()}
          {kycStatus !== 'approved' && step === 'vehicle' && renderVehicleStep()}
          {kycStatus !== 'approved' && step === 'selfie' && renderSelfieStep()}
          {kycStatus !== 'approved' && step === 'review' && renderReviewStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: isDark ? colors.surface[400] : colors.surface[500] }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: isDark ? colors.surface[100] : colors.surface[900]]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  progressContainer: { paddingHorizontal: 20, marginBottom: 8 },
  progressBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 12, marginTop: 4, textAlign: 'right' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },
  stepContent: { paddingTop: 20 },
  iconContainer: { alignItems: 'center', marginBottom: 24 },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.large,
  },
  stepTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  stepSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  infoCard: { borderRadius: 16, padding: 20, marginBottom: 24 },
  infoTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  infoItem: { fontSize: 14, marginBottom: 6, lineHeight: 20 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  radioGroup: { flexDirection: 'row', gap: 8 },
  radioOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  radioOptionActive: {
    borderColor: colors.kiwi[500],
    backgroundColor: colors.kiwi[50],
  },
  radioText: { fontSize: 14, color: colors.surface[400] },
  radioTextActive: { color: colors.kiwi[600], fontWeight: '600' },
  imageGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  imageGridItem: { flex: 1 },
  imagePicker: {
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imagePickerText: { fontSize: 12, marginTop: 8, textAlign: 'center' },
  previewImage: { width: '100%', height: '100%' },
  selfieButton: {
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  selfieImage: { width: '100%', height: '100%', borderRadius: 16 },
  selfieText: { fontSize: 14, marginTop: 12 },
  summaryCard: { borderRadius: 16, padding: 20, marginBottom: 24 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '600' },
  navButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  primaryButton: { borderRadius: 12, overflow: 'hidden' },
  primaryButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.kiwi[500],
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
});
