'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import { 
  Users, Mail, Phone, Calendar, Loader2, Check, X, Clock, 
  UserPlus, Lock, ShieldCheck, Building2, Eye, EyeOff
} from 'lucide-react';
import { User } from '../../../../types';

export default function OwnersPage() {
  const showToast = useToastStore((state) => state.showToast);
  const [owners, setOwners] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Add User Modal state
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'owner' as 'owner' | 'admin',
  });

  const fetchOwners = async () => {
    try {
      const res = await api.get('/auth/owners');
      setOwners(res.data);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to fetch owners list', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOwners();
  }, [showToast]);

  const handleUpdateStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    setActionLoadingId(id);
    try {
      await api.put(`/auth/owners/${id}/status`, { status: newStatus });
      showToast(`Owner has been successfully ${newStatus}!`, 'success');
      setOwners((prev) =>
        prev.map((owner) => {
          const ownerId = (owner.id && owner.id !== 'undefined') ? owner.id : (owner as any)._id;
          return ownerId === id
            ? { ...owner, status: newStatus, isActive: newStatus === 'approved' }
            : owner;
        })
      );
    } catch (err: any) {
      showToast(err.response?.data?.message || `Failed to update status to ${newStatus}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.fullName || !newUser.email || !newUser.phone || !newUser.password) {
      showToast('Please fill in all fields', 'error');
      return;
    }
    setAddUserLoading(true);
    try {
      await api.post('/auth/admin/create-user', newUser);
      showToast(
        `${newUser.role === 'admin' ? 'Admin' : 'Owner'} account for ${newUser.fullName} created successfully!`,
        'success'
      );
      setIsAddUserModalOpen(false);
      setNewUser({ fullName: '', email: '', phone: '', password: '', role: 'owner' });
      setShowPassword(false);
      fetchOwners(); // Refresh the list
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create user account', 'error');
    } finally {
      setAddUserLoading(false);
    }
  };

  const pendingCount = owners.filter((o) => o.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Owners Register
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review registered property managers, manage verification statuses, and create new accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              {pendingCount} pending review
            </div>
          )}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-400">
            <Users className="w-4 h-4 text-primary" />
            <span>Total: {owners.length}</span>
          </div>
          <button
            onClick={() => setIsAddUserModalOpen(true)}
            id="add-user-btn"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-primary/20 transition-all hover:scale-[1.03]"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Owners Table */}
      {owners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white/40 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md rounded-3xl text-center">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 italic">
            No property owners are registered yet.
          </p>
          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Add First User
          </button>
        </div>
      ) : (
        <div className="bg-white/50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-md rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto font-sans">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-950/20">
                  <th className="px-6 py-4">Manager Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Registered Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                {owners.map((owner) => {
                  const ownerId = (owner.id && owner.id !== 'undefined') ? owner.id : (owner as any)._id;
                  return (
                    <tr key={ownerId} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black uppercase tracking-wider">
                            {owner.fullName.substring(0, 2)}
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{owner.fullName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <span>{owner.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <span>{owner.phone || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {owner.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
                            <Check className="w-3 h-3" />
                            Approved
                          </span>
                        ) : owner.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40">
                            <X className="w-3 h-3" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40">
                            <Clock className="w-3 h-3" />
                            Pending Review
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>{new Date(owner.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {actionLoadingId === ownerId ? (
                          <div className="flex justify-end pr-4">
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                          </div>
                        ) : owner.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleUpdateStatus(ownerId, 'approved')}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold transition-all"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(ownerId, 'rejected')}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-lg text-xs font-semibold transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-650 italic">
                            Action completed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add User Modal ── */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => { setIsAddUserModalOpen(false); setShowPassword(false); setNewUser({ fullName: '', email: '', phone: '', password: '', role: 'owner' }); }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add New User</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Create an approved account directly from admin panel</p>
              </div>
            </div>

            {/* Role Selector */}
            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Account Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewUser((u) => ({ ...u, role: 'owner' }))}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-bold transition-all ${
                    newUser.role === 'owner'
                      ? 'border-primary bg-primary/8 text-primary shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Property Owner
                </button>
                <button
                  type="button"
                  onClick={() => setNewUser((u) => ({ ...u, role: 'admin' }))}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-bold transition-all ${
                    newUser.role === 'admin'
                      ? 'border-rose-500 bg-rose-500/8 text-rose-500 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  System Admin
                </button>
              </div>
              {newUser.role === 'admin' && (
                <p className="mt-2 text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin accounts get full platform access immediately.
                </p>
              )}
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser((u) => ({ ...u, fullName: e.target.value }))}
                  placeholder="e.g. Amit Sharma"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                    placeholder="user@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={newUser.phone}
                  onChange={(e) => setNewUser((u) => ({ ...u, phone: e.target.value }))}
                  placeholder="9876543210"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddUserModalOpen(false); setShowPassword(false); setNewUser({ fullName: '', email: '', phone: '', password: '', role: 'owner' }); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="create-user-submit"
                  disabled={addUserLoading}
                  className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 hover:scale-[1.02] ${
                    newUser.role === 'admin'
                      ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
                      : 'bg-primary hover:bg-primary-hover shadow-primary/20'
                  }`}
                >
                  {addUserLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                  ) : (
                    <><UserPlus className="w-4 h-4" /> Create Account</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
