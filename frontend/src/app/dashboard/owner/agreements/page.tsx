'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import { 
  FileText, Plus, CheckCircle, ExternalLink, Calendar, 
  MapPin, User, Loader2, X, Trash2, AlertTriangle 
} from 'lucide-react';
import { Agreement, Tenant } from '../../../../types';

export default function AgreementsPage() {
  const showToast = useToastStore((state) => state.showToast);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Agreement confirmation states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteAgreementId, setDeleteAgreementId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAgreementsAndTenants = async () => {
    try {
      const [agreementsRes, tenantsRes] = await Promise.all([
        api.get('/agreements'),
        api.get('/tenants')
      ]);
      setAgreements(agreementsRes.data);
      setTenants(tenantsRes.data);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to fetch agreement details', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgreementsAndTenants();
  }, []);



  const triggerDeleteAgreement = (id: string) => {
    setDeleteAgreementId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteAgreement = async () => {
    if (!deleteAgreementId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/agreements/${deleteAgreementId}`);
      showToast('Agreement deleted successfully', 'success');
      setIsDeleteModalOpen(false);
      setDeleteAgreementId('');
      fetchAgreementsAndTenants();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete agreement', 'error');
    } finally {
      setIsDeleting(false);
    }
  };



  const handleViewPdf = (agreementId: string) => {
    try {
      api.get(`/agreements/${agreementId}/pdf`, { responseType: 'blob' })
        .then((response) => {
          const pdfUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
          window.open(pdfUrl, '_blank', 'noopener,noreferrer');
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
        })
        .catch(() => {
          showToast('Failed to view PDF document', 'error');
        });
    } catch (err: any) {
      showToast('Failed to view PDF document', 'error');
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Rent Leases</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">View and manage rental contracts, security deposits, and terms documents.</p>
        </div>
      </div>

      {agreements.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <FileText className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Agreements Found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Verify that occupants have been registered and uploaded lease contracts from the Properties page.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Tenant Name</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Property/Room</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Rent & Deposit</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Dates</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {agreements.map((agreement) => (
                <tr key={agreement._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{agreement.tenant?.fullName || 'Tenant'}</div>
                        <div className="text-[10px] text-slate-400">ID: {agreement._id.substring(18)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-350 max-w-xs truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{agreement.property?.propertyName} - Room {agreement.room?.roomNumber}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs">
                      <div><span className="text-slate-400">Rent:</span> <span className="font-semibold">₹{agreement.monthlyRent.toLocaleString()}</span></div>
                      <div><span className="text-slate-400">Deposit:</span> <span className="font-semibold">₹{agreement.securityDeposit.toLocaleString()}</span></div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-650 dark:text-slate-350">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {new Date(agreement.startDate).toLocaleDateString()} - {new Date(agreement.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      agreement.status === 'active'
                        ? 'border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                        : 'border-slate-300 text-slate-500 bg-slate-50 dark:bg-slate-950/20'
                    }`}>
                      {agreement.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewPdf(agreement._id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all text-slate-700 dark:text-slate-300"
                        title="View PDF"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        PDF
                      </button>
                      <button
                        onClick={() => triggerDeleteAgreement(agreement._id)}
                        className="p-1.5 border border-slate-200 dark:border-slate-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                        title="Delete Agreement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Delete Agreement
              </h3>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteAgreementId('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Are you sure you want to delete this agreement? This will reset the tenant's status to pending.
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteAgreementId('');
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAgreement}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl shadow-md shadow-rose-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
