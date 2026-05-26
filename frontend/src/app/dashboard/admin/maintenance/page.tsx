'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import { 
  Wrench, Plus, CheckCircle, Clock, AlertTriangle, 
  MapPin, User, Loader2, X, Search 
} from 'lucide-react';
import { MaintenanceRequest, Tenant } from '../../../../types';

export default function AdminMaintenancePage() {
  const showToast = useToastStore((state) => state.showToast);
  const [requests, setRequests] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [submitting, setSubmitting] = useState(false);

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

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredRequests = requests.filter((req) => {
    const tenantName = req.tenant?.fullName || '';
    const propertyName = req.property?.propertyName || '';
    const ownerName = req.property?.owner?.fullName || '';
    const title = req.title || '';
    const query = searchQuery.toLowerCase();
    return tenantName.toLowerCase().includes(query) || 
           propertyName.toLowerCase().includes(query) || 
           ownerName.toLowerCase().includes(query) || 
           title.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Maintenance Tickets</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Global tracking of appliance repairs, room utilities, and ticket resolving states.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tickets..."
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
            Raise Ticket
          </button>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Wrench className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Tickets Logged</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Create a utility repair request to start tracking issues.</p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-6 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold"
          >
            Log Ticket
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRequests.map((req) => (
            <div 
              key={req._id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                    req.priority === 'high'
                      ? 'border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-955/20'
                      : req.priority === 'medium'
                      ? 'border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-955/20'
                      : 'border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-955/20'
                  }`}>
                    {req.priority} Priority
                  </span>

                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                    req.status === 'resolved'
                      ? 'border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-955/20'
                      : req.status === 'in_progress'
                      ? 'border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-955/20'
                      : 'border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-955/20'
                  }`}>
                    {req.status.replace('_', ' ')}
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">{req.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                    {req.description}
                  </p>
                </div>

                <div className="space-y-1.5 text-[11px] pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-605 dark:text-slate-400 font-medium">
                    <User className="w-3.5 h-3.5" />
                    <span className="font-semibold">{req.tenant?.fullName || 'Occupant'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-605 dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{req.property?.propertyName} - Room {req.room?.roomNumber}</span>
                  </div>
                  {req.property?.owner && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1">
                      <span>Owner: {req.property.owner.fullName} ({req.property.owner.email})</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                {req.status === 'pending' && (
                  <button
                    onClick={() => handleUpdateStatus(req._id, 'in_progress')}
                    className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Start Work
                  </button>
                )}
                {req.status === 'in_progress' && (
                  <button
                    onClick={() => handleUpdateStatus(req._id, 'resolved')}
                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Mark Resolved
                  </button>
                )}
                {req.status === 'resolved' && (
                  <div className="flex items-center justify-center gap-1 w-full text-xs text-slate-400 font-bold py-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Resolved and Closed
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Raise Ticket Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-4">Raise Maintenance Ticket</h3>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1 uppercase text-slate-500">Select Tenant / Unit</label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
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
                <label className="block text-xs font-bold mb-1 uppercase text-slate-505">Issue Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-805 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="e.g. Geyser is leaking"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 uppercase text-slate-505">Issue Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-805 bg-transparent text-sm h-24 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Describe what repair work is required in detail..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 uppercase text-slate-505 font-bold">Priority Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-2 rounded-xl text-xs font-bold border capitalize transition-all ${
                        priority === p
                          ? p === 'high'
                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-955/20 text-rose-500'
                            : p === 'medium'
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-955/20 text-amber-500'
                            : 'border-blue-500 bg-blue-50 dark:bg-blue-955/20 text-blue-500'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500'
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
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold shadow-md shadow-primary/20 disabled:opacity-50 mt-4"
              >
                {submitting ? 'Raising Ticket...' : 'Draft Maintenance Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
