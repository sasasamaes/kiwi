'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './utils';
import { Car, Shield } from 'lucide-react';

export type KYCStatus =
  'pending' | 'documents_submitted' | 'under_review' | 'approved' | 'rejected' | 'expired';

export interface KYCData {
  status: KYCStatus;
  idType?: string;
  idNumber?: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  selfieUrl?: string;
  licenseNumber?: string;
  licenseExpiry?: Date;
  licenseUrl?: string;
  vehicleRegisterUrl?: string;
  insuranceUrl?: string;
  businessLicenseUrl?: string;
  taxId?: string;
  rejectionReason?: string;
}

interface KYCVerificationProps {
  role: 'merchant' | 'driver';
  kycData?: KYCData;
  onSubmit: (data: any) => void;
  loading?: boolean;
}

const statusConfig: Record<
  KYCStatus,
  { label: string; color: string; icon: string; description: string }
> = {
  pending: {
    label: 'Pendiente',
    color: 'bg-surface-100 text-surface-600',
    icon: 'file',
    description: 'Sube tus documentos para verificar tu cuenta',
  },
  documents_submitted: {
    label: 'Documentos Enviados',
    color: 'bg-blue-100 text-blue-600',
    icon: 'upload',
    description: 'Tus documentos están siendo revisados',
  },
  under_review: {
    label: 'En Revisión',
    color: 'bg-gold-100 text-gold-600',
    icon: 'search',
    description: 'Estamos verificando tu información',
  },
  approved: {
    label: 'Verificado',
    color: 'bg-kiwi-100 text-kiwi-600',
    icon: 'Check',
    description: 'Tu cuenta ha sido verificada exitosamente',
  },
  rejected: {
    label: 'Rechazado',
    color: 'bg-red-100 text-red-600',
    icon: 'close',
    description: 'Hubo un problema con tus documentos',
  },
  expired: {
    label: 'Expirado',
    color: 'bg-orange-100 text-orange-600',
    icon: '⏰',
    description: 'Tus documentos han expirado, actualízalos',
  },
};

export function KYCVerification({
  role,
  kycData,
  onSubmit,
  loading = false,
}: KYCVerificationProps) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    idType: 'cedula',
    idNumber: '',
    idFront: null as File | null,
    idBack: null as File | null,
    selfie: null as File | null,
    licenseNumber: '',
    licenseExpiry: '',
    license: null as File | null,
    vehicleRegister: null as File | null,
    insurance: null as File | null,
    businessLicense: null as File | null,
    taxId: '',
  });

  const status = kycData?.status || 'pending';
  const config = statusConfig[status];

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // If already approved, show success
  if (status === 'approved') {
    return (
      <motion.div
        className="rounded-2xl bg-kiwi-50 border border-kiwi-200 p-6 text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          className="text-6xl mb-4"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.5 }}
        >
          Check
        </motion.div>
        <h3 className="text-lg font-display font-semibold text-kiwi-700 mb-2">Cuenta Verificada</h3>
        <p className="text-sm text-kiwi-600">
          Tu identidad ha sido verificada. Ya puedes usar todas las funciones de Kiwi.
        </p>
      </motion.div>
    );
  }

  // If rejected, show error with option to resubmit
  if (status === 'rejected') {
    return (
      <motion.div
        className="rounded-2xl bg-red-50 border border-red-200 p-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="text-center mb-4">
          <span className="text-4xl">X</span>
          <h3 className="text-lg font-display font-semibold text-red-700 mt-2">
            Verificación Rechazada
          </h3>
        </div>
        <div className="bg-white rounded-xl p-4 mb-4">
          <p className="text-sm text-red-600 font-medium">Razón:</p>
          <p className="text-sm text-surface-600">
            {kycData?.rejectionReason || 'Documentos no claros o incompletos'}
          </p>
        </div>
        <motion.button
          className="w-full py-3 rounded-xl bg-kiwi-gradient text-white font-semibold"
          onClick={() => setStep(0)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Volver a Intentar
        </motion.button>
      </motion.div>
    );
  }

  // If under review or submitted, show status
  if (status === 'under_review' || status === 'documents_submitted') {
    return (
      <motion.div
        className="rounded-2xl bg-gold-50 border border-gold-200 p-6 text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          className="text-6xl mb-4"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Search
        </motion.div>
        <h3 className="text-lg font-display font-semibold text-gold-700 mb-2">{config.label}</h3>
        <p className="text-sm text-gold-600">{config.description}</p>
        <p className="text-xs text-surface-400 mt-4">Tiempo estimado: 24-48 horas</p>
      </motion.div>
    );
  }

  // KYC Form Steps
  const steps = [
    // Step 0: ID Type Selection
    {
      title: 'Tipo de Documento',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-surface-500">Selecciona tu tipo de identificación:</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'cedula', label: 'Cédula', icon: '🪪' },
              { value: 'passport', label: 'Pasaporte', icon: '📘' },
              { value: 'dimex', label: 'DIMEX', icon: '🪪' },
              { value: 'nite', label: 'NITE', icon: '🏢' },
            ].map((type) => (
              <motion.button
                key={type.value}
                className={cn(
                  'flex flex-col items-center p-4 rounded-xl border-2 transition-all',
                  formData.idType === type.value
                    ? 'border-kiwi-500 bg-kiwi-50'
                    : 'border-surface-200 bg-white hover:border-surface-300',
                )}
                onClick={() => updateField('idType', type.value)}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-3xl mb-2">{type.icon}</span>
                <span className="text-sm font-medium text-surface-700">{type.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      ),
    },
    // Step 1: ID Number
    {
      title: 'Número de Documento',
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">
              Número de {formData.idType === 'cedula' ? 'Cédula' : 'Documento'}
            </label>
            <input
              type="text"
              value={formData.idNumber}
              onChange={(e) => updateField('idNumber', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-800 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
              placeholder={formData.idType === 'cedula' ? '1-2345-6789' : 'Número de documento'}
            />
          </div>
          <div className="bg-surface-50 rounded-xl p-4">
            <p className="text-xs text-surface-500">
              MapPin Tu número de documento será verificado con el Registro Civil
            </p>
          </div>
        </div>
      ),
    },
    // Step 2: Upload ID Front
    {
      title: 'Foto del Documento (Frente)',
      content: (
        <div className="space-y-4">
          <div className="bg-surface-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-surface-500">
              📸 Toma una foto clara de la frente de tu documento
            </p>
          </div>
          <motion.div
            className="border-2 border-dashed border-surface-300 rounded-xl p-8 text-center hover:border-kiwi-400 transition-colors cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="text-4xl mb-4 block">📷</span>
            <p className="text-sm font-medium text-surface-700">Tomar foto o subir archivo</p>
            <p className="text-xs text-surface-400 mt-1">JPG, PNG hasta 5MB</p>
          </motion.div>
        </div>
      ),
    },
    // Step 3: Upload ID Back
    {
      title: 'Foto del Documento (Reverso)',
      content: (
        <div className="space-y-4">
          <div className="bg-surface-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-surface-500">
              📸 Toma una foto clara del reverso de tu documento
            </p>
          </div>
          <motion.div
            className="border-2 border-dashed border-surface-300 rounded-xl p-8 text-center hover:border-kiwi-400 transition-colors cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="text-4xl mb-4 block">📷</span>
            <p className="text-sm font-medium text-surface-700">Tomar foto o subir archivo</p>
            <p className="text-xs text-surface-400 mt-1">JPG, PNG hasta 5MB</p>
          </motion.div>
        </div>
      ),
    },
    // Step 4: Selfie
    {
      title: 'Foto Selfie',
      content: (
        <div className="space-y-4">
          <div className="bg-surface-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-surface-500">
              🤳 Toma un selfie sosteniendo tu documento de identidad
            </p>
          </div>
          <motion.div
            className="border-2 border-dashed border-surface-300 rounded-xl p-8 text-center hover:border-kiwi-400 transition-colors cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="text-4xl mb-4 block">🤳</span>
            <p className="text-sm font-medium text-surface-700">Tomar selfie</p>
            <p className="text-xs text-surface-400 mt-1">Cara visible + documento visible</p>
          </motion.div>
        </div>
      ),
    },
  ];

  // Add driver-specific steps
  if (role === 'driver') {
    steps.push(
      // Step 5: Driver License
      {
        title: 'Licencia de Conducir',
        content: (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">
                Número de Licencia
              </label>
              <input
                type="text"
                value={formData.licenseNumber}
                onChange={(e) => updateField('licenseNumber', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-800 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
                placeholder="Número de licencia"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">
                Fecha de Expiración
              </label>
              <input
                type="date"
                value={formData.licenseExpiry}
                onChange={(e) => updateField('licenseExpiry', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-800 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
              />
            </div>
            <motion.div
              className="border-2 border-dashed border-surface-300 rounded-xl p-6 text-center hover:border-kiwi-400 transition-colors cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-3xl mb-2 block">🪪</span>
              <p className="text-sm font-medium text-surface-700">Subir foto de licencia</p>
            </motion.div>
          </div>
        ),
      },
      // Step 6: Vehicle Documents
      {
        title: 'Documentos del Vehículo',
        content: (
          <div className="space-y-4">
            <div className="bg-surface-50 rounded-xl p-4 mb-4">
              <p className="text-xs text-surface-500">📄 Sube el marchamo y seguro del vehículo</p>
            </div>
            <motion.div
              className="border-2 border-dashed border-surface-300 rounded-xl p-6 text-center hover:border-kiwi-400 transition-colors cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Car className="text-3xl mb-2 block h-8 w-8" />
              <p className="text-sm font-medium text-surface-700">Marchamo (registration)</p>
              <p className="text-xs text-surface-400">Foto o PDF</p>
            </motion.div>
            <motion.div
              className="border-2 border-dashed border-surface-300 rounded-xl p-6 text-center hover:border-kiwi-400 transition-colors cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Shield className="text-3xl mb-2 block h-8 w-8" />
              <p className="text-sm font-medium text-surface-700">Seguro del vehículo</p>
              <p className="text-xs text-surface-400">Foto o PDF</p>
            </motion.div>
          </div>
        ),
      },
    );
  }

  // Add merchant-specific steps
  if (role === 'merchant') {
    steps.push(
      // Step 5: Business License
      {
        title: 'Licencia de Negocio',
        content: (
          <div className="space-y-4">
            <div className="bg-surface-50 rounded-xl p-4 mb-4">
              <p className="text-xs text-surface-500">
                📄 Sube tu patente municipal o licencia de negocio
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">
                Número de Cédula Jurídica
              </label>
              <input
                type="text"
                value={formData.taxId}
                onChange={(e) => updateField('taxId', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-800 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
                placeholder="3-101-XXXXXX"
              />
            </div>
            <motion.div
              className="border-2 border-dashed border-surface-300 rounded-xl p-6 text-center hover:border-kiwi-400 transition-colors cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-3xl mb-2 block">🏪</span>
              <p className="text-sm font-medium text-surface-700">Subir licencia comercial</p>
              <p className="text-xs text-surface-400">Foto o PDF</p>
            </motion.div>
          </div>
        ),
      },
    );
  }

  // Final step: Review
  steps.push({
    title: 'Revisar y Enviar',
    content: (
      <div className="space-y-4">
        <div className="bg-kiwi-50 rounded-xl p-4">
          <p className="text-sm text-kiwi-700 font-medium mb-2">
            ClipboardList Resumen de tu verificación:
          </p>
          <ul className="space-y-2 text-sm text-surface-600">
            <li className="flex items-center gap-2">
              <span className="text-kiwi-500">✓</span>
              Documento: {formData.idType === 'cedula' ? 'Cédula' : 'Otro'}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-kiwi-500">✓</span>
              Número: {formData.idNumber || 'No ingresado'}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-kiwi-500">✓</span>
              Foto del documento: {formData.idFront ? 'Check Subida' : 'Clock Pendiente'}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-kiwi-500">✓</span>
              Selfie: {formData.selfie ? 'Check Subida' : 'Clock Pendiente'}
            </li>
            {role === 'driver' && (
              <>
                <li className="flex items-center gap-2">
                  <span className="text-kiwi-500">✓</span>
                  Licencia: {formData.license ? 'Check Subida' : 'Clock Pendiente'}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-kiwi-500">✓</span>
                  Documentos vehículo:{' '}
                  {formData.vehicleRegister ? 'Check Subidos' : 'Clock Pendientes'}
                </li>
              </>
            )}
            {role === 'merchant' && (
              <li className="flex items-center gap-2">
                <span className="text-kiwi-500">✓</span>
                Licencia comercial: {formData.businessLicense ? 'Check Subida' : 'Clock Pendiente'}
              </li>
            )}
          </ul>
        </div>
        <div className="bg-surface-50 rounded-xl p-4">
          <p className="text-xs text-surface-500">
            ⏱️ La verificación toma 24-48 horas hábiles. Recibirás una notificación cuando sea
            completada.
          </p>
        </div>
      </div>
    ),
  });

  return (
    <div className="max-w-md mx-auto">
      {/* Status Badge */}
      <motion.div
        className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6', config.color)}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <span>{config.icon}</span>
        <span className="text-sm font-medium">{config.label}</span>
      </motion.div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-surface-400 mb-2">
          <span>
            Paso {step + 1} de {steps.length}
          </span>
          <span>{Math.round(((step + 1) / steps.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
          <motion.div
            className="h-2 bg-kiwi-gradient rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Step Content */}
      <motion.div
        className="bg-white rounded-2xl shadow-soft p-6 mb-6"
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
      >
        <h3 className="text-lg font-display font-semibold text-surface-800 mb-4">
          {steps[step].title}
        </h3>
        {steps[step].content}
      </motion.div>

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        {step > 0 && (
          <motion.button
            className="flex-1 py-3 rounded-xl border border-surface-200 text-surface-600 font-medium"
            onClick={() => setStep(step - 1)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            ← Atrás
          </motion.button>
        )}
        <motion.button
          className={cn(
            'flex-1 py-3 rounded-xl font-medium text-white',
            step === steps.length - 1 ? 'bg-kiwi-gradient' : 'bg-surface-800',
          )}
          onClick={() => {
            if (step === steps.length - 1) {
              handleSubmit();
            } else {
              setStep(step + 1);
            }
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                Clock
              </motion.span>
              Enviando...
            </span>
          ) : step === steps.length - 1 ? (
            'Enviar Verificación'
          ) : (
            'Siguiente →'
          )}
        </motion.button>
      </div>
    </div>
  );
}

// KYC Status Badge component
interface KYCStatusBadgeProps {
  status: KYCStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function KYCStatusBadge({ status, size = 'md' }: KYCStatusBadgeProps) {
  const config = statusConfig[status];

  const sizes = {
    sm: 'h-6 px-2 text-xs',
    md: 'h-8 px-3 text-sm',
    lg: 'h-10 px-4 text-base',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.color,
        sizes[size],
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
