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
    <div className="space-y-6 animate-stagger">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-600 via-primary to-blue-500 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
        <div className="relative p-6 md:p-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Legal Documents</span>
              <h2 className="text-2xl font-black tracking-tight">Rent Leases</h2>
            </div>
          </div>
          <p className="text-sm text-white/80 max-w-xl">View and manage rental contracts, security deposits, and terms documents.</p>
        </div>
      </div>

      {agreements.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm card-hover">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Agreements Found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Verify that occupants have been registered and uploaded lease contracts from the Properties page.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm card-hover flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{agreements.length}</h3>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm card-hover flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">{agreements.filter(a => a.status === 'active').length}</h3>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm card-hover flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending</p>
                <h3 className="text-2xl font-black text-amber-600 mt-1">{agreements.filter(a => a.status === 'pending').length}</h3>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden card-hover">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Lease Agreements Directory
              </h3>
            </div>
            <div className="overflow-x-auto">
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
                    <tr key={agreement._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {agreement.tenant?.fullName?.substring(0,2).toUpperCase() || 'TE'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{agreement.tenant?.fullName || 'Tenant'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{agreement._id.substring(18)}</div>
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
                        <div className="text-xs space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                            <span className="text-slate-400">Rent:</span>
                            <span className="font-bold text-slate-900 dark:text-white">₹{agreement.monthlyRent.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                            <span className="text-slate-400">Deposit:</span>
                            <span className="font-bold text-slate-900 dark:text-white">₹{agreement.securityDeposit.toLocaleString()}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-350">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium">
                            {new Date(agreement.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 ml-5">
                          to {new Date(agreement.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          agreement.status === 'active'
                            ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/50'
                            : 'border-slate-300 text-slate-600 bg-slate-50 dark:bg-slate-950/20 dark:text-slate-400 dark:border-slate-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${agreement.status === 'active' ? 'bg-emerald-500 status-dot-active' : 'bg-slate-400'}`} />
                          {agreement.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewPdf(agreement._id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-primary/5 hover:border-primary/30 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all shadow-sm"
                            title="View PDF"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            PDF
                          </button>
                          <button
                            onClick={() => triggerDeleteAgreement(agreement._id)}
                            className="p-2 border border-slate-200 dark:border-slate-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:border-rose-300 dark:hover:border-rose-900/50 rounded-xl transition-all"
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
          </div>

          {/* Mobile Cards */}
          <div className="block md:hidden space-y-3">
            {agreements.map((agreement) => (
              <div key={agreement._id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3 card-hover">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      {agreement.tenant?.fullName?.substring(0,2).toUpperCase() || 'TE'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{agreement.tenant?.fullName || 'Tenant'}</p>
                      <p className="text-[10px] text-slate-400">{agreement.property?.propertyName} - Room {agreement.room?.roomNumber}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                    agreement.status === 'active'
                      ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
                      : 'border-slate-300 text-slate-600 bg-slate-50 dark:bg-slate-950/20'
                  }`}>
                    <span className={`w-1 h-1 rounded-full mr-1 ${agreement.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {agreement.status}
                  </span>
                </div>
                <div className="flex justify-between text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div>
                    <span className="text-slate-500">Rent:</span>
                    <span className="font-bold text-slate-900 dark:text-white ml-1">₹{agreement.monthlyRent.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Deposit:</span>
                    <span className="font-bold text-slate-900 dark:text-white ml-1">₹{agreement.securityDeposit.toLocaleString()}</span>
                  </div>
                  <div>
                    <Calendar className="w-3 h-3 inline text-slate-400 mr-0.5" />
                    <span className="text-slate-500">{new Date(agreement.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleViewPdf(agreement._id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View PDF
                  </button>
                  <button
                    onClick={() => triggerDeleteAgreement(agreement._id)}
                    className="p-2 border border-slate-200 dark:border-slate-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )

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
