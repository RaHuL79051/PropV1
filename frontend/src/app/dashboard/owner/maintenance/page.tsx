'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import {
  Wrench, Plus, CheckCircle, Clock, AlertTriangle,
  MapPin, User, Loader2, X, Search, Filter, Trash2,
  Play, CheckCircle2, RefreshCw
} from 'lucide-react';
import { MaintenanceRequest, Tenant } from '../../../../types';
import { getApiErrorMessage } from '../../../../lib/apiError';

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
      showToast(getApiErrorMessage(err, 'Failed to delete maintenance ticket'), 'error');
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
      showToast(getApiErrorMessage(err, 'Failed to fetch tickets'), 'error');
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
      showToast(getApiErrorMessage(err, 'Failed to raise maintenance ticket'), 'error');
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
      showToast(getApiErrorMessage(err, 'Failed to update ticket status'), 'error');
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

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const inProgressCount = requests.filter(r => r.status === 'in_progress').length;
  const resolvedCount = requests.filter(r => r.status === 'resolved').length;

  if (isLoading) {
    return (
      <div className="h-[65vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-semibold text-slate-500">Loading maintenance records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-stagger">
      {/* 1. HERO HEADER BANNER */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_45%)]" />
        <div className="absolute -bottom-8 -right-8 w-36 h-36 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        
        <div className="relative p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
          <div className="space-y-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white/90 text-[11px] font-bold uppercase tracking-widest border border-white/15 mb-1">
              <Wrench className="w-3 h-3 text-cyan-300" /> Facility Management
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Maintenance Portal</h2>
            <p className="text-xs sm:text-sm text-white/80 max-w-xl">
              Track appliance repairs, utility issues, and resolve tenant service requests seamlessly.
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-primary hover:bg-slate-100 text-xs sm:text-sm font-extrabold shadow-lg shadow-black/10 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Raise Maintenance Ticket
          </button>
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tickets */}
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border transition-all text-left group shadow-sm ${
            statusFilter === 'all'
              ? 'border-primary ring-2 ring-primary/20 bg-primary/5 dark:bg-primary/10'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Total Logged</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{requests.length}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 inline-block">All repair entries</span>
        </button>

        {/* Pending Tickets */}
        <button
          onClick={() => setStatusFilter('pending')}
          className={`p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border transition-all text-left group shadow-sm ${
            statusFilter === 'pending'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Dues</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">{pendingCount}</p>
          <span className="text-[11px] text-amber-600/80 dark:text-amber-400/80 font-medium mt-1 inline-block">Needs attention</span>
        </button>

        {/* In Progress Tickets */}
        <button
          onClick={() => setStatusFilter('in_progress')}
          className={`p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border transition-all text-left group shadow-sm ${
            statusFilter === 'in_progress'
              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">In Progress</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">{inProgressCount}</p>
          <span className="text-[11px] text-blue-600/80 dark:text-blue-400/80 font-medium mt-1 inline-block">Actively working</span>
        </button>

        {/* Resolved Tickets */}
        <button
          onClick={() => setStatusFilter('resolved')}
          className={`p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border transition-all text-left group shadow-sm ${
            statusFilter === 'resolved'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Resolved</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">{resolvedCount}</p>
          <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-1 inline-block">Closed tickets</span>
        </button>
      </div>

      {/* 3. FILTER BAR AND CONTROLS */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Status Pill Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl">
          {(['all', 'pending', 'in_progress', 'resolved'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold capitalize transition-all ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search & Priority Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, occupant, room..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Priority Select Filter */}
          <div className="relative min-w-[130px]">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-bold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Priorities</option>
              <option value="high">🔥 High</option>
              <option value="medium">⚡ Medium</option>
              <option value="low">🌱 Low</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 4. MAIN TICKETS GRID */}
      {requests.length === 0 ? (
        /* Empty State (No tickets in DB) */
        <div className="py-16 px-6 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-lg mx-auto my-6 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner border border-primary/20">
            <Wrench className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">No Maintenance Tickets Logged</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Keep your properties well-maintained. Log service requests to track repair progress.
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-primary/20 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Log First Ticket
          </button>
        </div>
      ) : filteredRequests.length === 0 ? (
        /* Empty Filter State */
        <div className="py-12 px-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-md mx-auto my-6 space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h4 className="text-base font-bold text-slate-900 dark:text-white">No Tickets Found</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">No requests match your selected status or filter parameters.</p>
          <button
            onClick={() => {
              setStatusFilter('all');
              setPriorityFilter('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRequests.map((req) => {
            const priorityBadge = {
              high: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60',
              medium: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60',
              low: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60',
            }[req.priority] || 'bg-slate-50 text-slate-600 border-slate-200';

            const statusBadge = {
              pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40',
              in_progress: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40',
              resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40',
            }[req.status] || 'bg-slate-50 text-slate-700 border-slate-200';

            return (
              <div
                key={req._id}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="space-y-3.5">
                  {/* Card Header Pills */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md border ${priorityBadge}`}>
                        {req.priority} Priority
                      </span>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md border ${statusBadge}`}>
                        {req.status.replace('_', ' ')}
                      </span>
                    </div>

                    <button
                      onClick={() => triggerDeleteTicket(req._id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                      title="Delete Ticket"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white line-clamp-1">
                      {req.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed line-clamp-3">
                      {req.description}
                    </p>
                  </div>

                  {/* Location & Occupant Info */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <User className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{req.tenant?.fullName || 'Allocated Tenant'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {req.property?.propertyName} • Room {req.room?.roomNumber}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Workflow Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  {req.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(req._id, 'in_progress')}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/10 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Start Repair Work
                    </button>
                  )}
                  {req.status === 'in_progress' && (
                    <button
                      onClick={() => handleUpdateStatus(req._id, 'resolved')}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Work Resolved
                    </button>
                  )}
                  {req.status === 'resolved' && (
                    <div className="w-full py-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-900/40">
                      <CheckCircle className="w-4 h-4" />
                      Resolved & Closed
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. CREATE TICKET MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Raise Maintenance Ticket</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Log a new utility or repair service issue.</p>
              </div>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                  Select Occupant / Room
                </label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                <label className="block text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                  Issue Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. Geyser is leaking / Water pipe blockage"
                  required
                  minLength={2}
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                  Detailed Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium h-24 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none leading-relaxed"
                  placeholder="Describe the repair issue in detail..."
                  required
                  minLength={5}
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                  Priority Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-2.5 rounded-xl text-xs font-extrabold capitalize border transition-all ${
                        priority === p
                          ? p === 'high'
                            ? 'border-rose-500 bg-rose-500 text-white shadow-md shadow-rose-500/20'
                            : p === 'medium'
                            ? 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/20'
                            : 'border-blue-500 bg-blue-500 text-white shadow-md shadow-blue-500/20'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-850'
                      }`}
                    >
                      {p} Priority
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold shadow-lg shadow-primary/20 disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] mt-4 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting Maintenance Request...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    Create Maintenance Ticket
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Delete Ticket?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Are you sure you want to delete this maintenance ticket? This record cannot be recovered.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteTicketId('');
                  }}
                  className="flex-1 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTicket}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Ticket'
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
