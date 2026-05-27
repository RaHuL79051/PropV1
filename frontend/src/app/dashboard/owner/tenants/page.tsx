'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import {
  Users, Plus, Trash2, ShieldCheck, ShieldAlert, Star,
  MapPin, Phone, Briefcase, Loader2, X, User, FileText, Upload, Eye, AlertTriangle,
  ArrowLeft, ArrowRight, Search, Mail, Send, Calendar, FolderOpen, Filter
} from 'lucide-react';
import { Tenant, Property, Room } from '../../../../types';

interface BillingStatus {
  totalTenants: number;
  paidPersons: number;
  unpaidPersons: number;
  amountDue: number;
  isSimulated: boolean;
}

export default function TenantsPage() {
  const showToast = useToastStore((state) => state.showToast);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAlertPopupOpen, setIsAlertPopupOpen] = useState(false);

  // Delete Tenant confirmation states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTenantId, setDeleteTenantId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Step-based registration wizard
  const [wizardStep, setWizardStep] = useState(1);
  const [aadhaarVerifying, setAadhaarVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [registrationMode, setRegistrationMode] = useState<'manual' | 'invite'>('manual');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMethod, setInviteMethod] = useState<'email' | 'whatsapp'>('email');
  const [inviteWhatsapp, setInviteWhatsapp] = useState('');

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
            fetchBillingStatus();
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

    let resolvedEmail = '';
    if (inviteMethod === 'email') {
      resolvedEmail = (inviteEmail || tenantEmail).trim();
      if (!resolvedEmail) {
        showToast('Tenant email is required to send the invitation', 'error');
        return;
      }
    } else {
      if (!inviteWhatsapp || inviteWhatsapp.length < 10) {
        showToast('Valid WhatsApp number is required to send the invitation', 'error');
        return;
      }
    }

    setInviteSending(true);
    try {
      const res = await api.post('/tenants/invites', {
        aadhaarNumber,
        email: inviteMethod === 'email' ? resolvedEmail : '',
        sendMethod: inviteMethod,
        whatsappNumber: inviteMethod === 'whatsapp' ? inviteWhatsapp : '',
        assignedProperty: selectedPropertyId || null,
        assignedRoom: selectedRoomId || null,
        assignedBed: selectedBedId || null,
        joiningDate: joiningDate || null
      });

      if (inviteMethod === 'email') {
        showToast('Invitation link sent successfully', 'success');
        setIsAddModalOpen(false);
        resetForm();
      } else {
        showToast('Invitation generated! Redirecting to WhatsApp...', 'success');
        const inviteUrl = res.data.invite.inviteUrl;
        const messageText = `Hello,\n\nYou have been invited to complete your tenant profile for registration.\n\nPlease complete your details here:\n${inviteUrl}\n\nThank you!`;
        const cleanWhatsapp = inviteWhatsapp.startsWith('91') && inviteWhatsapp.length > 10
          ? inviteWhatsapp
          : `91${inviteWhatsapp}`;
        const waUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(messageText)}`;
        window.open(waUrl, '_blank');
        setIsAddModalOpen(false);
        resetForm();
      }
    } catch (err: any) {
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const details = err.response.data.errors.map((e: any) => `${e.field.replace('body.', '')}: ${e.message}`).join(', ');
        showToast(`Validation failed: ${details}`, 'error');
      } else {
        showToast(err.response?.data?.message || 'Failed to send invitation link', 'error');
      }
    } finally {
      setInviteSending(false);
    }
  };

  const handleBackToStep1 = () => {
    setWizardStep(1);
  };

  // Checkout states
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedTenantForCheckout, setSelectedTenantForCheckout] = useState<Tenant | null>(null);
  const [checkoutRating, setCheckoutRating] = useState(5);
  const [checkoutFeedback, setCheckoutFeedback] = useState('');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedTenantForProfile, setSelectedTenantForProfile] = useState<Tenant | null>(null);

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

      // Load documents from the tenant's database fields
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
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const details = err.response.data.errors.map((e: any) => `${e.field.replace('body.', '')}: ${e.message}`).join(', ');
        showToast(`Validation failed: ${details}`, 'error');
      } else {
        showToast(err.response?.data?.message || 'Failed to update tenant profile', 'error');
      }
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

        // Update selected tenant reference to keep state in sync
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

  const fetchAllocationData = async () => {
    try {
      const propsRes = await api.get('/properties');
      setProperties(propsRes.data);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to fetch properties for allocation', 'error');
      console.error('Failed to fetch allocation context', err);
    }
  };

  const fetchBillingStatus = async () => {
    try {
      const res = await api.get('/payments/bed-billing/status');
      setBillingStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch billing status', err);
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
      await Promise.all([fetchTenants(), fetchAllocationData(), fetchBillingStatus(), fetchPayments()]);
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
        console.error(err);
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
          console.error(err);
        }
      };
      fetchBeds();
    }
  }, [selectedRoomId, rooms, selectedPropertyId, showToast]);

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !aadhaarNumber || !phone) {
      showToast('Name, Aadhaar, and phone are required', 'error');
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
        joiningDate: joiningDate || null
      });

      showToast('Tenant registered and allocated successfully!', 'success');
      setIsAddModalOpen(false);
      resetForm();
      fetchTenants();
      fetchBillingStatus();
      fetchPayments();
    } catch (err: any) {
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const details = err.response.data.errors.map((e: any) => `${e.field.replace('body.', '')}: ${e.message}`).join(', ');
        showToast(`Validation failed: ${details}`, 'error');
      } else {
        showToast(err.response?.data?.message || 'Failed to register tenant', 'error');
      }
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

  const handleSendWhatsAppAlert = () => {
    if (!selectedTenantForProfile) return;

    const fullName = selectedTenantForProfile.fullName;
    const phone = selectedTenantForProfile.phone;
    const cleanPhone = phone.replace(/\D/g, '');
    
    const propName = selectedTenantForProfile.assignedProperty?.propertyName || 'N/A';
    const roomNum = selectedTenantForProfile.assignedRoom?.roomNumber || 'N/A';
    
    const baseRent = selectedTenantForProfile.rentAmount !== undefined && selectedTenantForProfile.rentAmount !== null
      ? selectedTenantForProfile.rentAmount
      : (selectedTenantForProfile.assignedRoom?.monthlyRent || 0);

    const outstanding = getOutstandingBalance(selectedTenantForProfile._id);
    
    let additionalChargesText = '';
    let additionalTotal = 0;
    if (selectedTenantForProfile.additionalCharges && selectedTenantForProfile.additionalCharges.length > 0) {
      additionalChargesText = '\nAdditional Charges:\n' + selectedTenantForProfile.additionalCharges
        .map((c: any) => {
          additionalTotal += c.amount;
          return `- ${c.description}: ₹${c.amount}`;
        })
        .join('\n');
    }

    const totalDue = outstanding + additionalTotal;

    const messageText = `Hello *${fullName}*,\n\nThis is an invoice alert regarding your accommodation at *${propName}*, Room *${roomNum}*.\n\n*Pending Dues Details*:\n- Base Rent: ₹${baseRent}\n- Historical Unpaid Dues: ₹${outstanding}${additionalChargesText}\n\n*Total Amount Due*: ₹${totalDue}\n\nPlease clear your outstanding dues soon.\n\nThank you!`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');
    setIsAlertPopupOpen(false);
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
      fetchBillingStatus();
      fetchPayments();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to check out tenant', 'error');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const triggerDeleteTenant = (id: string) => {
    setDeleteTenantId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteTenant = async () => {
    if (!deleteTenantId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/tenants/${deleteTenantId}`);
      showToast('Tenant removed successfully', 'success');
      setIsDeleteModalOpen(false);
      setDeleteTenantId('');
      fetchTenants();
      fetchBillingStatus();
      fetchPayments();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to remove tenant', 'error');
    } finally {
      setIsDeleting(false);
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
    setWizardStep(1);
    setVerificationResult(null);
    setRegistrationMode('manual');
    setInviteEmail('');
    setInviteMethod('email');
    setInviteWhatsapp('');
    setJoiningDate(getTodayDateString());
  };

  // Duplication fix and filtering logic
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
    <div className="relative space-y-6 overflow-hidden" style={{ width: "100%" }}>
      <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute top-40 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      {/* Header Banner */}
      <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-r from-primary via-primary-hover to-accent text-white shadow-xl relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_35%)]" />
        <div className="relative p-6 md:p-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/75">Tenant Operations</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-1">Tenants Directory</h2>
            <p className="text-sm text-white/80 mt-2 max-w-2xl">Manage and view all tenant profiles and statuses.</p>
          </div>
          <button
            onClick={() => {
              fetchAllocationData();
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white text-primary hover:bg-slate-100 text-sm font-extrabold shadow-lg shadow-black/10 transition-all hover:scale-[1.02] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add New Tenant
          </button>
        </div>
      </div>

      {/* Tenant Billing Alert Warning */}
      {billingStatus && billingStatus.unpaidPersons > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between gap-4 text-xs shadow-sm">
          <span className="text-amber-850 dark:text-amber-300 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> You have {billingStatus.unpaidPersons} unpaid tenant licenses. You must purchase licenses before allocating new tenants.
          </span>
          <a href="/dashboard/owner/properties" className="underline font-bold text-amber-900 dark:text-amber-200">
            Manage Licenses
          </a>
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm">
          <Users className="w-12 h-12 mx-auto text-primary mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Tenants Registered</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Get started by entering occupant details and allocating room spaces.</p>
          <button
            onClick={() => {
              fetchAllocationData();
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
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">No tenants match your current filters. Try another search term or status.</p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full min-w-[1100px] md:min-w-0 md:table-fixed text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F1F5F9] dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-14">S.No</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tenant</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-24">Status</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Aadhaar</th>
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

                            {/* Aadhaar */}
                            <td className="px-4 py-3.5">
                              <span className="text-sm text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                                XXXX-XXXX-{tenant.aadhaarNumber?.slice(-4) || '----'}
                              </span>
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
                                    triggerDeleteTenant(tenant._id);
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
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between text-xs text-slate-500">
                  <span>Showing {filteredTenants.length} of {uniqueTenants.length} tenants</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> {activeTenantCount} Active
                    <span className="ml-2 w-2 h-2 rounded-full bg-slate-400 inline-block"></span> {pendingTenantCount} Pending
                  </span>
                </div>
              </div>

              {/* Mobile View */}
              <div className="block md:hidden space-y-4">
                {filteredTenants.map((tenant, index) => {
                  const outstanding = getOutstandingBalance(tenant._id);
                  const hasPhoto = tenant.documents?.photoDocData;
                  const isActive = !!tenant.assignedBed;

                  return (
                    <div
                      key={tenant._id}
                      onClick={() => {
                        setSelectedTenantForProfile(tenant);
                        setIsProfileModalOpen(true);
                      }}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {hasPhoto ? (
                            <img
                              src={tenant.documents?.photoDocData}
                              alt={tenant.fullName}
                              className="w-10 h-10 rounded-full object-cover border-2 border-primary/20 shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm uppercase flex-shrink-0">
                              {tenant.fullName.substring(0, 2)}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white text-base block">{tenant.fullName}</span>
                            <span className="text-[11px] text-slate-450 capitalize block">{tenant.occupation || 'Occupant'}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          {isActive ? (
                            <span className="inline-flex text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-emerald-50 border-emerald-250 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-xs space-y-1.5 py-2.5 border-t border-b border-slate-50 dark:border-slate-850">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Contact:</span>
                          <span className="text-slate-800 dark:text-slate-300 font-medium">{tenant.phone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Aadhaar:</span>
                          <span className="text-slate-800 dark:text-slate-300 font-mono">XXXX-XXXX-{tenant.aadhaarNumber?.slice(-4) || '----'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Assigned Space:</span>
                          <span className="text-slate-850 dark:text-slate-200 font-medium truncate max-w-[65%] text-right">
                            {tenant.assignedProperty ? (
                              `${tenant.assignedProperty.propertyName} (Room ${tenant.assignedRoom?.roomNumber || 'N/A'})`
                            ) : (
                              <span className="italic text-slate-400">Not Allocated</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Credit Score:</span>
                          <div className="flex gap-1.5 items-center">
                            <span className="font-bold text-slate-850 dark:text-slate-200">{tenant.creditScore || 700}</span>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${tenant.riskLevel === 'low'
                              ? 'text-teal-700 border-teal-500/20 bg-teal-50 dark:text-teal-400 dark:bg-teal-950/30'
                              : tenant.riskLevel === 'medium'
                                ? 'text-amber-700 border-amber-500/20 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30'
                                : 'text-rose-700 border-rose-500/20 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/30'
                              }`}>
                              {tenant.riskLevel === 'low' ? 'Low' : tenant.riskLevel === 'medium' ? 'Med' : 'High'}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Rating:</span>
                          <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                            {tenant.tenantRating ? (
                              <>
                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                {tenant.tenantRating.toFixed(1)}/5
                              </>
                            ) : (
                              <span className="text-slate-400 italic text-[11px] font-normal">No rating</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Outstanding:</span>
                          <span className={`font-bold ${outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            ₹{outstanding.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setSelectedTenantForProfile(tenant);
                            setIsProfileModalOpen(true);
                          }}
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <FolderOpen className="w-3.5 h-3.5" /> Dossier & Files
                        </button>
                        <div className="flex gap-2">
                          {tenant.assignedBed && (
                            <button
                              onClick={() => {
                                setSelectedTenantForCheckout(tenant);
                                setCheckoutRating(5);
                                setCheckoutFeedback('');
                                setIsCheckoutModalOpen(true);
                              }}
                              className="inline-flex items-center justify-center px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 text-xs font-bold rounded-lg transition-all"
                            >
                              Checkout
                            </button>
                          )}
                          <button
                            onClick={() => triggerDeleteTenant(tenant._id)}
                            className="p-1.5 border border-slate-200 dark:border-slate-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                            title="Delete Tenant"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
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
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:hover:text-slate-350"
            >
              <X className="w-5 h-5" />
            </button>

            {wizardStep === 1 ? (
              <div className="space-y-6">
                <div className="pr-10">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-primary animate-pulse-subtle" />
                    Aadhaar Verification (Step 1 of 2)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Enter the occupant's Aadhaar number to verify their background, reliability index, and previous rental reviews.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase text-slate-550 dark:text-slate-400">
                    Aadhaar Card Number (12 Digits)
                  </label>
                  <div className="flex gap-2 flex-col">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={aadhaarNumber}
                        onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        placeholder="Enter 12-digit number (e.g. 123456789012)"
                        maxLength={12}
                      />
                      <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    </div>
                    <button
                      type="button"
                      disabled={aadhaarVerifying || aadhaarNumber.length !== 12}
                      onClick={handleVerifyAadhaar}
                      className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-primary/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 flex items-center gap-1.5 shrink-0"
                      style={{ margin: "0 auto", width: "100%", display: "flex", justifyContent: "center" }}
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

                      {/* Alert banner */}
                      {verificationResult.verificationLog.result.alertMsg && (
                        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start gap-2.5 text-rose-800 dark:text-rose-300 text-xs font-semibold mb-4">
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <div>{verificationResult.verificationLog.result.alertMsg}</div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Reliability Index Card */}
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

                          {/* Progress line */}
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

                        {/* Rating Card */}
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

                      {/* Payment History */}
                      <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-450">Payment History Index</span>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                          {verificationResult.verificationLog.result.paymentHistory}
                        </p>
                      </div>

                      {/* Historical Reviews */}
                      <div className="mt-4 space-y-2">
                        <span className="text-[10px] uppercase font-bold text-slate-455">Historical Landlord Reviews</span>
                        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                          {verificationResult.reviews && verificationResult.reviews.length > 0 ? (
                            verificationResult.reviews.map((rev: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs flex flex-col gap-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-850 dark:text-slate-200">
                                    Owner: {rev.ownerName}
                                  </span>
                                  <div className="flex text-amber-400">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={`w-3 h-3 ${star <= rev.rating
                                          ? 'fill-current text-amber-400'
                                          : 'text-slate-300 dark:text-slate-700'
                                          }`}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <p className="text-slate-600 dark:text-slate-450 font-medium italic">
                                  "{rev.feedback}"
                                </p>
                                <div className="text-[9px] text-slate-400 text-right">
                                  {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-450 italic py-2">
                              No landlord reviews recorded.
                            </div>
                          )}
                        </div>
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
                  <div className="pr-10">
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
                </div>                <form onSubmit={handleSubmit} className="space-y-4">
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
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">Tenant completes details from a secure link.</div>
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
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">Enter tenant details immediately and allocate now.</div>
                      </div>
                      <User className="w-4 h-4" />
                    </button>
                  </div>

                  {verificationResult?.isNewTenant && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-2xl text-xs text-blue-800 dark:text-blue-300 font-semibold">
                      💡 This is a new tenant record. You can send them an invite to fill their details, or register them manually.
                    </div>
                  )}

                  {registrationMode === 'invite' && (
                    <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4">
                      {/* Method Selector Pills */}
                      <div className="flex gap-2 p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setInviteMethod('email')}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${inviteMethod === 'email'
                            ? 'bg-white dark:bg-slate-900 text-primary shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                            }`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Email Invite
                        </button>
                        <button
                          type="button"
                          onClick={() => setInviteMethod('whatsapp')}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${inviteMethod === 'whatsapp'
                            ? 'bg-white dark:bg-slate-900 text-primary shadow-sm'
                            : 'text-slate-550 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white'
                            }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          WhatsApp Invite
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {inviteMethod === 'email' ? (
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
                        ) : (
                          <div>
                            <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Tenant WhatsApp Number</label>
                            <input
                              type="tel"
                              value={inviteWhatsapp}
                              onChange={(e) => setInviteWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 10))}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                              placeholder="9876543210"
                              required
                            />
                          </div>
                        )}
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
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-950/40 text-slate-450 text-sm cursor-not-allowed"
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
                            type="number"
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
                            type="number"
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
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold uppercase text-slate-400">Space Allocation (Optional)</h4>

                    <div>
                      <label className="block text-xs font-bold mb-1 uppercase text-slate-500 dark:text-slate-400">Select Property</label>
                      {properties.length === 0 ? (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-semibold">
                          ⚠️ No properties registered. Please register a property first.
                        </div>
                      ) : (
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
                          {properties.map((p) => (
                            <option key={p._id} value={p._id}>{p.propertyName}</option>
                          ))}
                        </select>
                      )}
                    </div>

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

                  {billingStatus && billingStatus.unpaidPersons > 0 && (selectedBedId || selectedRoomId) && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-350 font-semibold">
                      ⚠️ Allocation is locked due to {billingStatus.unpaidPersons} unpaid tenant licenses. Please purchase licenses on the Properties tab to assign occupants.
                    </div>
                  )}

                  {registrationMode === 'invite' ? (
                    <button
                      type="submit"
                      disabled={inviteSending}
                      className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50 mt-4 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                    >
                      {inviteSending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending Invitation...
                        </>
                      ) : (
                        <>
                          {inviteMethod === 'email' ? 'Send Invitation Link' : 'Send WhatsApp Invitation'}
                          <Send className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
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

            <h3 className="text-lg font-bold mb-2 pr-10">Check Out Tenant</h3>
            <p className="text-xs text-slate-500 mb-4">
              Check out <span className="font-bold text-slate-800 dark:text-slate-200">{selectedTenantForCheckout.fullName}</span>.
              This will release their bed space and log their exit review.
            </p>

            <form onSubmit={handleCheckoutTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase text-slate-500 text-center">Tenant Rating (1-5 Stars)</label>
                <div className="flex gap-2 justify-center py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setCheckoutRating(star)}
                      className="focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-8 h-8 ${star <= checkoutRating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-slate-700'
                          }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 uppercase text-slate-500">Feedback Comments</label>
                <textarea
                  value={checkoutFeedback}
                  onChange={(e) => setCheckoutFeedback(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-24"
                  placeholder="e.g. Paid rent consistently on time, kept the space very clean and quiet."
                  required
                />
              </div>

              <button
                type="submit"
                disabled={checkoutSubmitting}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold shadow-md shadow-primary/20 disabled:opacity-50"
              >
                {checkoutSubmitting ? 'Checking Out...' : 'Complete Checkout'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Profile & Document Management Modal */}
      {isProfileModalOpen && selectedTenantForProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              {tenantDocs.photoDocData ? (
                <img
                  src={tenantDocs.photoDocData}
                  alt="Tenant Avatar"
                  className="w-14 h-14 rounded-full object-cover border-2 border-primary shadow-sm"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl uppercase">
                  {selectedTenantForProfile.fullName.substring(0, 2)}
                </div>
              )}
              <div className="pr-10 min-w-0">
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
                  Tenant Profile & Verification Dossier
                </h3>
                <p className="text-xs text-slate-400 truncate">
                  Update personal files, review risk index, and upload credential copies.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Personal info & billing history */}
              <div className="space-y-6">
                <form onSubmit={handleUpdateTenantProfile} className="space-y-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">Personal Particulars</h4>

                  <div>
                    <label className="block text-[10px] font-bold mb-1 uppercase text-slate-500">Occupant Name</label>
                    <input
                      type="text"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold mb-1 uppercase text-slate-500">Phone</label>
                      <input
                        type="number"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-900 text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1 uppercase text-slate-500">Emergency Phone</label>
                      <input
                        type="number"
                        value={editEmergencyContact}
                        onChange={(e) => setEditEmergencyContact(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold mb-1 uppercase text-slate-500">Occupation</label>
                      <input
                        type="text"
                        value={editOccupation}
                        onChange={(e) => setEditOccupation(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1 uppercase text-slate-500">Aadhaar (Read-Only)</label>
                      <input
                        type="text"
                        value={selectedTenantForProfile.aadhaarNumber}
                        disabled
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-950/40 text-slate-400 text-sm animate-pulse-subtle"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-1 uppercase text-slate-500">Permanent Address</label>
                    <textarea
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-900 text-slate-900 dark:text-white h-20"
                      required
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={editSubmitting}
                      className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition-all"
                    >
                      {editSubmitting ? 'Updating...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </form>

                {/* Billing & Invoice History */}
                <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">Billing & Invoices History</h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {payments.filter((p) => p.tenant?._id === selectedTenantForProfile._id).length > 0 ? (
                      payments
                        .filter((p) => p.tenant?._id === selectedTenantForProfile._id)
                        .map((payment) => (
                          <div key={payment._id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-850 text-xs">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                Invoice: {new Date(payment.dueDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                              </span>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${payment.status === 'paid'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                                }`}>
                                {payment.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-550 dark:text-slate-400 whitespace-pre-line bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800/60 mb-1.5">
                              {payment.notes || `Monthly Rent Invoice\nBase Rent: ₹${payment.amount}`}
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-400">
                              <span>Due: {new Date(payment.dueDate).toLocaleDateString()}</span>
                              <span className="font-bold text-slate-900 dark:text-white text-xs">Total: ₹{payment.amount.toLocaleString()}</span>
                            </div>
                          </div>
                        ))
                    ) : (
                      <p className="text-xs italic text-slate-400">No invoices generated yet.</p>
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column: Upload files & verifications */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">Verification Info</h4>
                  <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Aadhaar Status</span>
                      <p className="font-extrabold text-sm mt-0.5 text-slate-850 dark:text-slate-100 capitalize">
                        {selectedTenantForProfile.verificationStatus}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${selectedTenantForProfile.riskLevel === 'low'
                      ? 'border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950'
                      : selectedTenantForProfile.riskLevel === 'medium'
                        ? 'border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950'
                        : 'border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-950'
                      }`}>
                      {selectedTenantForProfile.riskLevel} Risk
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">Dossier File Uploads</h4>
                  <div className="space-y-3">
                    {/* 1. Aadhaar Card Upload */}
                    <div className="p-3 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-850 dark:text-white truncate">Aadhaar Card Copy</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {tenantDocs.aadhaarDocName || 'No document uploaded'}
                          </p>
                        </div>
                      </div>

                      {tenantDocs.aadhaarDocData ? (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const newWindow = window.open();
                              if (newWindow) newWindow.document.write(`<iframe src="${tenantDocs.aadhaarDocData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDocument('aadhaar')}
                            className="p-1.5 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                            title="Remove"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer px-3 py-1.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-bold text-slate-700 dark:text-slate-350 flex items-center gap-1 flex-shrink-0">
                          <Upload className="w-3.5 h-3.5" />
                          Upload
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => handleDocumentUpload(e, 'aadhaar')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* 2. Rent Agreement Lease Upload */}
                    <div className="p-3 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="w-5 h-5 text-accent flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-850 dark:text-white truncate">Lease Agreement signed copy</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {tenantDocs.agreementDocName || 'No document uploaded'}
                          </p>
                        </div>
                      </div>

                      {tenantDocs.agreementDocData ? (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const newWindow = window.open();
                              if (newWindow) newWindow.document.write(`<iframe src="${tenantDocs.agreementDocData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-650 rounded-lg hover:bg-slate-100"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDocument('agreement')}
                            className="p-1.5 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                            title="Remove"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer px-3 py-1.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-bold text-slate-700 dark:text-slate-350 flex items-center gap-1 flex-shrink-0">
                          <Upload className="w-3.5 h-3.5" />
                          Upload
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => handleDocumentUpload(e, 'agreement')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* 3. Profile Pic Upload */}
                    <div className="p-3 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <User className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-850 dark:text-white truncate">Profile Photo</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {tenantDocs.photoDocName || 'No photo uploaded'}
                          </p>
                        </div>
                      </div>

                      {tenantDocs.photoDocData ? (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const newWindow = window.open();
                              if (newWindow) newWindow.document.write(`<img src="${tenantDocs.photoDocData}" style="max-width:100%; max-height:100%; display:block; margin:auto;" />`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-650 rounded-lg hover:bg-slate-100"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDocument('photo')}
                            className="p-1.5 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                            title="Remove"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer px-3 py-1.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-bold text-slate-700 dark:text-slate-350 flex items-center gap-1 flex-shrink-0">
                          <Upload className="w-3.5 h-3.5" />
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleDocumentUpload(e, 'photo')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Additional Charges and Fines Section */}
                <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">Additional Charges (Fines & Bills)</h4>

                  {/* Current Charges List */}
                  <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                    {selectedTenantForProfile.additionalCharges && selectedTenantForProfile.additionalCharges.length > 0 ? (
                      selectedTenantForProfile.additionalCharges.map((charge) => (
                        <div key={charge._id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-850 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-slate-850 dark:text-slate-200">{charge.description}</span>
                            <span className="text-[10px] text-slate-400 block">Added on {charge.createdAt ? new Date(charge.createdAt).toLocaleDateString() : 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">₹{charge.amount}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCharge(charge._id)}
                              className="p-1 text-rose-500 hover:text-rose-650 hover:bg-rose-50 rounded-md transition-colors"
                              title="Delete charge"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <></>
                    )}
                  </div>
                  {/* Add Charge Inline Form */}
                  <form onSubmit={handleAddCharge} className="flex flex-col sm:flex-row gap-2 mb-5">
                    <input
                      type="text"
                      value={newChargeDesc}
                      onChange={(e) => setNewChargeDesc(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none w-full"
                      placeholder="e.g. Broken window repair"
                      required
                    />
                    <input
                      type="number"
                      value={newChargeAmount}
                      onChange={(e) => setNewChargeAmount(e.target.value)}
                      className="w-full sm:w-24 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none"
                      placeholder="Amount"
                      min={1}
                      required
                    />
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 shrink-0 transition-transform active:scale-[0.98] flex items-center justify-center"
                    >
                      Add Charge
                    </button>
                  </form>

                  {/* Manual Bill Dispatch Button */}
                  <button
                    type="button"
                    onClick={() => setIsAlertPopupOpen(true)}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-750 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-transform"
                  >
                    <Send className="w-4 h-4" />
                    Send Billing Alert / Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Billing Alert Popup Modal ── */}
      {isAlertPopupOpen && selectedTenantForProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-6 relative animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
            <button 
              onClick={() => setIsAlertPopupOpen(false)} 
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-extrabold mb-2 flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Dispatch Billing Alert
            </h3>
            <p className="text-xs text-slate-555 dark:text-slate-450 mb-5">
              Choose the delivery channel to send the invoice and outstanding dues statement to <span className="font-bold text-slate-800 dark:text-slate-200">{selectedTenantForProfile.fullName}</span>.
            </p>

            <div className="space-y-3">
              {/* Option 1: Email Alert */}
              <button
                type="button"
                onClick={async () => {
                  setIsAlertPopupOpen(false);
                  await handleSendMonthlyBill();
                }}
                disabled={isBillingSending}
                className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                {isBillingSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating & Emailing...
                  </>
                ) : (
                  <>
                    <Mail className="w-4.5 h-4.5 text-primary" />
                    Send via Email Alert (PDF Invoice)
                  </>
                )}
              </button>

              {/* Option 2: WhatsApp Alert */}
              <button
                type="button"
                onClick={handleSendWhatsAppAlert}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10"
              >
                <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 0 0 1.333 4.993L2 22l5.233-1.371a9.918 9.918 0 0 0 4.777 1.222h.005c5.505 0 9.99-4.478 9.99-9.985C22 6.478 17.517 2 12.012 2zm5.922 14.195c-.247.697-1.42 1.37-1.954 1.458-.485.08-1.12.138-3.224-.734-2.69-1.115-4.425-3.86-4.56-4.037-.137-.18-1.077-1.433-1.077-2.735 0-1.3.682-1.938.925-2.203.243-.264.53-.33.707-.33h.505c.16 0 .376-.06.59.353.22.424.75 1.834.816 1.97.067.135.11.293.022.473-.09.18-.135.293-.266.446-.13.153-.275.342-.392.459-.13.13-.267.272-.115.534.152.26.674 1.116 1.442 1.802.99.883 1.82 1.157 2.08 1.287.26.13.41.11.564-.06.155-.176.663-.77.84-.1.353.13.707.397.77.618s.77 1.768.99 2.298c.222.53.222.98.099 1.22z"/>
                </svg>
                Send via WhatsApp Message
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <button 
                type="button" 
                onClick={() => setIsAlertPopupOpen(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
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
                Remove Tenant
              </h3>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteTenantId('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex-1">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Are you sure you want to remove this tenant? This will also vacate their assigned bed space.
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteTenantId('');
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTenant}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl shadow-md shadow-rose-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    'Remove'
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
