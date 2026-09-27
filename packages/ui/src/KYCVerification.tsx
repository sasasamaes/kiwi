// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './utils';
import { ConsentCheckbox, ConsentLink } from './ConsentCheckbox';
import { Car, Check, CircleAlert, Clock, Search, Shield, X } from 'lucide-react';
import { FileDropZone } from './FileDropZone';

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
    color: 'bg-kiwi-100 text-kiwi-700',
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
  // Consentimiento explícito para el tratamiento de documentos de identidad
  // (dato personal sensible según Ley 8968). Sin esto, el envío se bloquea.
  const [dataConsent, setDataConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
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
  const [uploadError, setUploadError] = useState<string | null>(null);

  const status = kycData?.status || 'pending';
  const config = statusConfig[status];

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const removeFile = (field: string) => {
    updateField(field, null);
  };

  const handleSubmit = () => {
    const missing: string[] = [];
    if (!formData.idFront) missing.push('la foto del documento (frente)');
    if (!formData.selfie) missing.push('la selfie');
    if (role === 'driver' && !formData.license) missing.push('la licencia de conducir');
    if (role === 'merchant' && !formData.businessLicense) missing.push('la licencia comercial');
    if (missing.length > 0) {
      setUploadError(`Falta subir: ${missing.join(', ')}.`);
      return;
    }
    setUploadError(null);
    onSubmit(formData);
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
          <Check className="h-12 w-12" />
        </motion.div>
        <h3 className="text-lg font-display font-semibold text-kiwi-700 mb-2">Cuenta Verificada</h3>
        <p className="text-sm text-kiwi-700">
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
          <CircleAlert className="mx-auto h-12 w-12 text-red-600" aria-hidden />
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
          type="button"
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
          <Search className="h-12 w-12" />
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
          <p className="text-sm text-surface-500 dark:text-surface-400" id="kyc-idtype-label">
            Selecciona tu tipo de identificación:
          </p>
          <div
            role="radiogroup"
            aria-labelledby="kyc-idtype-label"
            className="grid grid-cols-2 gap-3"
          >
            {[
              { value: 'cedula', label: 'Cédula', icon: '🪪' },
              { value: 'passport', label: 'Pasaporte', icon: '📘' },
              { value: 'dimex', label: 'DIMEX', icon: '🪪' },
              { value: 'nite', label: 'NITE', icon: '🏢' },
            ].map((type) => (
              <motion.button
                key={type.value}
                type="button"
                role="radio"
                aria-checked={formData.idType === type.value}
                tabIndex={formData.idType === type.value ? 0 : -1}
                className={cn(
                  'flex flex-col items-center p-4 rounded-xl border-2 transition-all',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kiwi-600',
                  formData.idType === type.value
                    ? 'border-kiwi-600 bg-kiwi-50'
                    : 'border-surface-200 bg-white hover:border-surface-300',
                )}
                onClick={() => updateField('idType', type.value)}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-3xl mb-2" aria-hidden>
                  {type.icon}
                </span>
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
            <label
              htmlFor="kyc-id-number"
              className="block text-sm font-medium text-surface-700 mb-2"
            >
              Número de {formData.idType === 'cedula' ? 'Cédula' : 'Documento'}
            </label>
            <input
              id="kyc-id-number"
              type="text"
              value={formData.idNumber}
              onChange={(e) => updateField('idNumber', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-800 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              placeholder={formData.idType === 'cedula' ? '1-2345-6789' : 'Número de documento'}
            />
          </div>
          <div className="bg-surface-50 rounded-xl p-4">
            <p className="text-xs text-surface-500">
              📍 Tu documento será revisado por el equipo de verificación de Kiwi
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
          <FileDropZone
            label="Tomar foto o subir el frente del documento"
            accept="image/*"
            icon="📷"
            hint="JPG, PNG hasta 5MB"
            value={formData.idFront}
            onChange={(file) => updateField('idFront', file)}
          />
          {formData.idFront && (
            <button
              type="button"
              onClick={() => removeFile('idFront')}
              className="mx-auto flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4" aria-hidden /> Quitar archivo
            </button>
          )}
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
          <FileDropZone
            label="Tomar foto o subir el reverso del documento"
            accept="image/*"
            icon="📷"
            hint="JPG, PNG hasta 5MB"
            value={formData.idBack}
            onChange={(file) => updateField('idBack', file)}
          />
          {formData.idBack && (
            <button
              type="button"
              onClick={() => removeFile('idBack')}
              className="mx-auto flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4" aria-hidden /> Quitar archivo
            </button>
          )}
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
          <FileDropZone
            label="Tomar selfie sosteniendo el documento"
            accept="image/*"
            icon="🤳"
            hint="Cara visible + documento visible"
            value={formData.selfie}
            onChange={(file) => updateField('selfie', file)}
          />
          {formData.selfie && (
            <button
              type="button"
              onClick={() => removeFile('selfie')}
              className="mx-auto flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4" aria-hidden /> Quitar archivo
            </button>
          )}
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
                className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-800 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                placeholder="Número de licencia"
                aria-label="Número de licencia"
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
                className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-800 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                aria-label="Fecha de expiración de la licencia"
              />
            </div>
            <FileDropZone
              label="Subir foto de la licencia de conducir"
              accept="image/*,.pdf"
              icon="🪪"
              hint="Foto o PDF"
              value={formData.license}
              onChange={(file) => updateField('license', file)}
            />
            {formData.license && (
              <button
                type="button"
                onClick={() => removeFile('license')}
                className="mx-auto flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <X className="h-4 w-4" aria-hidden /> Quitar archivo
              </button>
            )}
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
            <FileDropZone
              label="Subir marchamo (registration) del vehículo"
              accept="image/*,.pdf"
              icon="🚗"
              hint="Foto o PDF"
              value={formData.vehicleRegister}
              onChange={(file) => updateField('vehicleRegister', file)}
            />
            {formData.vehicleRegister && (
              <button
                type="button"
                onClick={() => removeFile('vehicleRegister')}
                className="mx-auto flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <X className="h-4 w-4" aria-hidden /> Quitar archivo
              </button>
            )}
            <FileDropZone
              label="Subir seguro del vehículo"
              accept="image/*,.pdf"
              icon="🛡️"
              hint="Foto o PDF"
              value={formData.insurance}
              onChange={(file) => updateField('insurance', file)}
            />
            {formData.insurance && (
              <button
                type="button"
                onClick={() => removeFile('insurance')}
                className="mx-auto flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <X className="h-4 w-4" aria-hidden /> Quitar archivo
              </button>
            )}
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
                className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-800 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                placeholder="3-101-XXXXXX"
                aria-label="Cédula jurídica"
              />
            </div>
            <FileDropZone
              label="Subir licencia comercial"
              accept="image/*,.pdf"
              icon="🏪"
              hint="Foto o PDF"
              value={formData.businessLicense}
              onChange={(file) => updateField('businessLicense', file)}
            />
            {formData.businessLicense && (
              <button
                type="button"
                onClick={() => removeFile('businessLicense')}
                className="mx-auto flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <X className="h-4 w-4" aria-hidden /> Quitar archivo
              </button>
            )}
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
        <ConsentCheckbox
          checked={dataConsent}
          onChange={(checked) => {
            setDataConsent(checked);
            if (checked) setConsentError(false);
          }}
          error={consentError}
        >
          Autorizo a Kiwi a verificar mi identidad con los documentos que subí, a tratarlos
          únicamente para ese fin (revisión por el equipo de Kiwi, nunca visibles para otros
          usuarios) y a conservarlos mientras mi cuenta esté activa, según la{' '}
          <ConsentLink href="/privacy">política de privacidad</ConsentLink>.
        </ConsentCheckbox>
        <div className="bg-kiwi-50 rounded-xl p-4">
          <p className="text-sm text-kiwi-700 font-medium mb-2">📋 Resumen de tu verificación:</p>
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
              Foto del documento: {formData.idFront ? '✅ Subida' : '⏳ Pendiente'}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-kiwi-500">✓</span>
              Selfie: {formData.selfie ? '✅ Subida' : '⏳ Pendiente'}
            </li>
            {role === 'driver' && (
              <>
                <li className="flex items-center gap-2">
                  <span className="text-kiwi-500">✓</span>
                  Licencia: {formData.license ? '✅ Subida' : '⏳ Pendiente'}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-kiwi-500">✓</span>
                  Documentos vehículo: {formData.vehicleRegister ? '✅ Subidos' : '⏳ Pendientes'}
                </li>
              </>
            )}
            {role === 'merchant' && (
              <li className="flex items-center gap-2">
                <span className="text-kiwi-500">✓</span>
                Licencia comercial: {formData.businessLicense ? '✅ Subida' : '⏳ Pendiente'}
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
        <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400 mb-2">
          <span>
            Paso {step + 1} de {steps.length}
          </span>
          <span>{Math.round(((step + 1) / steps.length) * 100)}%</span>
        </div>
        <div
          className="h-2 bg-surface-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(((step + 1) / steps.length) * 100)}
          aria-label="Progreso de la verificación"
        >
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

      {uploadError && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600 dark:bg-red-900/30"
        >
          {uploadError}
        </p>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        {step > 0 && (
          <motion.button
            type="button"
            className="flex-1 py-3 rounded-xl border border-surface-200 text-surface-600 font-medium"
            onClick={() => setStep(step - 1)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            ← Atrás
          </motion.button>
        )}
        <motion.button
          type="button"
          className={cn(
            'flex-1 py-3 rounded-xl font-medium text-white',
            step === steps.length - 1 ? 'bg-kiwi-gradient' : 'bg-surface-800',
          )}
          onClick={() => {
            if (step === steps.length - 1) {
              if (!dataConsent) {
                setConsentError(true);
                return;
              }
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
                <Clock className="h-4 w-4" />
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
  // Fallback defensivo: el backend puede devolver estados fuera del union
  // (ej. 'not_submitted' cuando nunca se inició verificación).
  const config = statusConfig[status] ?? statusConfig.pending;

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
