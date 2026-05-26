'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import { 
  CreditCard, Plus, CheckCircle, AlertCircle, Calendar, 
  MapPin, Check, User, Loader2, X, Search 
} from 'lucide-react';
import { Payment, Tenant } from '../../../../types';

export default function AdminPaymentsPage() {
  const showToast = useToastStore((state) => state.showToast);
  const [payments, setPayments] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Invoice creation form states
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [amount, setAmount] = useState(8000);
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pay invoice form states
  const [payTargetInvoiceId, setPayTargetInvoiceId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'bank_transfer'>('upi');
  const [transactionId, setTransactionId] = useState('');

  const fetchPaymentsAndTenants = async () => {
    try {
      const [paymentsRes, tenantsRes] = await Promise.all([
        api.get('/payments'),
        api.get('/tenants')
      ]);
      setPayments(paymentsRes.data);
      // Filter tenants that actually live in rooms globally
      setTenants(tenantsRes.data.filter((t: any) => t.assignedProperty && t.assignedRoom));
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to fetch payments data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentsAndTenants();
  }, []);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId || !dueDate) {
      showToast('Tenant and due date are required', 'error');
      return;
    }

    const tenantObj = tenants.find((t) => t._id === selectedTenantId);
    if (!tenantObj || !tenantObj.assignedProperty || !tenantObj.assignedRoom) {
      showToast('Selected occupant has no allocated property/room', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/payments', {
        tenant: selectedTenantId,
        property: tenantObj.assignedProperty._id,
        room: tenantObj.assignedRoom._id,
        amount,
        dueDate
      });

      showToast('Monthly rent invoice logged successfully!', 'success');
      setIsAddModalOpen(false);
      resetInvoiceForm();
      fetchPaymentsAndTenants();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to generate invoice', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTargetInvoiceId) return;

    setSubmitting(true);
    try {
      await api.put(`/payments/${payTargetInvoiceId}/pay`, {
        paymentMethod,
        transactionId
      });

      showToast('Payment transaction recorded and cleared!', 'success');
      setIsPayModalOpen(false);
      setPayTargetInvoiceId('');
      setTransactionId('');
      fetchPaymentsAndTenants();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to clear invoice', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetInvoiceForm = () => {
    setSelectedTenantId('');
    setAmount(8000);
    setDueDate('');
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredPayments = payments.filter((payment) => {
    const tenantName = payment.tenant?.fullName || '';
    const propertyName = payment.property?.propertyName || '';
    const ownerName = payment.property?.owner?.fullName || '';
    const query = searchQuery.toLowerCase();
    return tenantName.toLowerCase().includes(query) || 
           propertyName.toLowerCase().includes(query) || 
           ownerName.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Payments Registry</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track and review all generated monthly invoices, dues, and clearings globally.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search payments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md shadow-primary/20 transition-all hover:scale-105 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Generate Invoice
          </button>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <CreditCard className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Invoices Found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Create a monthly invoice to begin tracking rent collection logs.</p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-6 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold"
          >
            Create Invoice
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-950/50">
                  <th className="px-6 py-4">Tenant</th>
                  <th className="px-6 py-4">Billing Unit</th>
                  <th className="px-6 py-4">Managing Owner</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Record Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredPayments.map((payment) => (
                  <tr key={payment._id} className="hover:bg-slate-50 dark:hover:bg-slate-95/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white">{payment.tenant?.fullName || 'N/A'}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{payment.tenant?.phone || ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-xs flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {payment.property?.propertyName}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">Room: {payment.room?.roomNumber || 'N/A'}</div>
                      {payment.notes && (
                        <div className="text-[11px] text-slate-550 dark:text-slate-400 whitespace-pre-line mt-1 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-805">
                          {payment.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {payment.property?.owner ? (
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-205">{payment.property.owner.fullName}</div>
                          <div className="text-xs text-slate-400">{payment.property.owner.email}</div>
                        </div>
                      ) : (
                        <span className="text-xs italic text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      ₹{payment.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-xs">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {new Date(payment.dueDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {payment.status === 'paid' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
                            <Check className="w-3.5 h-3.5" />
                            Paid
                          </span>
                          <div className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">
                            {payment.paymentMethod} - {payment.transactionId?.substring(0, 12)}
                          </div>
                        </div>
                      ) : payment.status === 'overdue' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/30">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Overdue
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {payment.status !== 'paid' ? (
                        <button
                          onClick={() => {
                            setPayTargetInvoiceId(payment._id);
                            setIsPayModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all hover:scale-105"
                        >
                          Clear Bill
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-semibold">Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 1. Create Invoice Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-4">Generate Rent Invoice</h3>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Select Occupant (Active Globally)</label>
                {tenants.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 font-semibold">
                    No active tenants with assigned spaces found.
                  </div>
                ) : (
                  <select
                    value={selectedTenantId}
                    onChange={(e) => {
                      setSelectedTenantId(e.target.value);
                      const t = tenants.find((tenant) => tenant._id === e.target.value);
                      if (t && t.assignedRoom) {
                        setAmount(t.rentAmount || t.assignedRoom.monthlyRent);
                      }
                    }}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  >
                    <option value="">-- Choose Tenant --</option>
                    {tenants.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.fullName} ({t.assignedProperty?.propertyName || 'PG'} - Room {t.assignedRoom?.roomNumber || 'N/A'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Amount (INR)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                  min={0}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedTenantId}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50 mt-4 hover:scale-[1.02] transition-transform"
              >
                {submitting ? 'Generating bill...' : 'Create Invoice'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Pay Invoice Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
            <button
              onClick={() => {
                setIsPayModalOpen(false);
                setPayTargetInvoiceId('');
                setTransactionId('');
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-4">Record Payment Receipt</h3>

            <form onSubmit={handlePayInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  <option value="upi">UPI (GPay/PhonePe)</option>
                  <option value="cash">Cash Payment</option>
                  <option value="card">Credit/Debit Card</option>
                  <option value="bank_transfer">Net Banking / Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Transaction ID / Reference (Optional)</label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. TXN987654321"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 mt-4 hover:scale-[1.02] transition-transform"
              >
                {submitting ? 'Recording receipt...' : 'Record Payment Clearing'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
