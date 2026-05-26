'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import {
  Users, Plus, Trash2, ShieldCheck, ShieldAlert, Star,
  MapPin, Phone, Briefcase, Loader2, X, User, FileText, Upload, Eye, AlertTriangle,
  ArrowLeft, ArrowRight, Search, Mail, Send, Calendar, FolderOpen, Filter
} from 'lucide-react';
import { Tenant, Property, Room, User as OwnerUser } from '../../../../types';

export default function AdminTenantsPage() {
  const showToast = useToastStore((state) => state.showToast);
  const [tenants, setTenants] = useState<any[]>([]);
  const [owners, setOwners] = useState<OwnerUser[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Step-based registration wizard
  const [wizardStep, setWizardStep] = useState(1);
  const [aadhaarVerifying, setAadhaarVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [registrationMode, setRegistrationMode] = useState<'manual' | 'invite'>('manual');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');

  // Form states
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [fullName, setFullName] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [occupation, setOccupation] = useState('');
  const [address, setAddress] = useState('');
  const [joiningDate, setJoiningDate] = useState(getTodayDateString());

  // Ownership context state for admin creation
  const [selectedOwnerId, setSelectedOwnerId] = useState('');

  // Allocation states
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [payments, setPayments] = useState<any[]>([]);

  // Additional charges & manual billing states
  const [newChargeDesc, setNewChargeDesc] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');
  const [isBillingSending, setIsBillingSending] = useState(false);

  const getOutstandingBalance = (tenantId: string) => {
    const unpaid = payments.filter((p) => p.tenant?._id === tenantId && p.status === 'unpaid');
    return unpaid.reduce((sum, p) => sum + p.amount, 0);
  };

  const handleVerifyAadhaar = async () => {
    if (!aadhaarNumber || aadhaarNumber.length !== 12 || !/^\d+$/.test(aadhaarNumber)) {
      showToast('Aadhaar number must be exactly 12 digits', 'error');
      return;
    }

    setAadhaarVerifying(true);
    try {
      const res = await api.post('/verification/verify', { aadhaarNumber });

      if (res.data.connectionStatus === 'active') {
        showToast('Tenant is already active in your registry', 'error');
        setVerificationResult(null);
        return;
      }

      if (res.data.connectionStatus === 'inactive') {
        if (confirm('This user already exists in the system (inactive connection). Would you like to reactivate this connection?')) {
          try {
            await api.post('/tenants/connections/activate', { aadhaarNumber });
            showToast('Tenant connection reactivated successfully!', 'success');
            setIsAddModalOpen(false);
            resetForm();
            fetchTenants();
            fetchPayments();
          } catch (activateErr: any) {
            showToast(activateErr.response?.data?.message || 'Failed to activate connection', 'error');
          }
        }
        setVerificationResult(null);
        return;
      }

      setVerificationResult(res.data);
      showToast('Aadhaar verification report retrieved successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to retrieve Aadhaar verification report', 'error');
    } finally {
      setAadhaarVerifying(false);
    }
  };

  const handleProceedToRegistration = () => {
    if (!verificationResult) return;
    const { prefill } = verificationResult;
    setFullName(prefill.fullName || '');
    setTenantEmail(prefill.email || '');
    setPhone(prefill.phone || '');
    setEmergencyContact(prefill.emergencyContact || '');
    setOccupation(prefill.occupation || '');
    setAddress(prefill.address || '');
    setInviteEmail(prefill.email || '');

    if (verificationResult.isNewTenant) {
      setRegistrationMode('invite');
    } else {
      setRegistrationMode('manual');
    }
    setWizardStep(2);
  };

  const handleSendInvitation = async () => {
    if (!aadhaarNumber || aadhaarNumber.length !== 12 || !/^\d+$/.test(aadhaarNumber)) {
      showToast('Aadhaar number must be exactly 12 digits', 'error');
      return;
    }
    if (!selectedOwnerId) {
      showToast('Please assign an owner to manage this tenant invitation', 'error');
      return;
    }

    const resolvedEmail = (inviteEmail || tenantEmail).trim();
    if (!resolvedEmail) {
      showToast('Tenant email is required to send the invitation', 'error');
      return;
    }

    setInviteSending(true);
    try {
      const res = await api.post('/tenants/invites', {
        aadhaarNumber,
        email: resolvedEmail,
        assignedProperty: selectedPropertyId || null,
        assignedRoom: selectedRoomId || null,
        assignedBed: selectedBedId || null,
        joiningDate: joiningDate || null,
        ownerId: selectedOwnerId
      });

      setInviteUrl(res.data.invite.inviteUrl);
      showToast('Invitation link sent successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to send invitation link', 'error');
    } finally {
      setInviteSending(false);
    }
  };

  const handleBackToStep1 = () => {
    setWizardStep(1);
  };

  // Checkout states
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedTenantForCheckout, setSelectedTenantForCheckout] = useState<any | null>(null);
  const [checkoutRating, setCheckoutRating] = useState(5);
  const [checkoutFeedback, setCheckoutFeedback] = useState('');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedTenantForProfile, setSelectedTenantForProfile] = useState<any | null>(null);

  // Profile edit form state (pre-populated when selectedTenantForProfile changes)
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmergencyContact, setEditEmergencyContact] = useState('');
  const [editOccupation, setEditOccupation] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Documents state for selected tenant
  const [tenantDocs, setTenantDocs] = useState<{
    aadhaarDocName?: string;
    aadhaarDocData?: string;
    agreementDocName?: string;
    agreementDocData?: string;
    photoDocName?: string;
    photoDocData?: string;
  }>({});

  useEffect(() => {
    if (selectedTenantForProfile) {
      setEditFullName(selectedTenantForProfile.fullName);
      setEditPhone(selectedTenantForProfile.phone);
      setEditEmergencyContact(selectedTenantForProfile.emergencyContact);
      setEditOccupation(selectedTenantForProfile.occupation);
      setEditAddress(selectedTenantForProfile.address);

      setTenantDocs(selectedTenantForProfile.documents || {});
    }
  }, [selectedTenantForProfile]);

  const handleUpdateTenantProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForProfile) return;

    setEditSubmitting(true);
    try {
      await api.put(`/tenants/${selectedTenantForProfile._id}`, {
        fullName: editFullName,
        phone: editPhone,
        emergencyContact: editEmergencyContact,
        occupation: editOccupation,
        address: editAddress
      });

      showToast('Tenant profile updated successfully', 'success');
      setIsProfileModalOpen(false);
      fetchTenants();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update tenant profile', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDocumentUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: 'aadhaar' | 'agreement' | 'photo'
  ) => {
    if (!selectedTenantForProfile || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async () => {
      const base64Data = reader.result as string;
      const payload: any = {};

      if (docType === 'aadhaar') {
        payload.aadhaarDocName = file.name;
        payload.aadhaarDocData = base64Data;
      } else if (docType === 'agreement') {
        payload.agreementDocName = file.name;
        payload.agreementDocData = base64Data;
      } else if (docType === 'photo') {
        payload.photoDocName = file.name;
        payload.photoDocData = base64Data;
      }

      try {
        showToast('Uploading document to database...', 'info');
        const res = await api.post(`/tenants/${selectedTenantForProfile._id}/documents`, payload);
        setTenantDocs(res.data.documents);
        showToast(`${file.name} uploaded successfully!`, 'success');

        const updatedTenant = { ...selectedTenantForProfile, documents: res.data.documents };
        setSelectedTenantForProfile(updatedTenant);

        fetchTenants();
      } catch (err: any) {
        showToast(err.response?.data?.message || 'Failed to upload document', 'error');
      }
    };

    reader.onerror = () => {
      showToast('Failed to read file', 'error');
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveDocument = async (docType: 'aadhaar' | 'agreement' | 'photo') => {
    if (!selectedTenantForProfile) return;

    const payload: any = {};
    if (docType === 'aadhaar') {
      payload.aadhaarDocName = '';
      payload.aadhaarDocData = '';
    } else if (docType === 'agreement') {
      payload.agreementDocName = '';
      payload.agreementDocData = '';
    } else if (docType === 'photo') {
      payload.photoDocName = '';
      payload.photoDocData = '';
    }

    try {
      showToast('Removing document from database...', 'info');
      const res = await api.post(`/tenants/${selectedTenantForProfile._id}/documents`, payload);
      setTenantDocs(res.data.documents);
      showToast('Document removed', 'info');

      const updatedTenant = { ...selectedTenantForProfile, documents: res.data.documents };
      setSelectedTenantForProfile(updatedTenant);

      fetchTenants();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to remove document', 'error');
    }
  };

  const fetchTenants = async () => {
    try {
      const res = await api.get('/tenants');
      setTenants(res.data);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to fetch tenants', 'error');
    }
  };

  const fetchOwnersAndAllocationData = async () => {
    try {
      const [ownersRes, propsRes] = await Promise.all([
        api.get('/auth/owners'),
        api.get('/properties')
      ]);
      setOwners(ownersRes.data);
      setProperties(propsRes.data);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to fetch context configuration details', 'error');
    }
  };

  const fetchPayments = async () => {
    try {
      const res = await api.get('/payments');
      setPayments(res.data || []);
    } catch (err) {
      console.error('Failed to fetch payments', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchTenants(), fetchOwnersAndAllocationData(), fetchPayments()]);
      setIsLoading(false);
    };
    init();
  }, []);

  // Fetch rooms dynamically when property is selected
  useEffect(() => {
    if (!selectedPropertyId) {
      setRooms([]);
      return;
    }
    const fetchRooms = async () => {
      try {
        const propDetail = await api.get(`/properties/${selectedPropertyId}`);
        setRooms(propDetail.data.rooms || []);
      } catch (err: any) {
        showToast(err.response?.data?.message || 'Failed to fetch rooms', 'error');
      }
    };
    fetchRooms();
  }, [selectedPropertyId, showToast]);

  // Fetch beds dynamically when room is selected
  useEffect(() => {
    if (!selectedRoomId) {
      setBeds([]);
      return;
    }
    const activeRoom = rooms.find((r) => r._id === selectedRoomId);
    if (activeRoom) {
      const fetchBeds = async () => {
        try {
          const res = await api.get(`/properties/${selectedPropertyId}`);
          if (res.data && res.data.beds) {
            const vacantBeds = res.data.beds.filter(
              (b: any) => b.room === selectedRoomId && !b.isOccupied
            );
            setBeds(vacantBeds);
          } else {
            setBeds([]);
          }
        } catch (err: any) {
          showToast(err.response?.data?.message || 'Failed to fetch beds', 'error');
        }
      };
      fetchBeds();
    }
  }, [selectedRoomId, rooms, selectedPropertyId, showToast]);

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !aadhaarNumber || !phone || !selectedOwnerId) {
      showToast('Name, Aadhaar, phone, and owner assignment are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/tenants', {
        fullName,
        aadhaarNumber,
        phone,
        emergencyContact,
        occupation,
        address,
        assignedProperty: selectedPropertyId || null,
        assignedRoom: selectedRoomId || null,
        assignedBed: selectedBedId || null,
        joiningDate: joiningDate || null,
        ownerId: selectedOwnerId
      });

      showToast('Tenant registered and allocated successfully!', 'success');
      setIsAddModalOpen(false);
      resetForm();
      fetchTenants();
      fetchPayments();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to register tenant', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (registrationMode === 'invite') {
      handleSendInvitation();
    } else {
      handleAddTenant(e);
    }
  };

  const handleAddCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForProfile || !newChargeDesc || !newChargeAmount) return;

    try {
      const res = await api.post(`/tenants/${selectedTenantForProfile._id}/charges`, {
        description: newChargeDesc,
        amount: Number(newChargeAmount)
      });
      showToast('Additional charge added successfully', 'success');
      setNewChargeDesc('');
      setNewChargeAmount('');
      setSelectedTenantForProfile({
        ...selectedTenantForProfile,
        additionalCharges: res.data.additionalCharges
      });
      fetchTenants();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to add charge', 'error');
    }
  };

  const handleRemoveCharge = async (chargeId: string) => {
    if (!selectedTenantForProfile) return;

    try {
      const res = await api.delete(`/tenants/${selectedTenantForProfile._id}/charges/${chargeId}`);
      showToast('Additional charge removed', 'info');
      setSelectedTenantForProfile({
        ...selectedTenantForProfile,
        additionalCharges: res.data.additionalCharges
      });
      fetchTenants();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to remove charge', 'error');
    }
  };

  const handleSendMonthlyBill = async () => {
    if (!selectedTenantForProfile) return;
    setIsBillingSending(true);
    try {
      await api.post(`/tenants/${selectedTenantForProfile._id}/send-bill`);
      showToast('Monthly rent bill generated and emailed successfully!', 'success');
      setSelectedTenantForProfile({
        ...selectedTenantForProfile,
        additionalCharges: []
      });
      fetchTenants();
      fetchPayments();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to send monthly bill', 'error');
    } finally {
      setIsBillingSending(false);
    }
  };

  const handleCheckoutTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForCheckout) return;

    setCheckoutSubmitting(true);
    try {
      await api.post(`/tenants/${selectedTenantForCheckout._id}/checkout`, {
        rating: checkoutRating,
        feedback: checkoutFeedback
      });
      showToast('Tenant checked out successfully and review recorded!', 'success');
      setIsCheckoutModalOpen(false);
      fetchTenants();
      fetchPayments();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to check out tenant', 'error');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handleDeleteTenant = async (id: string) => {
    if (!confirm('Are you sure you want to remove this tenant? This will also vacate their assigned bed space.')) return;

    try {
      await api.delete(`/tenants/${id}`);
      showToast('Tenant removed successfully', 'success');
      fetchTenants();
      fetchPayments();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to remove tenant', 'error');
    }
  };

  const resetForm = () => {
    setFullName('');
    setAadhaarNumber('');
    setTenantEmail('');
    setPhone('');
    setEmergencyContact('');
    setOccupation('');
    setAddress('');
    setSelectedPropertyId('');
    setSelectedRoomId('');
    setSelectedBedId('');
    setSelectedOwnerId('');
    setWizardStep(1);
    setVerificationResult(null);
    setRegistrationMode('manual');
    setInviteEmail('');
    setInviteUrl('');
    setJoiningDate(getTodayDateString());
  };

  const uniqueTenants = tenants.filter((item, index, self) =>
    self.findIndex((t) => t._id === item._id) === index &&
    (item.aadhaarNumber ? self.findIndex((t) => t.aadhaarNumber === item.aadhaarNumber) === index : true)
  );

  const searchFilteredTenants = uniqueTenants.filter((tenant) =>
    tenant.fullName.toLowerCase().includes(tenantSearchQuery.toLowerCase())
  );

  const filteredTenants = searchFilteredTenants.filter((tenant) => {
    if (statusFilter === 'active') return !!tenant.assignedBed;
    if (statusFilter === 'pending') return !tenant.assignedBed;
    return true;
  });

  const activeTenantCount = searchFilteredTenants.filter(t => !!t.assignedBed).length;
  const pendingTenantCount = searchFilteredTenants.filter(t => !t.assignedBed).length;

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative space-y-6 overflow-hidden">
      <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute top-40 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      {/* Header Banner */}
      <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-r from-slate-905 via-slate-800 to-slate-950 text-white shadow-xl relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_35%)]" />
        <div className="relative p-6 md:p-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Administration Registry</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-1">Global Tenants Register</h2>
            <p className="text-sm text-slate-350 mt-2 max-w-2xl">Oversight of all registered occupants and background review records on the platform.</p>
          </div>
          <button
            onClick={() => {
              fetchOwnersAndAllocationData();
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white text-primary hover:bg-slate-100 text-sm font-extrabold shadow-lg shadow-black/10 transition-all hover:scale-[1.02] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add New Tenant
          </button>
        </div>
      </div>

      {tenants.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm">
          <Users className="w-12 h-12 mx-auto text-primary mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Tenants Registered</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Start entering occupant details and allocating room spaces.</p>
          <button
            onClick={() => {
              fetchOwnersAndAllocationData();
              setIsAddModalOpen(true);
            }}
            className="mt-6 px-4 py-2.5 rounded-full bg-primary text-white text-sm font-extrabold shadow-md shadow-primary/20"
          >
            Register Tenant
          </button>
        </div>
      ) : (
        <>
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search tenants by name..."
                value={tenantSearchQuery}
                onChange={(e) => setTenantSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${statusFilter === 'all'
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                All ({searchFilteredTenants.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${statusFilter === 'active'
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                Active ({activeTenantCount})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${statusFilter === 'pending'
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                Pending ({pendingTenantCount})
              </button>
            </div>
          </div>

          {filteredTenants.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <Search className="w-12 h-12 mx-auto text-slate-400 mb-4 animate-pulse" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">No matching tenants</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">No tenants match your search filter settings.</p>
            </div>
          ) : (
            /* Data Table */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[1250px] md:min-w-0 md:table-fixed text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F1F5F9] dark:bg-slate-955 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-14">S.No</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tenant</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Associated Owner</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-24">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Assigned Space</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-28">Scores</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Payment</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-32 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTenants.map((tenant, index) => {
                      const outstanding = getOutstandingBalance(tenant._id);
                      const hasPhoto = tenant.documents?.photoDocData;
                      const isActive = !!tenant.assignedBed;

                      return (
                        <tr
                          key={tenant._id}
                          onClick={() => {
                            setSelectedTenantForProfile(tenant);
                            setIsProfileModalOpen(true);
                          }}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                        >
                          {/* S.No */}
                          <td className="px-4 py-3.5 text-sm text-slate-400 tabular-nums">{index + 1}</td>

                          {/* Tenant */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              {hasPhoto ? (
                                <img
                                  src={tenant.documents?.photoDocData}
                                  alt={tenant.fullName}
                                  className="w-9 h-9 rounded-full object-cover border-2 border-primary/20 shadow-sm flex-shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs uppercase flex-shrink-0">
                                  {tenant.fullName.substring(0, 2)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{tenant.fullName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{tenant.occupation || 'Occupant'}</p>
                              </div>
                            </div>
                          </td>

                          {/* Associated Owner */}
                          <td className="px-4 py-3.5">
                            {tenant.owner ? (
                              <div>
                                <span className="font-semibold text-slate-850 dark:text-slate-200 block text-xs">{tenant.owner.fullName}</span>
                                <span className="text-[10px] text-slate-400 block">{tenant.owner.email}</span>
                              </div>
                            ) : (
                              <span className="text-xs italic text-slate-400">Unassigned</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5">
                            {isActive ? (
                              <span className="inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Contact Info */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              {tenant.phone}
                            </div>
                          </td>

                          {/* Assigned Space */}
                          <td className="px-4 py-3.5">
                            {tenant.assignedProperty ? (
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{tenant.assignedProperty.propertyName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  Room {tenant.assignedRoom?.roomNumber || 'N/A'} ({tenant.assignedBed?.bedNumber?.split('-').pop() || 'N/A'})
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs italic text-slate-400">Not Allocated</span>
                            )}
                          </td>

                          {/* Scores */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold uppercase text-slate-400">Credit</span>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">{tenant.creditScore || 700}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold uppercase text-slate-400">Risk</span>
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${tenant.riskLevel === 'low'
                                    ? 'text-teal-700 bg-teal-50 dark:text-teal-400 dark:bg-teal-950/30'
                                    : tenant.riskLevel === 'medium'
                                      ? 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30'
                                      : 'text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/30'
                                  }`}>
                                  {tenant.riskLevel === 'low' ? 'LOW' : tenant.riskLevel === 'medium' ? 'MED' : 'HIGH'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Payment Status */}
                          <td className="px-4 py-3.5">
                            {outstanding > 0 ? (
                              <span className="text-sm font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                Outstanding: ₹{outstanding.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                                No Dues Pending
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTenantForProfile(tenant);
                                  setIsProfileModalOpen(true);
                                }}
                                className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                                title="View Dossier & Files"
                              >
                                <FolderOpen className="w-4 h-4" />
                              </button>

                              {tenant.assignedBed && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTenantForCheckout(tenant);
                                    setCheckoutRating(5);
                                    setCheckoutFeedback('');
                                    setIsCheckoutModalOpen(true);
                                  }}
                                  className="p-2 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors"
                                  title="Checkout & Review"
                                >
                                  <Star className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTenant(tenant._id);
                                }}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                                title="Remove Tenant"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Table footer with count */}
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between text-xs text-slate-505">
                <span>Showing {filteredTenants.length} of {uniqueTenants.length} tenants</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> {activeTenantCount} Active
                  <span className="ml-2 w-2 h-2 rounded-full bg-slate-450 inline-block"></span> {pendingTenantCount} Pending
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Tenant Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                resetForm();
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            {wizardStep === 1 ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-primary animate-pulse-subtle" />
                    Aadhaar Verification (Step 1 of 2)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Enter the occupant's Aadhaar number to verify their background and previous reviews.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                    Aadhaar Card Number (12 Digits)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={aadhaarNumber}
                        onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        placeholder="Enter 12-digit number"
                        maxLength={12}
                      />
                      <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    </div>
                    <button
                      type="button"
                      disabled={aadhaarVerifying || aadhaarNumber.length !== 12}
                      onClick={handleVerifyAadhaar}
                      className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-primary/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 flex items-center gap-1.5 shrink-0"
                    >
                      {aadhaarVerifying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        'Check Profile'
                      )}
                    </button>
                  </div>
                </div>

                {verificationResult && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                        Background Screening Results
                      </h4>

                      {verificationResult.verificationLog.result.alertMsg && (
                        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start gap-2.5 text-rose-800 dark:text-rose-300 text-xs font-semibold mb-4">
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <div>{verificationResult.verificationLog.result.alertMsg}</div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-450">Reliability Index</span>
                              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                                {verificationResult.verificationLog.result.creditScore}
                              </div>
                            </div>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${verificationResult.verificationLog.result.riskLevel === 'low'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                : verificationResult.verificationLog.result.riskLevel === 'medium'
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                                  : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                              }`}>
                              {verificationResult.verificationLog.result.riskLevel} Risk
                            </span>
                          </div>

                          <div className="space-y-1 mt-3">
                            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-500 ${verificationResult.verificationLog.result.riskLevel === 'low'
                                    ? 'bg-emerald-500'
                                    : verificationResult.verificationLog.result.riskLevel === 'medium'
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                style={{ width: `${((verificationResult.verificationLog.result.creditScore - 300) / 550) * 100}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase">
                              <span>300</span>
                              <span>850</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-450">Exit Review Rating</span>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <div className="text-3xl font-black text-slate-900 dark:text-white">
                                {verificationResult.verificationLog.result.previousRating.toFixed(1)}
                              </div>
                              <div className="flex text-amber-400">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-3.5 h-3.5 ${star <= Math.round(verificationResult.verificationLog.result.previousRating)
                                        ? 'fill-current text-amber-400'
                                        : 'text-slate-300 dark:text-slate-700'
                                      }`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold mt-2">
                            Status: <span className="text-slate-800 dark:text-slate-200 capitalize font-bold">{verificationResult.verificationLog.status}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-450">Payment History Index</span>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                          {verificationResult.verificationLog.result.paymentHistory}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleProceedToRegistration}
                      className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                    >
                      Proceed to Registration
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      Occupant Registration (Step 2 of 2)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Customize details and select property allocation. Fields are pre-filled from Aadhaar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBackToStep1}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover bg-primary/5 px-3 py-2 rounded-full self-start sm:self-auto whitespace-nowrap"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Verify
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Account / Owner Selector */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Assign Managing Landlord (Owner)</label>
                    <select
                      value={selectedOwnerId}
                      onChange={(e) => {
                        setSelectedOwnerId(e.target.value);
                        setSelectedPropertyId('');
                        setSelectedRoomId('');
                        setSelectedBedId('');
                      }}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      <option value="">-- Choose Owner --</option>
                      {owners.map((owner) => (
                        <option key={(owner as any)._id || owner.id} value={(owner as any)._id || owner.id}>
                          {owner.fullName} ({owner.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRegistrationMode('invite')}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${registrationMode === 'invite'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40'
                        }`}
                    >
                      <div>
                        <div className="text-sm font-bold">Send Invitation Link</div>
                        <div className="text-[11px] text-slate-505 dark:text-slate-400">Tenant completes details from a secure link.</div>
                      </div>
                      <Mail className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegistrationMode('manual')}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${registrationMode === 'manual'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40'
                        }`}
                    >
                      <div>
                        <div className="text-sm font-bold">Manual Registration</div>
                        <div className="text-[11px] text-slate-505 dark:text-slate-400">Enter tenant details immediately and allocate now.</div>
                      </div>
                      <User className="w-4 h-4" />
                    </button>
                  </div>

                  {inviteUrl && (
                    <div className="p-3 rounded-2xl border border-emerald-205 bg-emerald-50 text-emerald-900 text-xs font-semibold break-all">
                      Invitation sent: {inviteUrl}
                    </div>
                  )}

                  {registrationMode === 'invite' && (
                    <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Tenant Email</label>
                          <input
                            type="email"
                            value={inviteEmail || tenantEmail}
                            onChange={(e) => {
                              setInviteEmail(e.target.value);
                              setTenantEmail(e.target.value);
                            }}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="tenant@example.com"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Expected Joining Date</label>
                          <div className="relative">
                            <input
                              type="date"
                              value={joiningDate}
                              onChange={(e) => setJoiningDate(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                              required
                            />
                            <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {registrationMode === 'manual' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Occupant Name</label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="Arjun Kumar"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Aadhaar (Read-Only)</label>
                          <input
                            type="text"
                            value={aadhaarNumber}
                            disabled
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-950/40 text-slate-400 text-sm cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Email</label>
                        <input
                          type="email"
                          value={tenantEmail}
                          onChange={(e) => setTenantEmail(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          placeholder="tenant@example.com"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Phone</label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="9876500001"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Emergency Phone</label>
                          <input
                            type="tel"
                            value={emergencyContact}
                            onChange={(e) => setEmergencyContact(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="Emergency Contact"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Joining Date</label>
                          <div className="relative">
                            <input
                              type="date"
                              value={joiningDate}
                              onChange={(e) => setJoiningDate(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                              required
                            />
                            <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Occupation</label>
                          <input
                            type="text"
                            value={occupation}
                            onChange={(e) => setOccupation(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="Software Engineer"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Permanent Address</label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          placeholder="City, State"
                        />
                      </div>
                    </div>
                  )}

                  {/* Allocation Layout */}
                  {selectedOwnerId && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                      <h4 className="text-xs font-bold uppercase text-slate-400">Space Allocation (Optional)</h4>

                      {(() => {
                        const ownerProps = properties.filter((p) => (p.owner?._id || p.owner) === selectedOwnerId);
                        
                        if (ownerProps.length === 0) {
                          return (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-805 font-semibold">
                              ⚠️ The selected owner has no properties registered yet.
                            </div>
                          );
                        }

                        return (
                          <div>
                            <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Select Property</label>
                            <select
                              value={selectedPropertyId}
                              onChange={(e) => {
                                setSelectedPropertyId(e.target.value);
                                setSelectedRoomId('');
                                setSelectedBedId('');
                              }}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            >
                              <option value="">-- Choose Property --</option>
                              {ownerProps.map((p) => (
                                <option key={p._id} value={p._id}>{p.propertyName}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}

                      {selectedPropertyId && (
                        <div>
                          <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Select Room</label>
                          <select
                            value={selectedRoomId}
                            onChange={(e) => {
                              setSelectedRoomId(e.target.value);
                              setSelectedBedId('');
                            }}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          >
                            <option value="">-- Choose Room --</option>
                            {rooms.map((r) => (
                              <option key={r._id} value={r._id}>
                                {r.roomNumber} (Rent: ₹{r.monthlyRent})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {selectedRoomId && (
                        <div>
                          <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Select Bed Space</label>
                          <select
                            value={selectedBedId}
                            onChange={(e) => setSelectedBedId(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          >
                            <option value="">-- Choose Bed Space --</option>
                            {beds.map((b) => (
                              <option key={b._id} value={b._id}>{b.bedNumber}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {registrationMode === 'invite' ? (
                    <button
                      type="submit"
                      disabled={inviteSending || !selectedOwnerId}
                      className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50 mt-4 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                    >
                      {inviteSending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending Invitation...
                        </>
                      ) : (
                        <>
                          Send Invitation Link
                          <Send className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting || !selectedOwnerId}
                      className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50 mt-4 hover:scale-[1.02] transition-transform"
                    >
                      {submitting ? 'Registering...' : 'Register and Allocate Space'}
                    </button>
                  )}
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutModalOpen && selectedTenantForCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
            <button
              onClick={() => setIsCheckoutModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              Tenant Checkout Review
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Submit rental exit rating and performance review for {selectedTenantForCheckout.fullName}.
            </p>

            <form onSubmit={handleCheckoutTenant} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Checkout Rating Score</label>
                <div className="flex gap-2 text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setCheckoutRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star className={`w-7 h-7 ${star <= checkoutRating ? 'fill-current' : 'text-slate-300 dark:text-slate-700'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Feedback & Reviews</label>
                <textarea
                  value={checkoutFeedback}
                  onChange={(e) => setCheckoutFeedback(e.target.value)}
                  placeholder="e.g. Always paid rent on time, kept the property clean and followed terms."
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none min-h-[100px]"
                />
              </div>

              <button
                type="submit"
                disabled={checkoutSubmitting}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50 mt-4 hover:scale-[1.02] transition-transform"
              >
                {checkoutSubmitting ? 'Submitting review logs...' : 'Complete Checkout & Save Rating'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tenant Dossier Modal */}
      {isProfileModalOpen && selectedTenantForProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setIsProfileModalOpen(false);
                setSelectedTenantForProfile(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <FolderOpen className="w-6 h-6 text-primary" />
              <div>
                <h3 className="text-xl font-black text-slate-905 dark:text-white">Tenant Dossier & Profile</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">View screening metrics, rent agreements, upload documents, and customize charges.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Profile Info & Docs */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Occupancy Information</h4>
                  <form onSubmit={handleUpdateTenantProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Full Name</label>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Phone</label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Emergency Phone</label>
                      <input
                        type="tel"
                        value={editEmergencyContact}
                        onChange={(e) => setEditEmergencyContact(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Occupation</label>
                      <input
                        type="text"
                        value={editOccupation}
                        onChange={(e) => setEditOccupation(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Permanent Address</label>
                      <input
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={editSubmitting}
                        className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-primary/20 transition-all hover:scale-[1.02]"
                      >
                        {editSubmitting ? 'Saving...' : 'Update Details'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Verification & Legal Documents</h4>
                  <div className="space-y-3">
                    {/* Aadhaar File */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">Aadhaar Card copy</span>
                          <span className="text-[10px] text-slate-400 block">{tenantDocs.aadhaarDocName || 'No document uploaded'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {tenantDocs.aadhaarDocData ? (
                          <>
                            <a
                              href={tenantDocs.aadhaarDocData}
                              download={tenantDocs.aadhaarDocName || 'aadhaar'}
                              className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 rounded-lg text-[10px] font-bold"
                            >
                              Download
                            </a>
                            <button
                              onClick={() => handleRemoveDocument('aadhaar')}
                              className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 rounded-lg text-[10px] font-bold"
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <label className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-[10px] font-bold cursor-pointer">
                            Upload
                            <input type="file" onChange={(e) => handleDocumentUpload(e, 'aadhaar')} className="hidden" />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Lease Rental Agreement */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">Lease Agreement</span>
                          <span className="text-[10px] text-slate-400 block">{tenantDocs.agreementDocName || 'No document uploaded'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {tenantDocs.agreementDocData ? (
                          <>
                            <a
                              href={tenantDocs.agreementDocData}
                              download={tenantDocs.agreementDocName || 'agreement'}
                              className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 rounded-lg text-[10px] font-bold"
                            >
                              Download
                            </a>
                            <button
                              onClick={() => handleRemoveDocument('agreement')}
                              className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 rounded-lg text-[10px] font-bold"
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <label className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-[10px] font-bold cursor-pointer">
                            Upload
                            <input type="file" onChange={(e) => handleDocumentUpload(e, 'agreement')} className="hidden" />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Occupant Verification Photo */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">Verification Photo</span>
                          <span className="text-[10px] text-slate-400 block">{tenantDocs.photoDocName || 'No document uploaded'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {tenantDocs.photoDocData ? (
                          <>
                            <a
                              href={tenantDocs.photoDocData}
                              download={tenantDocs.photoDocName || 'photo'}
                              className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 rounded-lg text-[10px] font-bold"
                            >
                              Download
                            </a>
                            <button
                              onClick={() => handleRemoveDocument('photo')}
                              className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 rounded-lg text-[10px] font-bold"
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <label className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-[10px] font-bold cursor-pointer">
                            Upload
                            <input type="file" onChange={(e) => handleDocumentUpload(e, 'photo')} className="hidden" />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Billing & Invoices History Panel */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-450 mb-3">Billing & Invoices History</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {(() => {
                      const tenantBills = payments.filter((p) => p.tenant?._id === selectedTenantForProfile._id);
                      if (tenantBills.length === 0) {
                        return (
                          <div className="text-xs text-slate-450 italic py-2">
                            No billing invoice entries found in payment history.
                          </div>
                        );
                      }
                      return tenantBills.map((bill) => (
                        <div
                          key={bill._id}
                          className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl text-xs flex items-center justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-850 dark:text-slate-100">
                                ₹{bill.amount.toLocaleString('en-IN')}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider border ${
                                bill.status === 'paid'
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                  : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                              }`}>
                                {bill.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-450 mt-1">
                              Due: {new Date(bill.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            {bill.notes && (
                              <div className="text-[9px] text-slate-400 italic mt-1 font-medium bg-slate-100/50 dark:bg-slate-900/50 p-1.5 rounded-lg border border-slate-200/30">
                                {bill.notes}
                              </div>
                            )}
                          </div>
                          <div className="text-right text-[10px] text-slate-400">
                            {bill.paymentDate && (
                              <span>Paid: {new Date(bill.paymentDate).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* Right Column: Custom Charges & Invoice Trigger */}
              <div className="space-y-6 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Additional Charges & Fines</h4>
                  <p className="text-[11px] text-slate-450 mt-1">Add penalties, maintenance fines, or utilities. Added to next month's bill.</p>
                </div>

                <div className="space-y-3">
                  {selectedTenantForProfile.additionalCharges && selectedTenantForProfile.additionalCharges.length > 0 ? (
                    <div className="space-y-2">
                      {selectedTenantForProfile.additionalCharges.map((charge: any) => (
                        <div key={charge._id} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-205 dark:border-slate-800 text-xs flex items-center justify-between gap-3 shadow-xs">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">{charge.description}</span>
                            <span className="text-[10px] text-slate-400">Added: {new Date(charge.createdAt || Date.now()).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 dark:text-slate-200 font-sans">₹{charge.amount}</span>
                            <button
                              onClick={() => handleRemoveCharge(charge._id)}
                              className="text-rose-600 hover:text-rose-700"
                              title="Delete Fine"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-450 italic py-2">No additional charges pending.</p>
                  )}

                  <form onSubmit={handleAddCharge} className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <input
                      type="text"
                      placeholder="Fine description (e.g. Broken Table)"
                      value={newChargeDesc}
                      onChange={(e) => setNewChargeDesc(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount (INR)"
                        value={newChargeAmount}
                        onChange={(e) => setNewChargeAmount(e.target.value)}
                        required
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02]"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Generate Invoicing Bill</h4>
                  <button
                    onClick={handleSendMonthlyBill}
                    disabled={isBillingSending}
                    className="w-full py-3 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    {isBillingSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating invoice email...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Email Bill to Tenant Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
