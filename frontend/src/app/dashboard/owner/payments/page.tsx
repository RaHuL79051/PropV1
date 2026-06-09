'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import {
  CreditCard, Plus, CheckCircle, AlertCircle, Calendar,
  MapPin, Check, User, Loader2, X, Wallet, Trash2, Filter,
  AlertTriangle, ArrowDownRight, ArrowUpRight, TrendingDown,
  FileText, ChevronDown, ListFilter
} from 'lucide-react';
import { Payment, Tenant } from '../../../../types';

interface Expense {
  _id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
}

const CATEGORIES = [
  'Food',
  'Travel',
  'Utilities/Bill',
  'Maintenance',
  'Salary',
  'Taxes',
  'Insurance',
  'Marketing',
  'Office',
  'Miscellaneous',
  'Other'
];

function PaymentsContent() {
  const showToast = useToastStore((state) => state.showToast);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'payments' | 'expenses'>('payments');

  useEffect(() => {
    if (tabParam === 'expenses') {
      setActiveTab('expenses');
    } else if (tabParam === 'payments') {
      setActiveTab('payments');
    }
  }, [tabParam]);

  // Payments / Tenants state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [expandedTenants, setExpandedTenants] = useState<Record<string, boolean>>({});
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [selectedInvoiceTenant, setSelectedInvoiceTenant] = useState<{ tenant: any; payments: Payment[] } | null>(null);

  // Invoice creation form states
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [amount, setAmount] = useState(8000);
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pay invoice form states
  const [payTargetInvoiceId, setPayTargetInvoiceId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'bank_transfer'>('upi');
  const [transactionId, setTransactionId] = useState('');

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [isExpensesLoading, setIsExpensesLoading] = useState(false);
  const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false);

  // Expense Filters state
  const [categoryFilter, setCategoryFilter] = useState('');
  const [rangeFilter, setRangeFilter] = useState<'day' | 'weekly' | 'monthly' | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Expense Form state
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseCategory, setExpenseCategory] = useState(CATEGORIES[0]);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);

  // Delete Expense confirmation states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPaymentsAndTenants = async () => {
    setIsLoading(true);
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

  const fetchExpenses = async () => {
    setIsExpensesLoading(true);
    try {
      let url = '/expenses';
      const params: any = {};

      if (categoryFilter) {
        params.category = categoryFilter;
      }

      if (rangeFilter !== 'all') {
        params.range = rangeFilter;
      } else if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const res = await api.get(url, { params });
      setExpenses(res.data.expenses);
      setTotalExpenses(res.data.totalExpenses);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to load expenses', 'error');
    } finally {
      setIsExpensesLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentsAndTenants();
  }, []);

  useEffect(() => {
    if (activeTab === 'expenses') {
      fetchExpenses();
    }
  }, [activeTab, categoryFilter, rangeFilter, startDate, endDate]);

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

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDate || !expenseCategory || !expenseAmount) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setIsExpenseSubmitting(true);
    try {
      await api.post('/expenses', {
        date: expenseDate,
        category: expenseCategory,
        amount: Number(expenseAmount),
        description: expenseDescription
      });
      showToast('Expense added successfully!', 'success');
      setIsAddExpenseModalOpen(false);
      // Reset form
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setExpenseCategory(CATEGORIES[0]);
      setExpenseAmount('');
      setExpenseDescription('');
      fetchExpenses();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to add expense', 'error');
    } finally {
      setIsExpenseSubmitting(false);
    }
  };

  const triggerDeleteExpense = (id: string) => {
    setDeleteExpenseId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteExpense = async () => {
    if (!deleteExpenseId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/expenses/${deleteExpenseId}`);
      showToast('Expense deleted successfully', 'info');
      setIsDeleteModalOpen(false);
      setDeleteExpenseId('');
      fetchExpenses();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete expense', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetExpenseFilters = () => {
    setCategoryFilter('');
    setRangeFilter('all');
    setStartDate('');
    setEndDate('');
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
    <div className="space-y-6 animate-stagger">
      {/* Header Panel */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
        <div className="relative p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
              {activeTab === 'payments' ? 'Revenue Management' : 'Operations Ledger'}
            </span>
            <h2 className="text-2xl font-black tracking-tight mt-1">
              {activeTab === 'payments' ? 'Rent Invoices' : 'Expense Registry'}
            </h2>
            <p className="text-sm text-white/80 mt-1">
              {activeTab === 'payments'
                ? 'Generate monthly invoices, track dues, and record cash/UPI clearings.'
                : 'Keep track of operations, maintenance outlays, and bills.'}
            </p>
          </div>
        <button
          onClick={() => activeTab === 'payments' ? setIsAddModalOpen(true) : setIsAddExpenseModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-bold shadow-md backdrop-blur-sm transition-all hover:scale-105 shrink-0 w-full sm:w-auto justify-center border border-white/20"
        >
          <Plus className="w-4 h-4" />
          {activeTab === 'payments' ? 'Generate Invoice' : 'Add Expense'}
        </button>
      </div>
    </div>

      {/* Tab Selector */}
      <div className="flex p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'payments'
              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm border border-slate-200 dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Rent Invoices
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'expenses'
              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm border border-slate-200 dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Portfolio Expenses
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'payments' ? (
        payments.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm card-hover">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <CreditCard className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Invoices Found</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Create a monthly invoice to begin tracking rent collection logs.</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-6 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-primary/20 transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4 inline mr-1.5" />
              Create Invoice
            </button>
          </div>
        ) : selectedInvoiceTenant ? (
          /* Invoice Detail Sub-View for Selected Tenant */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedInvoiceTenant(null)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Invoice Log</span>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{selectedInvoiceTenant.tenant.fullName || 'Unknown'}</h3>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-950/30">
                    <th className="px-6 py-3">Billing Period / Due Date</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-center">Record Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {selectedInvoiceTenant.payments.map((payment) => (
                    <tr key={payment._id} className="hover:bg-slate-50 dark:hover:bg-slate-955/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-800 dark:text-slate-200">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>{new Date(payment.dueDate).toLocaleDateString()}</span>
                        </div>
                        {payment.notes && (
                          <div className="text-[10px] text-slate-400 mt-1 max-w-md italic">Note: {payment.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">₹{payment.amount.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4">
                        {payment.status === 'paid' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
                              <Check className="w-3 h-3" /> Paid
                            </span>
                            <div className="text-[9px] text-slate-400 mt-0.5 uppercase font-semibold">{payment.paymentMethod} - {payment.transactionId?.substring(0, 12)}</div>
                          </div>
                        ) : payment.status === 'overdue' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/30">
                            <AlertCircle className="w-3.5 h-3.5" /> Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">Unpaid</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {payment.status !== 'paid' ? (
                          <button onClick={() => { setPayTargetInvoiceId(payment._id); setIsPayModalOpen(true); }}
                            className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all hover:scale-105">Clear Bill</button>
                        ) : (
                          <span className="text-xs text-slate-400 font-semibold">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="block md:hidden space-y-3">
              {selectedInvoiceTenant.payments.map((payment) => (
                <div key={payment._id} className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-sm">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-slate-400">Due: {new Date(payment.dueDate).toLocaleDateString()}</span>
                    {payment.status === 'paid' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200/50"><Check className="w-3 h-3" /> Paid</span>
                    ) : payment.status === 'overdue' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-600 border border-rose-200/50"><AlertCircle className="w-3 h-3" /> Overdue</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 border border-amber-200/50">Unpaid</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Amount Due:</span>
                    <span className="font-bold text-slate-900 dark:text-white">₹{payment.amount.toLocaleString('en-IN')}</span>
                  </div>
                  {payment.status === 'paid' && (
                    <div className="text-[10px] text-slate-400 text-right uppercase font-semibold">Method: {payment.paymentMethod} • Txn: {payment.transactionId?.substring(0, 10)}</div>
                  )}
                  {payment.notes && (
                    <div className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">Note: {payment.notes}</div>
                  )}
                  {payment.status !== 'paid' && (
                    <div className="flex justify-end pt-1">
                      <button onClick={() => { setPayTargetInvoiceId(payment._id); setIsPayModalOpen(true); }}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-sm shadow-primary/10 transition-all w-full sm:w-auto text-center">Clear Bill</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative max-w-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-2.5 text-slate-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input
                type="text"
                placeholder="Search by tenant, phone, property or room..."
                value={paymentSearchQuery}
                onChange={(e) => setPaymentSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Tenant Cards List */}
            {(() => {
              const grouped: Record<string, { tenant: any; payments: Payment[] }> = {};
              payments.forEach((payment) => {
                const tenantId = payment.tenant?._id || 'unknown';
                if (!grouped[tenantId]) {
                  grouped[tenantId] = {
                    tenant: payment.tenant || { fullName: 'Unknown Tenant', phone: '' },
                    payments: []
                  };
                }
                grouped[tenantId].payments.push(payment);
              });

              const groupedArray = Object.values(grouped).sort((a, b) =>
                (a.tenant?.fullName || '').localeCompare(b.tenant?.fullName || '')
              );

              const filteredGroups = groupedArray.filter(({ tenant, payments: tenantPayments }) => {
                const q = paymentSearchQuery.toLowerCase();
                if (!q) return true;
                const firstPayment = tenantPayments[0];
                return (
                  (tenant.fullName || '').toLowerCase().includes(q) ||
                  (tenant.phone || '').includes(q) ||
                  (firstPayment?.property?.propertyName || '').toLowerCase().includes(q) ||
                  (firstPayment?.room?.roomNumber || '').toLowerCase().includes(q)
                );
              });

              if (filteredGroups.length === 0) {
                return (
                  <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <User className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500">No tenants match your search.</p>
                  </div>
                );
              }

              return filteredGroups.map(({ tenant, payments: tenantPayments }) => {
                const unpaidPayments = tenantPayments.filter((p) => p.status !== 'paid');
                const outstandingDues = unpaidPayments.reduce((sum, p) => sum + p.amount, 0);
                const firstPayment = tenantPayments[0];
                const propertyName = firstPayment?.property?.propertyName || 'N/A';
                const roomNumber = firstPayment?.room?.roomNumber || 'N/A';

                return (
                  <div
                    key={tenant._id || 'unknown'}
                    onClick={() => setSelectedInvoiceTenant({ tenant, payments: tenantPayments })}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                        {tenant.fullName ? tenant.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          {tenant.fullName || 'Unknown Tenant'}
                          {tenant.phone && <span className="text-xs text-slate-405 font-normal">({tenant.phone})</span>}
                        </h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {propertyName} • Room {roomNumber}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Invoices</span>
                        <span className="text-xs font-semibold mt-0.5 block text-slate-700 dark:text-slate-300">
                          {tenantPayments.length} {tenantPayments.length === 1 ? 'Invoice' : 'Invoices'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Outstanding</span>
                        {outstandingDues > 0 ? (
                          <span className="text-xs font-bold text-rose-500 block mt-0.5">₹{outstandingDues.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 mt-0.5">
                            <Check className="w-3.5 h-3.5" /> No dues
                          </span>
                        )}
                      </div>
                      <div className="p-1 text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )
      ) : (
        /* Operating Expenses Tab Content */
        <div className="space-y-6">
          {/* Aggregate Stats Card */}
          <div className="p-6 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-450 flex items-center justify-center shadow-inner">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Active Outlays</span>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-0.5">
                  ₹{totalExpenses.toLocaleString('en-IN')}
                </h3>
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-550 dark:text-slate-400 max-w-sm md:text-right">
              Showing aggregated outlays reflecting the currently active filter conditions. Use the control panel below to slice data.
            </div>
          </div>

          {/* Filter Control Panel */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
              <ListFilter className="w-4 h-4 text-primary" />
              <span>Control Panel & Filters</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Quick Date Range */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1.5">Timeline Quick Filter</label>
                <div className="grid grid-cols-4 gap-1.5 bg-slate-50 dark:bg-slate-955 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  {(['all', 'day', 'weekly', 'monthly'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setRangeFilter(r);
                        setStartDate('');
                        setEndDate('');
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all capitalize ${rangeFilter === r
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-slate-550 dark:text-slate-400 hover:bg-slate-105 dark:hover:bg-slate-900/60'
                        }`}
                    >
                      {r === 'all' ? 'All' : r.replace('ly', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455 mb-1.5">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary dark:bg-slate-900/50"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455 mb-1.5">Custom Start Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setRangeFilter('all');
                    }}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary dark:bg-slate-900/50"
                  />
                  <Calendar className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>

              {/* End Date */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455 mb-1.5">Custom End Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setRangeFilter('all');
                    }}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary dark:bg-slate-900/50"
                  />
                  <Calendar className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            </div>

            {(categoryFilter || rangeFilter !== 'all' || startDate || endDate) && (
              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-850">
                <button
                  onClick={handleResetExpenseFilters}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-650 transition-colors uppercase tracking-wider flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Reset Active Filters
                </button>
              </div>
            )}
          </div>

          {/* Expenses History Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
            {isExpensesLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <span className="text-xs text-slate-450 font-semibold">Compiling logs...</span>
              </div>
            ) : expenses.length === 0 ? (
              <div className="py-16 text-center text-slate-400 italic text-xs max-w-md mx-auto space-y-2">
                <div>No expense entries match the current filter configuration.</div>
                <button
                  onClick={() => setIsAddExpenseModalOpen(true)}
                  className="text-xs text-primary font-bold hover:underline not-italic"
                >
                  Add a new expense entry now &rarr;
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Desktop Table View */}
                <table className="w-full text-left border-collapse hidden md:table">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/40 text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-855 text-xs">
                    {expenses.map((expense) => (
                      <tr key={expense._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all text-slate-800 dark:text-slate-250">
                        <td className="px-6 py-3.5 font-semibold">
                          {new Date(expense.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 max-w-xs truncate text-slate-550 dark:text-slate-400" title={expense.description}>
                          {expense.description || <span className="italic text-slate-350">No description provided</span>}
                        </td>
                        <td className="px-6 py-3.5 text-right font-bold text-rose-650 dark:text-rose-400">
                          ₹{expense.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <button
                            onClick={() => triggerDeleteExpense(expense._id)}
                            className="p-1.5 border border-slate-200 dark:border-slate-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                            title="Delete log entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile Stack List View */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-850">
                  {expenses.map((expense) => (
                    <div key={expense._id} className="p-4 space-y-2.5 hover:bg-slate-50/30 dark:hover:bg-slate-955/10">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            {new Date(expense.date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          <div className="mt-1">
                            <span className="inline-flex text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                              {expense.category}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-rose-600 dark:text-rose-400 block">
                            ₹{expense.amount.toLocaleString('en-IN')}
                          </span>
                          <button
                            onClick={() => triggerDeleteExpense(expense._id)}
                            className="mt-1.5 text-[10px] text-rose-500 font-bold hover:underline inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      </div>
                      {expense.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-450 italic leading-relaxed bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                          "{expense.description}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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

      {/* 3. Add Expense Modal */}
      {isAddExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsAddExpenseModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-extrabold mb-1 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Add Outlay Log
            </h3>
            <p className="text-xs text-slate-555 dark:text-slate-450 mb-5">Record a cash expense or operations bill in your portfolio ledger.</p>

            <form onSubmit={handleAddExpense} className="space-y-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase text-slate-500">Expense Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                    required
                  />
                  <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-450" />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase text-slate-500">Category / Type</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                  required
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase text-slate-500">Amount (INR)</label>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                  placeholder="e.g. 2500"
                  min={0}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase text-slate-500">Description (Optional)</label>
                <textarea
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-20 focus:ring-1 focus:ring-primary outline-none text-slate-900 dark:text-white"
                  placeholder="e.g. Plumbing repair for Room-104 sink."
                />
              </div>

              <button
                type="submit"
                disabled={isExpenseSubmitting}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold shadow-md shadow-primary/20 disabled:opacity-50 mt-2 transition-all hover:scale-[1.01]"
              >
                {isExpenseSubmitting ? 'Logging Outlay...' : 'Save Expense'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Delete Expense Entry
              </h3>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteExpenseId('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Are you sure you want to delete this expense entry? This action is permanent and cannot be undone.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteExpenseId('');
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteExpense}
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

export default function PaymentsPage() {
  return (
    <Suspense fallback={
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <PaymentsContent />
    </Suspense>
  );
}
