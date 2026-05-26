'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import { 
  CreditCard, Plus, CheckCircle, AlertCircle, Calendar, 
  MapPin, Check, User, Loader2, X 
} from 'lucide-react';
import { Payment, Tenant } from '../../../../types';

export default function PaymentsPage() {
  const showToast = useToastStore((state) => state.showToast);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

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
      // Filter tenants that actually live in rooms
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Rent Payments</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Generate monthly invoices, track dues, and record cash/UPI clearings.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md shadow-primary/20 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          Generate Invoice
        </button>
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
        <>
          {/* Desktop View */}
          <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-950/50">
                    <th className="px-6 py-4">Tenant</th>
                    <th className="px-6 py-4">Billing Unit</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Due Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Record Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {payments.map((payment) => (
                    <tr key={payment._id} className="hover:bg-slate-50 dark:hover:bg-slate-955/30 transition-colors">
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
                          <div className="text-[11px] text-slate-550 dark:text-slate-400 whitespace-pre-line mt-1 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            {payment.notes}
                          </div>
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

          {/* Mobile View */}
          <div className="block md:hidden space-y-4">
            {payments.map((payment) => (
              <div
                key={payment._id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-base block">{payment.tenant?.fullName || 'N/A'}</span>
                    <span className="text-[11px] text-slate-450 block">{payment.tenant?.phone || ''}</span>
                  </div>
                  <div>
                    {payment.status === 'paid' ? (
                      <div className="flex flex-col items-end">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">
                          <Check className="w-3 h-3" />
                          Paid
                        </span>
                        <span className="text-[9px] text-slate-400 mt-1 uppercase font-semibold">
                          {payment.paymentMethod}
                        </span>
                      </div>
                    ) : payment.status === 'overdue' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/50">
                        <AlertCircle className="w-3 h-3" />
                        Overdue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/50">
                        Unpaid
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs space-y-1.5 py-2.5 border-t border-b border-slate-50 dark:border-slate-850">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Property:</span>
                    <span className="text-slate-800 dark:text-slate-300 font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {payment.property?.propertyName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Room:</span>
                    <span className="text-slate-800 dark:text-slate-300 font-medium">Room {payment.room?.roomNumber || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Due Date:</span>
                    <span className="text-slate-800 dark:text-slate-300 font-medium flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(payment.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount:</span>
                    <span className="font-bold text-slate-900 dark:text-white">₹{payment.amount.toLocaleString('en-IN')}</span>
                  </div>
                  {payment.notes && (
                    <div className="text-[11px] text-slate-550 dark:text-slate-400 whitespace-pre-line mt-1 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                      {payment.notes}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  {payment.status !== 'paid' ? (
                    <button
                      onClick={() => {
                        setPayTargetInvoiceId(payment._id);
                        setIsPayModalOpen(true);
                      }}
                      className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-sm shadow-primary/10 transition-all"
                    >
                      Clear Bill
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-semibold">Processed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 1. Create Invoice Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-4">Generate Rent Invoice</h3>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1 uppercase text-slate-500">Select Tenant</label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => {
                    setSelectedTenantId(e.target.value);
                    const tenant = tenants.find((t) => t._id === e.target.value);
                    if (tenant && tenant.assignedRoom) {
                      setAmount(tenant.assignedRoom.monthlyRent);
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-900"
                  required
                >
                  <option value="">-- Choose Tenant --</option>
                  {tenants.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.fullName} ({t.assignedProperty?.propertyName} - {t.assignedRoom?.roomNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 uppercase text-slate-500">Invoice Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm"
                  min={0}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 uppercase text-slate-500">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-900"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold shadow-md shadow-primary/20 disabled:opacity-50"
              >
                {submitting ? 'Generating...' : 'Create Rent Invoice'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Record Payment Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
            <button
              onClick={() => setIsPayModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-4">Record Payment Clearing</h3>

            <form onSubmit={handlePayInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase text-slate-500">Clearing Channel</label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-900"
                  required
                >
                  <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="cash">Cash Payment</option>
                  <option value="bank_transfer">Direct Bank NetBanking</option>
                  <option value="card">Credit / Debit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 uppercase text-slate-500">Transaction ID / Reference (Optional)</label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm"
                  placeholder="e.g. TXN9872349"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold shadow-md shadow-primary/20 disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Clear Invoice & Record Cash'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
