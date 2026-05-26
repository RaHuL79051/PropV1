'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import {
  Wrench, Plus, CheckCircle, Clock, AlertTriangle,
  MapPin, User, Loader2, X, Search, Filter, Trash2
} from 'lucide-react';
import { MaintenanceRequest, Tenant } from '../../../../types';

export default function MaintenancePage() {
  const showToast = useToastStore((state) => state.showToast);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filters & Search states
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [submitting, setSubmitting] = useState(false);

  // Delete Ticket confirmation states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTicketId, setDeleteTicketId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const triggerDeleteTicket = (id: string) => {
    setDeleteTicketId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteTicket = async () => {
    if (!deleteTicketId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/maintenance/${deleteTicketId}`);
      showToast('Maintenance ticket deleted successfully!', 'success');
      setIsDeleteModalOpen(false);
      setDeleteTicketId('');
      fetchRequestsAndTenants();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete maintenance ticket', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchRequestsAndTenants = async () => {
    try {
      const [reqsRes, tenantsRes] = await Promise.all([
        api.get('/maintenance'),
        api.get('/tenants')
      ]);
      setRequests(reqsRes.data);
      setTenants(tenantsRes.data.filter((t: any) => t.assignedProperty && t.assignedRoom));
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to fetch tickets', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequestsAndTenants();
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId || !title || !description) {
      showToast('Tenant, title, and description are required', 'error');
      return;
    }

    const tenantObj = tenants.find((t) => t._id === selectedTenantId);
    if (!tenantObj || !tenantObj.assignedProperty || !tenantObj.assignedRoom) {
      showToast('Selected occupant has no allocated property/room', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/maintenance', {
        tenant: selectedTenantId,
        property: tenantObj.assignedProperty._id,
        room: tenantObj.assignedRoom._id,
        title,
        description,
        priority
      });

      showToast('Maintenance ticket raised successfully!', 'success');
      setIsAddModalOpen(false);
      resetForm();
      fetchRequestsAndTenants();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to raise maintenance ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'pending' | 'in_progress' | 'resolved') => {
    try {
      await api.put(`/maintenance/${id}/status`, { status });
      showToast(`Ticket status updated to ${status.replace('_', ' ')}!`, 'success');
      fetchRequestsAndTenants();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update ticket status', 'error');
    }
  };

  const resetForm = () => {
    setSelectedTenantId('');
    setTitle('');
    setDescription('');
    setPriority('medium');
  };

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || req.priority === priorityFilter;
    const matchesSearch = searchQuery === '' || 
      req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.tenant?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.property?.propertyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.room?.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesPriority && matchesSearch;
  });

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Maintenance Tickets</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track appliance repairs, room utilities, and update resolving stages.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <Plus className="w-4 h-4" />
          Raise Ticket
        </button>
      </div>

      {/* Filters Bar */}
      {requests.length > 0 && (
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {(['all', 'pending', 'in_progress', 'resolved'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all capitalize ${
                  statusFilter === status
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-800'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-405 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tickets..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-slate-800 dark:text-slate-100"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Priority Selector */}
            <div className="relative">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="w-full sm:w-36 pl-3 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 text-xs focus:outline-none text-slate-650 dark:text-slate-400 font-semibold appearance-none cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Filter className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {requests.length === 0 ? (
        /* Database Empty State */
        <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-md mx-auto my-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm border border-primary/20">
            <Wrench className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Tickets Logged</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
            Create a utility repair request to start tracking issues.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Log Ticket
          </button>
        </div>
      ) : filteredRequests.length === 0 ? (
        /* Filter Empty State */
        <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md mx-auto my-8 animate-in fade-in duration-200">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-550 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-800 dark:text-slate-250">No Matching Tickets</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
            Try resetting your filters or adjusting your search query.
          </p>
          <button
            onClick={() => {
              setStatusFilter('all');
              setPriorityFilter('all');
              setSearchQuery('');
            }}
            className="mt-5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Tickets Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRequests.map((req) => {
            const priorityColors = {
              high: {
                border: 'border-l-rose-500',
                badge: 'border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400',
              },
              medium: {
                border: 'border-l-amber-500',
                badge: 'border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-400',
              },
              low: {
                border: 'border-l-blue-500',
                badge: 'border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-400',
              },
            };

            const statusColors = {
              resolved: 'border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-450',
              in_progress: 'border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-450',
              pending: 'border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-455',
            };

            const colors = priorityColors[req.priority] || priorityColors.medium;
            const statusClass = statusColors[req.status] || statusColors.pending;

            return (
              <div
                key={req._id}
                className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-80 border-l-4 ${colors.border} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between hover:scale-[1.01] duration-200`}
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${colors.badge}`}>
                      {req.priority} Priority
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${statusClass}`}>
                        {req.status.replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => triggerDeleteTicket(req._id)}
                        className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-all"
                        title="Delete Ticket"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white truncate" title={req.title}>
                      {req.title}
                    </h4>
                    <p className="text-xs text-slate-550 dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                      {req.description}
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                      <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <User className="w-3 h-3 text-slate-500" />
                      </div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {req.tenant?.fullName || 'Occupant'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-650 dark:text-slate-400">
                      <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-3 h-3 text-slate-500" />
                      </div>
                      <span className="truncate" title={`${req.property?.propertyName} - Room ${req.room?.roomNumber}`}>
                        {req.property?.propertyName} - Room {req.room?.roomNumber}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                  {req.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(req._id, 'in_progress')}
                      className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/10"
                    >
                      Start Work
                    </button>
                  )}
                  {req.status === 'in_progress' && (
                    <button
                      onClick={() => handleUpdateStatus(req._id, 'resolved')}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-500/10"
                    >
                      Mark Resolved
                    </button>
                  )}
                  {req.status === 'resolved' && (
                    <div className="flex items-center justify-center gap-1.5 w-full text-xs text-slate-400 dark:text-slate-500 font-bold py-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Resolved and Closed
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Raise Ticket Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-5 pr-10 text-slate-900 dark:text-white">Raise Maintenance Ticket</h3>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold mb-1.5 uppercase text-slate-400 tracking-wider">Select Tenant / Unit</label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-850 dark:text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">-- Choose Tenant --</option>
                  {tenants.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.fullName} ({t.assignedProperty?.propertyName} - Room {t.assignedRoom?.roomNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-1.5 uppercase text-slate-400 tracking-wider">Issue Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-850 dark:text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Geyser is leaking"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-1.5 uppercase text-slate-400 tracking-wider">Issue Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-850 dark:text-slate-200 text-sm h-24 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  placeholder="Describe what repair work is required in detail..."
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-1.5 uppercase text-slate-400 tracking-wider font-bold">Priority Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-2 rounded-xl text-xs font-bold border capitalize transition-all ${
                        priority === p
                          ? p === 'high'
                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-455'
                            : p === 'medium'
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-455'
                            : 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-455'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 bg-transparent'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] mt-4 flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Raising Ticket...
                  </>
                ) : (
                  'Draft Maintenance Ticket'
                )}
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
                Delete Maintenance Ticket
              </h3>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteTicketId('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Are you sure you want to delete this maintenance ticket? This action is permanent and cannot be undone.
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteTicketId('');
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTicket}
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
