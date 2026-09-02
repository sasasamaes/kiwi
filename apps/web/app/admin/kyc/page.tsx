'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const mockKYC = [
  { 
    id: '1', 
    userId: '2', 
    userName: 'María García', 
    userEmail: 'maria@email.com',
    role: 'driver',
    documentType: 'Cédula',
    documentNumber: '123456789',
    submittedAt: '2024-03-20',
    status: 'pending',
    documents: {
      front: '/doc-front.jpg',
      back: '/doc-back.jpg',
      selfie: '/selfie.jpg',
      license: '/license.jpg',
    }
  },
  { 
    id: '2', 
    userId: '7', 
    userName: 'Los Efes', 
    userEmail: 'efes@email.com',
    role: 'merchant',
    documentType: 'Cédula Jurídica',
    documentNumber: '3-102-123456',
    submittedAt: '2024-03-18',
    status: 'pending',
    documents: {
      front: '/doc-front.jpg',
      back: '/doc-back.jpg',
      selfie: '/selfie.jpg',
      license: '/business-license.jpg',
    }
  },
  { 
    id: '3', 
    userId: '1', 
    userName: 'Juan Carlos', 
    userEmail: 'juan@email.com',
    role: 'driver',
    documentType: 'Cédula',
    documentNumber: '987654321',
    submittedAt: '2024-03-15',
    status: 'approved',
    reviewedAt: '2024-03-16',
    reviewedBy: 'Admin',
  },
  { 
    id: '4', 
    userId: '9', 
    userName: 'Pedro Pérez', 
    userEmail: 'pedro@email.com',
    role: 'driver',
    documentType: 'DIMEX',
    documentNumber: 'DIMEX-12345',
    submittedAt: '2024-03-10',
    status: 'rejected',
    reviewedAt: '2024-03-11',
    reviewedBy: 'Admin',
    rejectionReason: 'Documento ilegible',
  },
];

export default function KYCPage() {
  const [verifications, setVerifications] = useState(mockKYC);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedKYC, setSelectedKYC] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const filteredVerifications = verifications.filter(kyc => 
    filter === 'all' || kyc.status === filter
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-surface-100 text-surface-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'approved': return 'Aprobado';
      case 'rejected': return 'Rechazado';
      default: return status;
    }
  };

  const handleApprove = async (kycId: string) => {
    setActionLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setVerifications(prev => prev.map(kyc => 
      kyc.id === kycId ? { ...kyc, status: 'approved', reviewedAt: new Date().toISOString(), reviewedBy: 'Admin' } : kyc
    ));
    setSelectedKYC(null);
    setActionLoading(false);
  };

  const handleReject = async (kycId: string, reason: string) => {
    setActionLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setVerifications(prev => prev.map(kyc => 
      kyc.id === kycId ? { ...kyc, status: 'rejected', reviewedAt: new Date().toISOString(), reviewedBy: 'Admin', rejectionReason: reason } : kyc
    ));
    setSelectedKYC(null);
    setActionLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            Verificaciones KYC
          </h1>
          <p className="text-surface-500 dark:text-surface-400">
            {verifications.filter(k => k.status === 'pending').length} pendientes de revisión
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: 'Todos', count: verifications.length },
          { value: 'pending', label: 'Pendientes', count: verifications.filter(k => k.status === 'pending').length },
          { value: 'approved', label: 'Aprobados', count: verifications.filter(k => k.status === 'approved').length },
          { value: 'rejected', label: 'Rechazados', count: verifications.filter(k => k.status === 'rejected').length },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value as any)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === tab.value
                ? 'bg-kiwi-500 text-white'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Verifications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVerifications.map((kyc, index) => (
          <motion.div
            key={kyc.id}
            className={`rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark cursor-pointer hover:shadow-medium dark:hover:shadow-dark transition-all ${
              kyc.status === 'pending' ? 'border-2 border-yellow-200 dark:border-yellow-800' : ''
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => setSelectedKYC(kyc)}
            whileHover={{ y: -4 }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold ${
                  kyc.role === 'driver' 
                    ? 'bg-kiwi-100 dark:bg-kiwi-900/30 text-kiwi-600 dark:text-kiwi-400'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                }`}>
                  {kyc.role === 'driver' ? '🛵' : '🏪'}
                </div>
                <div>
                  <p className="font-semibold text-surface-800 dark:text-surface-100">{kyc.userName}</p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">{kyc.userEmail}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(kyc.status)}`}>
                {getStatusLabel(kyc.status)}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-surface-500 dark:text-surface-400">Tipo documento</span>
                <span className="text-surface-800 dark:text-surface-200">{kyc.documentType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500 dark:text-surface-400">Número</span>
                <span className="text-surface-800 dark:text-surface-200 font-mono">{kyc.documentNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500 dark:text-surface-400">Enviado</span>
                <span className="text-surface-800 dark:text-surface-200">
                  {new Date(kyc.submittedAt).toLocaleDateString('es-CR')}
                </span>
              </div>
            </div>

            {kyc.status === 'pending' && (
              <div className="flex gap-2 pt-2 border-t border-surface-100 dark:border-surface-700">
                <button className="flex-1 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors">
                  Rechazar
                </button>
                <button className="flex-1 py-2 text-sm font-medium bg-kiwi-500 text-white rounded-lg hover:bg-kiwi-600 transition-colors">
                  Aprobar
                </button>
              </div>
            )}

            {kyc.status === 'rejected' && kyc.rejectionReason && (
              <div className="pt-2 border-t border-surface-100 dark:border-surface-700">
                <p className="text-sm text-red-500">❌ {kyc.rejectionReason}</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* KYC Detail Modal */}
      <AnimatePresence>
        {selectedKYC && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedKYC(null)}
          >
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold ${
                      selectedKYC.role === 'driver' 
                        ? 'bg-kiwi-100 dark:bg-kiwi-900/30 text-kiwi-600 dark:text-kiwi-400'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    }`}>
                      {selectedKYC.role === 'driver' ? '🛵' : '🏪'}
                    </div>
                    <div>
                      <h3 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                        {selectedKYC.userName}
                      </h3>
                      <p className="text-surface-500 dark:text-surface-400">{selectedKYC.userEmail}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedKYC(null)}
                    className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Document Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">Tipo de documento</p>
                    <p className="font-semibold text-surface-800 dark:text-surface-100">{selectedKYC.documentType}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">Número</p>
                    <p className="font-semibold text-surface-800 dark:text-surface-100 font-mono">{selectedKYC.documentNumber}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">Rol</p>
                    <p className="font-semibold text-surface-800 dark:text-surface-100">
                      {selectedKYC.role === 'driver' ? 'Repartidor' : 'Comercio'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">Fecha de envío</p>
                    <p className="font-semibold text-surface-800 dark:text-surface-100">
                      {new Date(selectedKYC.submittedAt).toLocaleDateString('es-CR')}
                    </p>
                  </div>
                </div>

                {/* Document Images */}
                <div>
                  <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-4">
                    📄 Documentos Subidos
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(selectedKYC.documents).map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-surface-100 dark:bg-surface-700 p-4">
                        <div className="aspect-video bg-surface-200 dark:bg-surface-600 rounded-lg flex items-center justify-center mb-2">
                          <span className="text-4xl">📄</span>
                        </div>
                        <p className="text-sm text-surface-600 dark:text-surface-400 capitalize">
                          {key === 'front' ? 'Frente' :
                           key === 'back' ? 'Reverso' :
                           key === 'selfie' ? 'Selfie' :
                           key === 'license' ? 'Licencia' : key}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                {selectedKYC.status === 'pending' && (
                  <div className="flex gap-4 pt-4 border-t border-surface-200 dark:border-surface-700">
                    <button
                      className="flex-1 py-3 px-4 text-sm font-medium border-2 border-red-500 text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      onClick={() => handleReject(selectedKYC.id, 'Documentos no válidos')}
                      disabled={actionLoading}
                    >
                      ❌ Rechazar
                    </button>
                    <button
                      className="flex-1 py-3 px-4 text-sm font-medium bg-kiwi-500 text-white rounded-xl hover:bg-kiwi-600 transition-colors"
                      onClick={() => handleApprove(selectedKYC.id)}
                      disabled={actionLoading}
                    >
                      ✅ Aprobar
                    </button>
                  </div>
                )}

                {selectedKYC.status !== 'pending' && (
                  <div className="pt-4 border-t border-surface-200 dark:border-surface-700">
                    <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
                      <span>Revisado por {selectedKYC.reviewedBy}</span>
                      <span>•</span>
                      <span>{new Date(selectedKYC.reviewedAt).toLocaleString('es-CR')}</span>
                    </div>
                    {selectedKYC.rejectionReason && (
                      <p className="mt-2 text-sm text-red-500">❌ {selectedKYC.rejectionReason}</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
