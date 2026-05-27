'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import {
  Building, Plus, Trash2, MapPin, Loader2, X, AlertTriangle,
  ChevronDown, ChevronRight, Pencil, Check, BedDouble, IndianRupee,
  Upload, Download, User, Star, FileText,
  ShieldCheck, Search, Mail, Send, Calendar, ArrowLeft, Users
} from 'lucide-react';
import { Property, Room } from '../../../../types';

interface BillingStatus {
  totalTenants: number;
  paidPersons: number;
  unpaidPersons: number;
  amountDue: number;
  isSimulated: boolean;
}

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PropertiesPage() {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const [properties, setProperties] = useState<Property[]>([]);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const [loadingRoomsFor, setLoadingRoomsFor] = useState<string | null>(null);

  // Multi-step navigation views: 'properties' | 'rooms' | 'linked-users'
  const [currentView, setCurrentView] = useState<'properties' | 'rooms' | 'linked-users'>('properties');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);

  // Search query states
  const [propertySearchQuery, setPropertySearchQuery] = useState('');
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [linkedUserSearchQuery, setLinkedUserSearchQuery] = useState('');

  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Assign Tenant modal states
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningContext, setAssigningContext] = useState<{
    propertyId: string;
    propertyName: string;
    roomId: string;
    roomNumber: string;
    bedId: string;
    bedNumber: string;
  } | null>(null);
  const [unassignedTenants, setUnassignedTenants] = useState<any[]>([]);
  const [selectedTenantToAssign, setSelectedTenantToAssign] = useState('');
  const [assignMode, setAssignMode] = useState<'existing' | 'new'>('existing');
  
  const [canAssignDetails, setCanAssignDetails] = useState<{
    canAssign: boolean;
    currentLinked: number;
    paidLimit: number;
    amountDue: number;
  } | null>(null);
  const [isLicensingModalOpen, setIsLicensingModalOpen] = useState(false);

  // Unassign Tenant modal states
  const [isUnassignModalOpen, setIsUnassignModalOpen] = useState(false);
  const [tenantToUnassign, setTenantToUnassign] = useState<any>(null);

  // Delete warning popup modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'property' | 'room' | 'agreement' | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string>('');
  const [deleteItemExtraId, setDeleteItemExtraId] = useState<string>('');
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState('');
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // New tenant wizard states inside properties page
  const [assignAadhaar, setAssignAadhaar] = useState('');
  const [assignAadhaarVerifying, setAssignAadhaarVerifying] = useState(false);
  const [assignVerificationResult, setAssignVerificationResult] = useState<any>(null);
  const [assignRegMode, setAssignRegMode] = useState<'manual' | 'invite'>('manual');
  const [assignFullName, setAssignFullName] = useState('');
  const [assignEmail, setAssignEmail] = useState('');
  const [assignPhone, setAssignPhone] = useState('');
  const [assignEmergency, setAssignEmergency] = useState('');
  const [assignOccupation, setAssignOccupation] = useState('');
  const [assignAddress, setAssignAddress] = useState('');
  const [assignJoiningDate, setAssignJoiningDate] = useState(getTodayDateString());
  const [assignInviteEmail, setAssignInviteEmail] = useState('');
  const [assignInviteUrl, setAssignInviteUrl] = useState('');
  const [assignInviteSending, setAssignInviteSending] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const fetchUnassignedTenants = async () => {
    try {
      const res = await api.get('/tenants');
      const allTenants = res.data;
      const unassigned = allTenants.filter((t: any) => !t.assignedProperty && !t.assignedRoom && !t.assignedBed);
      setUnassignedTenants(unassigned);
    } catch (err) {
      console.error('Failed to fetch unassigned tenants', err);
    }
  };

  const handleAssignExistingTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantToAssign || !assigningContext) return;

    setSubmitting(true);
    try {
      await api.put(`/tenants/${selectedTenantToAssign}`, {
        assignedProperty: assigningContext.propertyId,
        assignedRoom: assigningContext.roomId,
        assignedBed: assigningContext.bedId
      });
      showToast('Tenant assigned successfully!', 'success');
      setIsAssignModalOpen(false);
      resetAssignForm();
      fetchProperties();
      if (selectedProperty) {
        fetchRoomsForProperty(selectedProperty._id);
      }
      fetchBillingStatus();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to assign tenant', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignVerifyAadhaar = async () => {
    if (!assignAadhaar || assignAadhaar.length !== 12 || !/^\d+$/.test(assignAadhaar)) {
      showToast('Aadhaar number must be exactly 12 digits', 'error');
      return;
    }

    setAssignAadhaarVerifying(true);
    try {
      const res = await api.post('/verification/verify', { aadhaarNumber: assignAadhaar });

      if (res.data.connectionStatus === 'active') {
        showToast('Tenant is already active in your registry', 'error');
        setAssignVerificationResult(null);
        return;
      }

      if (res.data.connectionStatus === 'inactive') {
        if (confirm('This user already exists in the system (inactive connection). Would you like to reactivate this connection?')) {
          try {
            await api.post('/tenants/connections/activate', { aadhaarNumber: assignAadhaar });
            showToast('Tenant connection reactivated successfully!', 'success');
            setIsAssignModalOpen(false);
            resetAssignForm();
            fetchProperties();
            if (selectedProperty) {
              fetchRoomsForProperty(selectedProperty._id);
            }
            fetchBillingStatus();
          } catch (activateErr: any) {
            showToast(activateErr.response?.data?.message || 'Failed to activate connection', 'error');
          }
        }
        setAssignVerificationResult(null);
        return;
      }

      setAssignVerificationResult(res.data);

      const { prefill } = res.data;
      setAssignFullName(prefill.fullName || '');
      setAssignEmail(prefill.email || '');
      setAssignPhone(prefill.phone || '');
      setAssignEmergency(prefill.emergencyContact || '');
      setAssignOccupation(prefill.occupation || '');
      setAssignAddress(prefill.address || '');
      setAssignInviteEmail(prefill.email || '');

      if (res.data.isNewTenant) {
        setAssignRegMode('invite');
      } else {
        setAssignRegMode('manual');
      }

      showToast('Aadhaar verification report retrieved successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to retrieve Aadhaar verification report', 'error');
    } finally {
      setAssignAadhaarVerifying(false);
    }
  };

  const handleRegisterNewTenantInAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignFullName || !assignAadhaar || !assignPhone || !assigningContext) {
      showToast('Name, Aadhaar, and phone are required', 'error');
      return;
    }

    setAssignSubmitting(true);
    try {
      await api.post('/tenants', {
        fullName: assignFullName,
        aadhaarNumber: assignAadhaar,
        email: assignEmail || null,
        phone: assignPhone,
        emergencyContact: assignEmergency,
        occupation: assignOccupation,
        address: assignAddress,
        assignedProperty: assigningContext.propertyId,
        assignedRoom: assigningContext.roomId,
        assignedBed: assigningContext.bedId,
        joiningDate: assignJoiningDate || null
      });

      showToast('Tenant registered and allocated successfully!', 'success');
      setIsAssignModalOpen(false);
      resetAssignForm();
      fetchProperties();
      if (selectedProperty) {
        fetchRoomsForProperty(selectedProperty._id);
      }
      fetchBillingStatus();
    } catch (err: any) {
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const details = err.response.data.errors.map((e: any) => `${e.field.replace('body.', '')}: ${e.message}`).join(', ');
        showToast(`Validation failed: ${details}`, 'error');
      } else {
        showToast(err.response?.data?.message || 'Failed to register tenant', 'error');
      }
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleSendInviteInAssign = async () => {
    if (!assignAadhaar || !assigningContext) return;
    const resolvedEmail = (assignInviteEmail || assignEmail).trim();
    if (!resolvedEmail) {
      showToast('Tenant email is required to send the invitation', 'error');
      return;
    }

    setAssignInviteSending(true);
    try {
      const res = await api.post('/tenants/invites', {
        aadhaarNumber: assignAadhaar,
        email: resolvedEmail,
        assignedProperty: assigningContext.propertyId,
        assignedRoom: assigningContext.roomId,
        assignedBed: assigningContext.bedId,
        joiningDate: assignJoiningDate || null
      });

      setAssignInviteUrl(res.data.invite.inviteUrl);
      showToast('Invitation link sent successfully', 'success');
    } catch (err: any) {
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const details = err.response.data.errors.map((e: any) => `${e.field.replace('body.', '')}: ${e.message}`).join(', ');
        showToast(`Validation failed: ${details}`, 'error');
      } else {
        showToast(err.response?.data?.message || 'Failed to send invitation link', 'error');
      }
    } finally {
      setAssignInviteSending(false);
    }
  };

  const resetAssignForm = () => {
    setAssignAadhaar('');
    setAssignVerificationResult(null);
    setAssignRegMode('manual');
    setAssignFullName('');
    setAssignEmail('');
    setAssignPhone('');
    setAssignEmergency('');
    setAssignOccupation('');
    setAssignAddress('');
    setAssignJoiningDate(getTodayDateString());
    setAssignInviteEmail('');
    setAssignInviteUrl('');
    setAssignMode('existing');
    setSelectedTenantToAssign('');
  };
  const [submitting, setSubmitting] = useState(false);

  const handleStartAssignFlow = async (context: any) => {
    try {
      showToast('Checking licensing status...', 'info');
      const res = await api.get('/payments/licensing/can-assign');
      const data = res.data;
      setCanAssignDetails(data);
      
      if (!data.canAssign) {
        setAssigningContext(context);
        setIsLicensingModalOpen(true);
      } else {
        setAssigningContext(context);
        setSelectedTenantToAssign('');
        setAssignMode('existing');
        await fetchUnassignedTenants();
        setIsAssignModalOpen(true);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to verify licensing status', 'error');
    }
  };

  // Add Property form
  const [propertyName, setPropertyName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [totalRooms, setTotalRooms] = useState(0);
  const [propertyRoomType, setPropertyRoomType] = useState<'flat' | 'pg'>('pg');

  // Add Room form
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [roomNumber, setRoomNumber] = useState('');
  const [bedCapacity, setBedCapacity] = useState(1);
  const [monthlyRent, setMonthlyRent] = useState(8000);
  const [roomType, setRoomType] = useState<'flat' | 'pg'>('pg');

  // Room management — expandable row equivalent
  const [propertyRooms, setPropertyRooms] = useState<Record<string, Room[]>>({});

  // Inline edit state per room
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRent, setEditRent] = useState<number>(0);
  const [editBedCapacity, setEditBedCapacity] = useState<number>(1);
  const [savingRoomId, setSavingRoomId] = useState<string | null>(null);

  // Inline edit state per tenant rent
  const [editingRentTenantId, setEditingRentTenantId] = useState<string | null>(null);
  const [editRentAmount, setEditRentAmount] = useState<number>(0);
  const [savingRentTenantId, setSavingRentTenantId] = useState<string | null>(null);

  // Dossier Drawer state
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<'aadhaar' | 'agreement' | 'photo' | null>(null);

  const fetchProperties = async () => {
    try {
      const res = await api.get('/properties');
      setProperties(res.data);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to fetch properties', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBillingStatus = async () => {
    try {
      const res = await api.get('/payments/bed-billing/status');
      setBillingStatus(res.data);
    } catch (err: any) {
      console.error('Failed to fetch billing status', err);
    }
  };

  const fetchPayments = async () => {
    try {
      setLoadingPayments(true);
      const res = await api.get('/payments');
      setAllPayments(res.data || []);
    } catch (err) {
      console.error('Failed to fetch payments', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    fetchProperties();
    fetchBillingStatus();
    fetchPayments();
  }, []);

  useEffect(() => {
    if (isDossierOpen) {
      fetchPayments();
    }
  }, [isDossierOpen]);

  const fetchRoomsForProperty = async (propId: string) => {
    setLoadingRoomsFor(propId);
    try {
      const res = await api.get(`/properties/${propId}`);
      const rooms = res.data.rooms || [];
      const beds = res.data.beds || [];

      const roomsWithBeds = rooms.map((room: any) => ({
        ...room,
        beds: beds.filter((b: any) => b.room === room._id)
      }));

      setPropertyRooms((prev) => ({ ...prev, [propId]: roomsWithBeds }));

      // Keep the active room details refreshed in case of allocation updates
      if (selectedRoom) {
        const updatedRoom = roomsWithBeds.find((r: any) => r._id === selectedRoom._id);
        if (updatedRoom) {
          setSelectedRoom(updatedRoom);
        }
      }
    } catch (err: any) {
      showToast('Failed to load rooms', 'error');
    } finally {
      setLoadingRoomsFor(null);
    }
  };

  const handleViewRooms = (prop: Property) => {
    setSelectedProperty(prop);
    setCurrentView('rooms');
    if (!propertyRooms[prop._id]) {
      fetchRoomsForProperty(prop._id);
    }
  };

  const handleViewLinkedUsers = (room: any) => {
    setSelectedRoom(room);
    setCurrentView('linked-users');
  };

  const getTenantPaymentStatus = (tenantId: string) => {
    const unpaid = allPayments.filter(p => p.tenant?._id === tenantId && p.status === 'unpaid');
    return unpaid.length > 0 ? 'Pending' : 'Cleared';
  };

  const handleToggleExpand = (propId: string) => {
    if (expandedPropertyId === propId) {
      setExpandedPropertyId(null);
    } else {
      setExpandedPropertyId(propId);
      if (!propertyRooms[propId]) {
        fetchRoomsForProperty(propId);
      }
    }
    setEditingRoomId(null);
  };

  const handleStartEditRoom = (room: any) => {
    setEditingRoomId(room._id);
    setEditRent(room.monthlyRent);
    setEditBedCapacity(room.bedCapacity);
  };

  const handleSaveRoom = async (roomId: string, propId: string) => {
    setSavingRoomId(roomId);
    try {
      await api.put(`/properties/rooms/${roomId}`, {
        monthlyRent: editRent,
        bedCapacity: editBedCapacity,
      });
      showToast('Room updated successfully!', 'success');
      setEditingRoomId(null);
      fetchRoomsForProperty(propId);
      fetchBillingStatus();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update room', 'error');
    } finally {
      setSavingRoomId(null);
    }
  };

  const handleSaveTenantRent = async (tenantId: string) => {
    setSavingRentTenantId(tenantId);
    try {
      await api.put(`/tenants/${tenantId}`, { rentAmount: editRentAmount });
      showToast('Tenant rent adjusted successfully!', 'success');
      setEditingRentTenantId(null);
      fetchProperties();
      if (selectedProperty) {
        await fetchRoomsForProperty(selectedProperty._id);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to adjust rent', 'error');
    } finally {
      setSavingRentTenantId(null);
    }
  };

  const triggerDeleteProperty = (id: string) => {
    setDeleteType('property');
    setDeleteItemId(id);
    setDeleteConfirmTitle('Delete Property');
    setDeleteConfirmMessage('Are you sure you want to delete this property and all associated rooms/beds? This action is permanent and cannot be undone.');
    setIsDeleteModalOpen(true);
  };

  const triggerDeleteRoom = (roomId: string, propId: string) => {
    setDeleteType('room');
    setDeleteItemId(roomId);
    setDeleteItemExtraId(propId);
    setDeleteConfirmTitle('Delete Room');
    setDeleteConfirmMessage('Are you sure you want to delete this room and all its beds? This action is permanent and cannot be undone.');
    setIsDeleteModalOpen(true);
  };

  const triggerRemoveAgreement = (roomId: string) => {
    setDeleteType('agreement');
    setDeleteItemId(roomId);
    setDeleteConfirmTitle('Remove Lease Agreement');
    setDeleteConfirmMessage('Are you sure you want to remove this shared lease agreement from the flat?');
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteType || !deleteItemId) return;
    setIsDeleting(true);
    try {
      if (deleteType === 'property') {
        await api.delete(`/properties/${deleteItemId}`);
        showToast('Property deleted successfully', 'success');
        fetchProperties();
        fetchBillingStatus();
        if (selectedProperty && selectedProperty._id === deleteItemId) {
          setCurrentView('properties');
          setSelectedProperty(null);
        }
      } else if (deleteType === 'room') {
        await api.delete(`/properties/rooms/${deleteItemId}`);
        showToast('Room deleted', 'success');
        fetchRoomsForProperty(deleteItemExtraId);
        fetchBillingStatus();
        fetchProperties();
      } else if (deleteType === 'agreement') {
        await api.put(`/properties/rooms/${deleteItemId}`, {
          agreementDocName: '',
          agreementDocData: ''
        });
        showToast('Lease agreement removed from flat', 'info');
        setSelectedRoom((prev: any) => ({
          ...prev,
          agreementDocName: '',
          agreementDocData: ''
        }));
        fetchRoomsForProperty(selectedProperty?._id || '');
      }
      setIsDeleteModalOpen(false);
      setDeleteType(null);
      setDeleteItemId('');
      setDeleteItemExtraId('');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to perform delete action', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteRoom = async (roomId: string, propId: string) => {
    try {
      await api.delete(`/properties/rooms/${roomId}`);
      showToast('Room deleted', 'success');
      fetchRoomsForProperty(propId);
      fetchBillingStatus();
      fetchProperties();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete room', 'error');
    }
  };

  const handleUnassignTenant = async () => {
    if (!tenantToUnassign) return;
    setSubmitting(true);
    try {
      await api.put(`/tenants/${tenantToUnassign._id}`, {
        assignedProperty: null,
        assignedRoom: null,
        assignedBed: null
      });
      showToast('Tenant unassigned successfully', 'success');
      setIsUnassignModalOpen(false);
      fetchProperties();
      if (selectedProperty) {
        const event = new Event('refresh');
        setTimeout(() => fetchRoomsForProperty(selectedProperty._id), 200);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to unassign tenant', 'error');
    } finally {
      setSubmitting(false);
      setTenantToUnassign(null);
    }
  };

  const handlePayment = async () => {
    if (!billingStatus || billingStatus.amountDue <= 0) return;
    setIsPaying(true);
    try {
      const orderRes = await api.post('/payments/bed-billing/order');
      const { orderId, amount, currency, isSimulated, keyId } = orderRes.data;

      if (isSimulated) {
        showToast('Sandbox mode detected. Simulating payment...', 'info');
        await api.post('/payments/bed-billing/verify', { razorpay_order_id: orderId, isMock: true });
        showToast('Payment simulated successfully! Licenses activated.', 'success');
        fetchBillingStatus(); fetchProperties();
      } else {
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) { showToast('Failed to load Razorpay SDK.', 'error'); setIsPaying(false); return; }
        const options = {
          key: keyId, amount, currency,
          name: 'PropManager Tenant Licensing',
          description: `Licensing for ${billingStatus.unpaidPersons} tenants`,
          order_id: orderId,
          handler: async (response: any) => {
            try {
              await api.post('/payments/bed-billing/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                isMock: false
              });
              showToast('Payment verified! Tenant licenses active.', 'success');
              fetchBillingStatus(); fetchProperties();
            } catch (err: any) {
              showToast(err.response?.data?.message || 'Payment verification failed', 'error');
            }
          },
          prefill: { name: '', email: '', contact: '' },
          theme: { color: '#2563EB' }
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to initiate payment', 'error');
    } finally {
      setIsPaying(false);
    }
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyName || !address) { showToast('Name and address are required', 'error'); return; }
    setSubmitting(true);
    try {
      await api.post('/properties', {
        propertyName,
        address,
        description,
        totalRooms,
        roomType: propertyRoomType
      });
      showToast('Property created successfully!', 'success');
      setIsAddModalOpen(false);
      setPropertyName(''); setAddress(''); setDescription(''); setTotalRooms(0); setPropertyRoomType('pg');
      fetchProperties(); fetchBillingStatus();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create property', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId || !roomNumber) { showToast('Room number is required', 'error'); return; }
    setSubmitting(true);
    try {
      await api.post(`/properties/${selectedPropertyId}/rooms`, {
        roomNumber,
        bedCapacity,
        monthlyRent,
        roomType
      });
      showToast('Room added successfully!', 'success');
      setIsAddRoomModalOpen(false);
      setRoomNumber(''); setBedCapacity(1); setMonthlyRent(8000); setRoomType('pg');
      fetchProperties(); fetchBillingStatus();
      if (selectedProperty?._id === selectedPropertyId) {
        fetchRoomsForProperty(selectedPropertyId);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to add room', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProperty = async (id: string) => {
    try {
      await api.delete(`/properties/${id}`);
      showToast('Property deleted successfully', 'success');
      fetchProperties(); fetchBillingStatus();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete property', 'error');
    }
  };

  const renderDocItem = (title: string, docType: 'aadhaar' | 'agreement' | 'photo', tenant: any) => {
    const isFlatAgreement = docType === 'agreement' && selectedRoom?.roomType === 'flat';

    const docName = isFlatAgreement
      ? (selectedRoom.agreementDocName || '')
      : (tenant.documents?.[`${docType}DocName`] || '');

    const docData = isFlatAgreement
      ? (selectedRoom.agreementDocData || '')
      : (tenant.documents?.[`${docType}DocData`] || '');

    const isUploading = uploadingDoc === docType;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadingDoc(docType);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const payload = {
            [`${docType}DocName`]: file.name,
            [`${docType}DocData`]: base64Data
          };
          const res = await api.post(`/tenants/${tenant._id}/documents`, payload);
          showToast(`${title} uploaded successfully!`, 'success');
          setSelectedTenant((prev: any) => ({
            ...prev,
            documents: res.data.documents
          }));
          fetchProperties();
          if (selectedProperty) {
            fetchRoomsForProperty(selectedProperty._id);
          }
        } catch (err: any) {
          showToast(err.response?.data?.message || `Failed to upload ${title}`, 'error');
        } finally {
          setUploadingDoc(null);
        }
      };
      reader.readAsDataURL(file);
    };

    return (
      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-150 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 text-xs">
        <div className="flex items-center gap-2 max-w-[60%]">
          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="truncate">
            <span className="font-bold text-slate-850 dark:text-slate-200 block">{title}</span>
            <span className="text-[10px] text-slate-400 truncate block">
              {docName || (isFlatAgreement ? 'No shared agreement uploaded' : 'No document uploaded')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {docData ? (
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = docData;
                link.download = docName || `${docType}-doc`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 transition-all"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          ) : null}
          {isFlatAgreement ? (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
              Flat Shared Doc
            </span>
          ) : (
            <label className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 cursor-pointer transition-all flex items-center">
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <input type="file" onChange={handleFileChange} disabled={isUploading} className="hidden" />
            </label>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. PROPERTIES VIEW */}
      {currentView === 'properties' && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">My Properties</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Manage real estate listings, rooms, and rent amounts.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-450" />
                <input
                  type="text"
                  placeholder="Search properties..."
                  value={propertySearchQuery}
                  onChange={(e) => setPropertySearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md shadow-primary/20 transition-all hover:scale-105 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add Property
              </button>
            </div>
          </div>

          {/* Tenant Licensing Banner */}
          {billingStatus && (
            <div className="p-6 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <span className="p-1 rounded bg-primary/20 text-primary">💳</span> Tenant Licensing & Portal Access
                </h3>
                <p className="text-xs text-slate-400">
                  Licensing fee: <span className="text-white font-extrabold font-sans">₹20/person</span> (First 2 free). Paid for{' '}
                  <span className="text-emerald-400 font-extrabold font-sans">{billingStatus.paidPersons} tenants</span> of{' '}
                  <span className="text-slate-200 font-extrabold font-sans">{billingStatus.totalTenants} total tenants</span>.
                </p>
                {billingStatus.unpaidPersons > 0 ? (
                  <p className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    {billingStatus.unpaidPersons} unpaid tenants. Tenant profile views, room assignments, and document uploads locked until payment.
                  </p>
                ) : (
                  <p className="text-xs text-emerald-400 font-semibold">✓ All tenant licenses active and verified.</p>
                )}
              </div>
              {billingStatus.unpaidPersons > 0 && (
                <button
                  onClick={handlePayment}
                  disabled={isPaying}
                  className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-extrabold shadow-lg shadow-primary/20 transition-all hover:scale-105 disabled:opacity-50 flex items-center gap-2"
                >
                  {isPaying ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Processing...</> : <>Pay ₹{billingStatus.amountDue} Now</>}
                </button>
              )}
            </div>
          )}

          {/* Properties Table */}
          {properties.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Building className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Properties Registered</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Get started by creating your first property listing.</p>
              <button onClick={() => setIsAddModalOpen(true)} className="mt-6 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-md shadow-primary/25">
                Create Property
              </button>
            </div>
          ) : (() => {
            const filteredProperties = properties.filter((prop) =>
              prop.propertyName.toLowerCase().includes(propertySearchQuery.toLowerCase())
            );

            if (filteredProperties.length === 0) {
              return (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <Search className="w-10 h-10 mx-auto text-slate-400 mb-3 animate-pulse" />
                  <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No matching properties</h3>
                  <p className="text-xs text-slate-500 mt-1">No property names match "{propertySearchQuery}". Try adjusting your keywords.</p>
                </div>
              );
            }

            return (
              <>
                {/* Desktop View */}
                <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 font-sans">
                    <table className="w-max min-w-full text-left border-collapse">
                      <thead className="bg-[#F1F5F9] dark:bg-slate-950 font-semibold text-xs text-slate-550 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-3 px-4 w-20">S NO</th>
                          <th className="py-3 px-4">Property Name</th>
                          <th className="py-3 px-4 w-40">Status</th>
                          <th className="py-3 px-4 w-48 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-850">
                        {filteredProperties.map((prop, idx) => {
                          const status = prop.propertyName.toLowerCase().includes('maintenance') ? 'Maintenance' : 'Active';
                          return (
                            <tr
                              key={prop._id}
                              onClick={() => handleViewRooms(prop)}
                              className="hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors group cursor-pointer"
                            >
                              <td className="py-4 px-4 font-mono text-slate-400">{(idx + 1).toString().padStart(2, '0')}</td>
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <Building className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-900 dark:text-white block">{prop.propertyName}</span>
                                    <span className="text-xs text-slate-400 block">{prop.address}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${status === 'Active'
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : 'bg-amber-500/10 text-amber-600'
                                  }`}>
                                  {status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewRooms(prop);
                                    }}
                                    className="group inline-flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
                                  >
                                    View Rooms
                                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerDeleteProperty(prop._id);
                                    }}
                                    className="p-1.5 border border-slate-200 dark:border-slate-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                                    title="Delete Property"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile View */}
                <div className="block md:hidden space-y-4">
                  {filteredProperties.map((prop, idx) => {
                    const status = prop.propertyName.toLowerCase().includes('maintenance') ? 'Maintenance' : 'Active';
                    return (
                      <div
                        key={prop._id}
                        onClick={() => handleViewRooms(prop)}
                        className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 cursor-pointer hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Building className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block">{prop.propertyName}</span>
                              <span className="text-xs text-slate-400 block">{prop.address}</span>
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${status === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-amber-500/10 text-amber-600'
                            }`}>
                            {status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-mono text-slate-400">S.No: {(idx + 1).toString().padStart(2, '0')}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewRooms(prop);
                              }}
                              className="group inline-flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2.5 py-1 rounded-lg transition-all"
                            >
                              View Rooms
                              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerDeleteProperty(prop._id);
                              }}
                              className="p-1.5 border border-slate-200 dark:border-slate-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                              title="Delete Property"
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
            );
          })()}
        </>
      )}

      {/* 2. ROOM LISTINGS VIEW */}
      {currentView === 'rooms' && selectedProperty && (() => {
        const activeRooms = propertyRooms[selectedProperty._id] || [];
        const totalRoomsCount = activeRooms.length;

        let totalBedsCount = 0;
        let occupiedBedsCount = 0;
        let occupiedRoomsCount = 0;
        activeRooms.forEach((r: any) => {
          if (r.beds) {
            totalBedsCount += r.beds.length;
            occupiedBedsCount += r.beds.filter((b: any) => b.isOccupied).length;
          }
          if (r.occupancyStatus === 'fully_occupied' || r.occupancyStatus === 'partially_occupied') {
            occupiedRoomsCount += 1;
          }
        });

        const overallOccupancyPercent = totalRoomsCount > 0 ? Math.round((occupiedRoomsCount / totalRoomsCount) * 100) : 0;
        const availableBedsCount = totalBedsCount - occupiedBedsCount;

        return (
          <>
            {/* Breadcrumbs & Header */}
            <div className="space-y-2">
              <nav className="hidden md:flex items-center text-xs text-slate-400 font-medium">
                <button onClick={() => setCurrentView('properties')} className="hover:text-primary transition-colors flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" />
                  My Properties
                </button>
                <ChevronRight className="w-3 h-3 mx-1 text-slate-300" />
                <span className="text-slate-650 font-semibold">{selectedProperty.propertyName}</span>
                <ChevronRight className="w-3 h-3 mx-1 text-slate-300" />
                <span className="text-slate-850 dark:text-slate-200">Rooms</span>
              </nav>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setCurrentView('properties');
                      setSelectedProperty(null);
                    }}
                    className="
                      group relative
                      w-10 h-10 rounded-full
                      border border-slate-200 dark:border-slate-800
                      flex items-center justify-center
                      overflow-hidden
                      cursor-pointer
                      transition-all duration-300 ease-out
                      hover:scale-105
                      hover:shadow-lg
                    "
                  >
                    {/* Animated Background Fill */}
                    <span
                      className="
                        absolute inset-0
                        bg-primary
                        scale-0
                        rounded-full
                        transition-transform duration-300 ease-out
                        group-hover:scale-100
                      "
                    ></span>

                    {/* Arrow Icon */}
                    <ArrowLeft
                      className="
                        relative z-10
                        w-5 h-5
                        text-slate-500
                        transition-colors duration-300
                        group-hover:text-white
                      "
                    />
                  </button>
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{selectedProperty.propertyName} - Rooms</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage all room allocations and statuses for this property.</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-455" />
                    <input
                      type="text"
                      placeholder="Search room number or tenant..."
                      value={roomSearchQuery}
                      onChange={(e) => setRoomSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <button
                    onClick={() => { setSelectedPropertyId(selectedProperty._id); setIsAddRoomModalOpen(true); }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Add Room
                  </button>
                </div>
              </div>
            </div>

            {/* Bento Analytics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Rooms</p>
                  <h3 className="text-3xl text-slate-900 dark:text-white font-extrabold font-mono">{totalRoomsCount}</h3>
                  <p className="text-xs text-slate-400 mt-1.5">Registered units</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Building className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Overall Occupancy</p>
                  <h3 className="text-3xl text-slate-900 dark:text-white font-extrabold font-mono">{overallOccupancyPercent}%</h3>
                  <p className="text-xs text-slate-450 mt-1.5">{occupiedRoomsCount} / {totalRoomsCount} Rooms occupied</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Available Beds</p>
                  <h3 className="text-3xl text-slate-900 dark:text-white font-extrabold font-mono">{availableBedsCount}</h3>
                  <p className="text-xs text-slate-400 mt-1.5">Out of {totalBedsCount} total beds</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <BedDouble className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Rooms Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">Room Directory</h3>
                <div className="text-xs text-slate-500">Showing {totalRoomsCount} rooms</div>
              </div>

              {loadingRoomsFor === selectedProperty._id ? (
                <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : activeRooms.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-sm text-slate-400 italic">No rooms registered. Add your first room using the "Add Room" button above.</p>
                </div>
              ) : (() => {
                const filteredRooms = activeRooms.filter((room: any) => {
                  const roomMatches = room.roomNumber.toLowerCase().includes(roomSearchQuery.toLowerCase());
                  const tenantMatches = room.beds?.some((b: any) =>
                    b.isOccupied && b.tenant?.fullName?.toLowerCase().includes(roomSearchQuery.toLowerCase())
                  );
                  return roomMatches || tenantMatches;
                });

                if (filteredRooms.length === 0) {
                  return (
                    <div className="text-center py-20 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                      <Search className="w-10 h-10 mx-auto text-slate-400 mb-3 animate-pulse" />
                      <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No matching rooms</h3>
                      <p className="text-xs text-slate-505 mt-1">No rooms match "{roomSearchQuery}". Try another search term.</p>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Desktop Rooms Table */}
                    <div className="hidden md:block overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                      <table className="w-max min-w-full text-left border-collapse">
                        <thead className="bg-[#F1F5F9] dark:bg-slate-950 font-semibold text-xs text-slate-550 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-3 px-4 w-16">S.No</th>
                            <th className="py-3 px-4">Room Number</th>
                            <th className="py-3 px-4">Occupancy Status</th>
                            <th className="py-3 px-4 text-right">Occupants / Capacity</th>
                            <th className="py-3 px-4 text-center w-64">Action</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-850">
                          {filteredRooms.map((room: any, idx: number) => {
                            const isFlat = room.roomType === 'flat';
                            const isEditing = editingRoomId === room._id;
                            const occupiedBeds = room.beds?.filter((b: any) => b.isOccupied) || [];
                            const totalBeds = room.beds?.length || room.bedCapacity || 1;
                            const hasLinkedUsers = occupiedBeds.length > 0;

                            if (isEditing) {
                              return (
                                <tr key={room._id} className="bg-primary/5 dark:bg-primary/10 border-y border-primary/20">
                                  <td className="py-4 px-4 font-mono text-slate-400">{(idx + 1).toString().padStart(2, '0')}</td>
                                  <td className="py-4 px-4 font-bold text-slate-900 dark:text-white" colSpan={2}>
                                    Editing Room {room.roomNumber}
                                  </td>
                                  <td className="py-4 px-4" colSpan={2}>
                                    <div className="flex items-center gap-3 justify-end">
                                      <div className="w-32">
                                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Monthly Rent</label>
                                        <div className="relative">
                                          <IndianRupee className="absolute left-2 top-2.5 w-3 h-3 text-slate-455" />
                                          <input
                                            type="number"
                                            value={editRent}
                                            onChange={(e) => setEditRent(parseInt(e.target.value) || 0)}
                                            className="w-full pl-6 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary"
                                          />
                                        </div>
                                      </div>
                                      <div className="w-24">
                                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">
                                          {isFlat ? 'Max Occupants' : 'Beds'}
                                        </label>
                                        <input
                                          type="number"
                                          value={editBedCapacity}
                                          onChange={(e) => setEditBedCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                                          className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary"
                                        />
                                      </div>
                                      <div className="flex gap-1.5 mt-4">
                                        <button
                                          onClick={() => handleSaveRoom(room._id, selectedProperty._id)}
                                          disabled={savingRoomId === room._id}
                                          className="p-1.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                        >
                                          {savingRoomId === room._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                        </button>
                                        <button
                                          onClick={() => setEditingRoomId(null)}
                                          className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-550 hover:bg-slate-200 transition-colors"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr key={room._id} className="hover:bg-slate-50 dark:hover:bg-slate-955/40 transition-colors group">
                                <td className="py-4 px-4 font-mono text-slate-400">{(idx + 1).toString().padStart(2, '0')}</td>
                                <td className="py-4 px-4">
                                  <span className="font-bold text-slate-900 dark:text-white block">{room.roomNumber}</span>
                                  <span className="text-[10px] text-slate-450 capitalize">{room.roomType || 'PG'} Room</span>
                                </td>
                                <td className="py-4 px-4">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold ${room.occupancyStatus === 'fully_occupied'
                                    ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200/50'
                                    : room.occupancyStatus === 'partially_occupied'
                                      ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 border border-amber-200/50'
                                      : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-200/50'
                                    }`}>
                                    {room.occupancyStatus.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="py-4 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                                  {occupiedBeds.length}/{totalBeds}
                                </td>
                                <td className="py-4 px-4 text-center" style={{ width: '32%' }}>
                                  <div className="flex flex-wrap items-center justify-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewLinkedUsers(room);
                                      }}
                                      disabled={!hasLinkedUsers}
                                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all ${hasLinkedUsers
                                        ? 'border-primary text-primary hover:bg-primary hover:text-white'
                                        : 'border-slate-205 dark:border-slate-800 text-slate-400 cursor-not-allowed bg-slate-50 dark:bg-slate-950/20'
                                        }`}
                                    >
                                      View Linked Users
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const vacantBeds = room.beds?.filter((b: any) => !b.isOccupied) || [];
                                        if (vacantBeds.length === 0) {
                                          showToast('No vacant beds available in this room.', 'error');
                                          return;
                                        }
                                        const firstVacantBed = vacantBeds[0];
                                        handleStartAssignFlow({
                                          propertyId: selectedProperty._id,
                                          propertyName: selectedProperty.propertyName,
                                          roomId: room._id,
                                          roomNumber: room.roomNumber,
                                          bedId: firstVacantBed._id,
                                          bedNumber: firstVacantBed.bedNumber
                                        });
                                      }}
                                      disabled={room.occupancyStatus === 'fully_occupied'}
                                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all ${room.occupancyStatus !== 'fully_occupied'
                                        ? 'bg-primary border-primary text-white hover:bg-primary-hover shadow-sm shadow-primary/10'
                                        : 'border-slate-205 dark:border-slate-800 text-slate-400 cursor-not-allowed bg-slate-50 dark:bg-slate-950/20'
                                        }`}
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Assign Tenant
                                    </button>
                                    <button
                                      onClick={() => handleStartEditRoom(room)}
                                      className="p-1.5 border border-slate-200 dark:border-slate-800 text-slate-550 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg transition-all"
                                      title="Edit Rent"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => triggerDeleteRoom(room._id, selectedProperty._id)}
                                      className="p-1.5 border border-slate-200 dark:border-slate-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                                      title="Delete Room"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Rooms Cards */}
                    <div className="block md:hidden divide-y divide-slate-150 dark:divide-slate-850">
                      {filteredRooms.map((room: any, idx: number) => {
                        const isFlat = room.roomType === 'flat';
                        const isEditing = editingRoomId === room._id;
                        const occupiedBeds = room.beds?.filter((b: any) => b.isOccupied) || [];
                        const totalBeds = room.beds?.length || room.bedCapacity || 1;
                        const hasLinkedUsers = occupiedBeds.length > 0;

                        if (isEditing) {
                          return (
                            <div key={room._id} className="bg-primary/5 dark:bg-primary/10 p-4 space-y-3">
                              <div className="text-sm font-bold text-slate-900 dark:text-white">
                                Editing Room {room.roomNumber}
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Monthly Rent</label>
                                  <div className="relative">
                                    <IndianRupee className="absolute left-2 top-2.5 w-3.5 h-3.5 text-slate-455" />
                                    <input
                                      type="number"
                                      value={editRent}
                                      onChange={(e) => setEditRent(parseInt(e.target.value) || 0)}
                                      className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">
                                    {isFlat ? 'Max Occupants' : 'Beds'}
                                  </label>
                                  <input
                                    type="number"
                                    value={editBedCapacity}
                                    onChange={(e) => setEditBedCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                  />
                                </div>
                                <div className="flex gap-2 justify-end pt-1">
                                  <button
                                    onClick={() => handleSaveRoom(room._id, selectedProperty._id)}
                                    disabled={savingRoomId === room._id}
                                    className="flex items-center justify-center px-3 py-1.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 text-xs font-bold gap-1"
                                  >
                                    {savingRoomId === room._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingRoomId(null)}
                                    className="flex items-center justify-center px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-200 transition-colors text-xs font-bold gap-1"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={room._id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white text-base block">{room.roomNumber}</span>
                                <span className="text-[10px] text-slate-450 capitalize">{room.roomType || 'PG'} Room</span>
                              </div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold ${room.occupancyStatus === 'fully_occupied'
                                ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-250/50'
                                : room.occupancyStatus === 'partially_occupied'
                                  ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 border border-amber-250/50'
                                  : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-250/50'
                                }`}>
                                {room.occupancyStatus.replace('_', ' ')}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Occupants / Capacity:</span>
                              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{occupiedBeds.length}/{totalBeds}</span>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2 justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewLinkedUsers(room);
                                }}
                                disabled={!hasLinkedUsers}
                                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all ${hasLinkedUsers
                                  ? 'border-primary text-primary hover:bg-primary hover:text-white bg-transparent'
                                  : 'border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed bg-slate-50 dark:bg-slate-950/20'
                                  }`}
                              >
                                View Users
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const vacantBeds = room.beds?.filter((b: any) => !b.isOccupied) || [];
                                  if (vacantBeds.length === 0) {
                                    showToast('No vacant beds available in this room.', 'error');
                                    return;
                                  }
                                  const firstVacantBed = vacantBeds[0];
                                  handleStartAssignFlow({
                                    propertyId: selectedProperty._id,
                                    propertyName: selectedProperty.propertyName,
                                    roomId: room._id,
                                    roomNumber: room.roomNumber,
                                    bedId: firstVacantBed._id,
                                    bedNumber: firstVacantBed.bedNumber
                                  });
                                }}
                                disabled={room.occupancyStatus === 'fully_occupied'}
                                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all ${room.occupancyStatus !== 'fully_occupied'
                                  ? 'bg-primary border-primary text-white hover:bg-primary-hover shadow-sm shadow-primary/10'
                                  : 'border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed bg-slate-50 dark:bg-slate-950/20'
                                  }`}
                              >
                                <Plus className="w-3.5 h-3.5" /> Assign
                              </button>
                              <button
                                onClick={() => handleStartEditRoom(room)}
                                className="p-1.5 border border-slate-200 dark:border-slate-800 text-slate-550 hover:bg-slate-55 dark:hover:bg-slate-850 rounded-lg transition-all"
                                title="Edit Rent"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => triggerDeleteRoom(room._id, selectedProperty._id)}
                                className="p-1.5 border border-slate-200 dark:border-slate-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                                title="Delete Room"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        );
      })()}

      {/* 3. LINKED USERS VIEW */}
      {currentView === 'linked-users' && selectedProperty && selectedRoom && (() => {
        const roomBeds = selectedRoom.beds || [];

        const filteredBeds = roomBeds.filter((bed: any) => {
          const query = linkedUserSearchQuery.toLowerCase();
          if (!query) return true;

          const bedName = selectedRoom.roomType === 'flat' ? 'Entire Unit' : bed.bedNumber.split('-').pop() || '';
          const bedMatch = bedName.toLowerCase().includes(query);

          if (bed.isOccupied && bed.tenant) {
            const nameMatch = bed.tenant.fullName.toLowerCase().includes(query);
            const phoneMatch = bed.tenant.phone?.toLowerCase().includes(query);
            const occMatch = bed.tenant.occupation?.toLowerCase().includes(query);
            return nameMatch || phoneMatch || occMatch || bedMatch;
          }

          return bedMatch || 'vacant'.includes(query);
        });

        return (
          <>
            {/* Breadcrumbs & Header */}
            <div className="space-y-2">
              <nav className="hidden md:flex items-center text-xs text-slate-400 font-medium">
                <button onClick={() => setCurrentView('properties')} className="hover:text-primary transition-colors flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" />
                  My Properties
                </button>
                <ChevronRight className="w-3 h-3 mx-1 text-slate-300" />
                <button onClick={() => setCurrentView('rooms')} className="hover:text-primary transition-colors">
                  {selectedProperty.propertyName}
                </button>
                <ChevronRight className="w-3 h-3 mx-1 text-slate-300" />
                <button onClick={() => setCurrentView('rooms')} className="hover:text-primary transition-colors">
                  Rooms
                </button>
                <ChevronRight className="w-3 h-3 mx-1 text-slate-300" />
                <span className="text-slate-650 font-semibold">Room {selectedRoom.roomNumber}</span>
                <ChevronRight className="w-3 h-3 mx-1 text-slate-300" />
                <span className="text-slate-850 dark:text-slate-200">Linked Users</span>
              </nav>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setCurrentView('properties');
                      setSelectedProperty(null);
                    }}
                    className="
                      group relative
                      w-10 h-10 rounded-full
                      border border-slate-200 dark:border-slate-800
                      flex items-center justify-center
                      overflow-hidden
                      cursor-pointer
                      transition-all duration-300 ease-out
                      hover:scale-105
                      hover:shadow-lg
                    "
                  >
                    {/* Animated Background Fill */}
                    <span
                      className="
                        absolute inset-0
                        bg-primary
                        scale-0
                        rounded-full
                        transition-transform duration-300 ease-out
                        group-hover:scale-100
                      "
                    ></span>

                    {/* Arrow Icon */}
                    <ArrowLeft
                      className="
                        relative z-10
                        w-5 h-5
                        text-slate-500
                        transition-colors duration-300
                        group-hover:text-white
                      "
                    />
                  </button>
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Room {selectedRoom.roomNumber} - Occupants</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">View and manage occupants assigned to this unit.</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-455" />
                    <input
                      type="text"
                      placeholder="Search occupant name..."
                      value={linkedUserSearchQuery}
                      onChange={(e) => setLinkedUserSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const vacantBeds = roomBeds.filter((b: any) => !b.isOccupied);
                      if (vacantBeds.length === 0) {
                        showToast('No vacant beds available in this room.', 'error');
                        return;
                      }
                      const firstVacantBed = vacantBeds[0];
                      setAssigningContext({
                        propertyId: selectedProperty._id,
                        propertyName: selectedProperty.propertyName,
                        roomId: selectedRoom._id,
                        roomNumber: selectedRoom.roomNumber,
                        bedId: firstVacantBed._id,
                        bedNumber: firstVacantBed.bedNumber
                      });
                      setSelectedTenantToAssign('');
                      setAssignMode('existing');
                      fetchUnassignedTenants();
                      setIsAssignModalOpen(true);
                    }}
                    disabled={roomBeds.every((b: any) => b.isOccupied)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 shrink-0 disabled:opacity-50 disabled:scale-100"
                  >
                    <Plus className="w-4 h-4" />
                    Assign Tenant
                  </button>
                </div>
              </div>
            </div>

            {/* Flat Lease Agreement Card */}
            {selectedRoom.roomType === 'flat' && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 w-full md:w-auto">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Flat Lease Agreement (Shared)
                    </h4>
                    <p className="text-xs text-slate-550 dark:text-slate-400 mt-0.5">
                      {selectedRoom.agreementDocName ? (
                        <>Active: <span className="font-semibold text-slate-700 dark:text-slate-350 break-all">{selectedRoom.agreementDocName}</span></>
                      ) : (
                        'No lease agreement uploaded for this flat.'
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
                  {selectedRoom.agreementDocData ? (
                    <>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = selectedRoom.agreementDocData;
                            link.download = selectedRoom.agreementDocName || 'lease-agreement';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="flex-1 sm:flex-initial justify-center px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Shared Agreement
                        </button>
                        <button
                          onClick={() => triggerRemoveAgreement(selectedRoom._id)}
                          className="p-2 border border-slate-200 dark:border-slate-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all flex-shrink-0"
                          title="Remove Agreement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <label className="w-full sm:w-auto justify-center px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 cursor-pointer rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" /> Replace Agreement
                        <input
                          type="file"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async () => {
                              const base64Data = reader.result as string;
                              try {
                                await api.put(`/properties/rooms/${selectedRoom._id}`, {
                                  agreementDocName: file.name,
                                  agreementDocData: base64Data
                                });
                                showToast('Flat lease agreement uploaded successfully!', 'success');
                                setSelectedRoom((prev: any) => ({
                                  ...prev,
                                  agreementDocName: file.name,
                                  agreementDocData: base64Data
                                }));
                                fetchRoomsForProperty(selectedProperty._id);
                              } catch (err: any) {
                                showToast(err.response?.data?.message || 'Failed to upload lease agreement', 'error');
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    </>
                  ) : (
                    <label className="w-full sm:w-auto justify-center px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 cursor-pointer rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" /> Upload Shared Agreement
                      <input
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = async () => {
                            const base64Data = reader.result as string;
                            try {
                              await api.put(`/properties/rooms/${selectedRoom._id}`, {
                                agreementDocName: file.name,
                                agreementDocData: base64Data
                              });
                              showToast('Flat lease agreement uploaded successfully!', 'success');
                              setSelectedRoom((prev: any) => ({
                                ...prev,
                                agreementDocName: file.name,
                                agreementDocData: base64Data
                              }));
                              fetchRoomsForProperty(selectedProperty._id);
                            } catch (err: any) {
                              showToast(err.response?.data?.message || 'Failed to upload lease agreement', 'error');
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Linked Users Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Linked Users Directory</h3>
                {linkedUserSearchQuery && (
                  <span className="text-xs text-slate-500">
                    Found {filteredBeds.length} of {roomBeds.length} spaces
                  </span>
                )}
              </div>
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-max min-w-full text-left border-collapse">
                  <thead className="bg-[#F1F5F9] dark:bg-slate-950 font-semibold text-xs text-slate-550 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 w-16">S No</th>
                      <th className="py-3 px-4 w-32">Space / Bed</th>
                      <th className="py-3 px-4">Occupant</th>
                      <th className="py-3 px-4 w-36">Phone Number</th>
                      <th className="py-3 px-4 w-32">Occupation</th>
                      <th className="py-3 px-4 w-32">Verification</th>
                      {selectedRoom.roomType !== 'flat' && (
                        <th className="py-3 px-4 w-36 text-right">Rent</th>
                      )}
                      <th className="py-3 px-4 w-36 text-right">Payment Status</th>
                      <th className="py-3 px-4 w-28 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-850">
                    {roomBeds.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 px-4 text-center text-slate-400 italic">
                          No spaces registered for this room.
                        </td>
                      </tr>
                    ) : filteredBeds.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 px-4 text-center text-slate-400 italic">
                          No spaces match "{linkedUserSearchQuery}".
                        </td>
                      </tr>
                    ) : (
                      filteredBeds.map((bed: any, idx: number) => {
                        const tenant = bed.tenant;
                        if (bed.isOccupied && tenant) {
                          const paymentStatus = getTenantPaymentStatus(tenant._id);
                          return (
                            <tr
                              key={bed._id}
                              onClick={() => { setSelectedTenant(tenant); setIsDossierOpen(true); }}
                              className="hover:bg-slate-50 dark:hover:bg-slate-955/40 transition-colors cursor-pointer group"
                            >
                              <td className="py-4 px-4 font-mono text-slate-400">{(idx + 1).toString().padStart(2, '0')}</td>
                              <td className="py-4 px-4 font-bold text-slate-750 dark:text-slate-300">
                                {selectedRoom.roomType === 'flat'
                                  ? `Space ${bed.bedNumber.split('-').pop()}`
                                  : bed.bedNumber.split('-').pop()}
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                    {tenant.fullName.substring(0, 2)}
                                  </div>
                                  <span className="font-bold text-slate-900 dark:text-white">{tenant.fullName}</span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-slate-500 dark:text-slate-400">{tenant.phone}</td>
                              <td className="py-4 px-4 text-slate-500 dark:text-slate-400 capitalize">{tenant.occupation || 'N/A'}</td>
                              <td className="py-4 px-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold ${tenant.verificationStatus === 'verified'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-200/50'
                                  : tenant.verificationStatus === 'failed'
                                    ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200/50'
                                    : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 border border-amber-200/50'
                                  }`}>
                                  {tenant.verificationStatus}
                                </span>
                              </td>
                              {selectedRoom.roomType !== 'flat' && (
                                editingRentTenantId === tenant._id ? (
                                  <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1.5 justify-end">
                                      <div className="relative w-24">
                                        <IndianRupee className="absolute left-1.5 top-2.5 w-3 h-3 text-slate-400" />
                                        <input
                                          type="number"
                                          value={editRentAmount}
                                          onChange={(e) => setEditRentAmount(parseInt(e.target.value) || 0)}
                                          className="w-full pl-5 pr-1.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                          autoFocus
                                        />
                                      </div>
                                      <button
                                        onClick={() => handleSaveTenantRent(tenant._id)}
                                        disabled={savingRentTenantId === tenant._id}
                                        className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                        title="Save Rent"
                                      >
                                        {savingRentTenantId === tenant._id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Check className="w-3 h-3" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => setEditingRentTenantId(null)}
                                        className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 transition-colors"
                                        title="Cancel"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </td>
                                ) : (
                                  <td className="py-4 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1.5 group/rent">
                                      <span>
                                        ₹{(
                                          (tenant.rentAmount !== undefined && tenant.rentAmount !== null)
                                            ? tenant.rentAmount
                                            : selectedRoom.monthlyRent
                                        ).toLocaleString('en-IN')}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingRentTenantId(tenant._id);
                                          setEditRentAmount(tenant.rentAmount !== null && tenant.rentAmount !== undefined ? tenant.rentAmount : selectedRoom.monthlyRent);
                                        }}
                                        className="p-1 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-850 rounded transition-all opacity-0 group-hover/rent:opacity-100 focus:opacity-100"
                                        title="Adjust Rent"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </td>
                                )
                              )}
                              <td className="py-4 px-4 text-right">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold ${paymentStatus === 'Cleared'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-200/50'
                                  : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200/50'
                                  }`}>
                                  {paymentStatus}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTenantToUnassign(tenant);
                                    setIsUnassignModalOpen(true);
                                  }}
                                  className="inline-flex items-center justify-center px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition-all border border-rose-200"
                                >
                                  Unassign
                                </button>
                              </td>
                            </tr>
                          );
                        } else {
                          return (
                            <tr key={bed._id} className="bg-slate-50/20 dark:bg-slate-955/5">
                              <td className="py-4 px-4 font-mono text-slate-400">{(idx + 1).toString().padStart(2, '0')}</td>
                              <td className="py-4 px-4 font-bold text-slate-500">
                                {selectedRoom.roomType === 'flat'
                                  ? `Space ${bed.bedNumber.split('-').pop()}`
                                  : bed.bedNumber.split('-').pop()}
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3 text-slate-400 italic">
                                  <div className="w-8 h-8 rounded-full border border-dashed border-slate-350 dark:border-slate-700 flex items-center justify-center text-slate-450 text-xs font-bold shrink-0">
                                    ∅
                                  </div>
                                  <span>Vacant Space</span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-slate-400">-</td>
                              <td className="py-4 px-4 text-slate-400">-</td>
                              <td className="py-4 px-4">-</td>
                              {selectedRoom.roomType !== 'flat' && (
                                <td className="py-4 px-4 text-right font-mono text-slate-400">
                                  ₹{selectedRoom.monthlyRent.toLocaleString('en-IN')}
                                </td>
                              )}
                              <td className="py-4 px-4 text-right">-</td>
                              <td className="py-4 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartAssignFlow({
                                      propertyId: selectedProperty._id,
                                      propertyName: selectedProperty.propertyName,
                                      roomId: selectedRoom._id,
                                      roomNumber: selectedRoom.roomNumber,
                                      bedId: bed._id,
                                      bedNumber: bed.bedNumber
                                    });
                                  }}
                                  className="inline-flex items-center justify-center px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg transition-all"
                                >
                                  <Plus className="w-3.5 h-3.5 mr-0.5" /> Assign
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="block md:hidden divide-y divide-slate-150 dark:divide-slate-850">
                {roomBeds.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 italic">
                    No spaces registered for this room.
                  </div>
                ) : filteredBeds.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 italic">
                    No spaces match "{linkedUserSearchQuery}".
                  </div>
                ) : (
                  filteredBeds.map((bed: any, idx: number) => {
                    const tenant = bed.tenant;
                    const isFlatType = selectedRoom.roomType === 'flat';
                    const spaceLabel = isFlatType
                      ? `Space ${bed.bedNumber.split('-').pop()}`
                      : `Bed ${bed.bedNumber.split('-').pop()}`;

                    if (bed.isOccupied && tenant) {
                      const paymentStatus = getTenantPaymentStatus(tenant._id);
                      const isEditingRent = editingRentTenantId === tenant._id;

                      return (
                        <div
                          key={bed._id}
                          onClick={() => { setSelectedTenant(tenant); setIsDossierOpen(true); }}
                          className="p-4 space-y-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                {tenant.fullName.substring(0, 2)}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white text-sm block">{tenant.fullName}</span>
                                <span className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold">{spaceLabel}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold ${tenant.verificationStatus === 'verified'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : tenant.verificationStatus === 'failed'
                                  ? 'bg-rose-500/10 text-rose-600'
                                  : 'bg-amber-500/10 text-amber-600'
                                }`}>
                                {tenant.verificationStatus}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold ${paymentStatus === 'Cleared'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-rose-500/10 text-rose-600'
                                }`}>
                                {paymentStatus}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs space-y-1.5 py-2 border-t border-b border-slate-50 dark:border-slate-850">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Phone:</span>
                              <span className="text-slate-800 dark:text-slate-300 font-medium">{tenant.phone}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Occupation:</span>
                              <span className="text-slate-800 dark:text-slate-300 capitalize">{tenant.occupation || 'N/A'}</span>
                            </div>
                            {selectedRoom.roomType !== 'flat' && (
                              <div className="flex justify-between items-center min-h-[2rem]">
                                <span className="text-slate-500">Rent:</span>
                                {isEditingRent ? (
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <div className="relative w-20">
                                      <IndianRupee className="absolute left-1.5 top-2 w-3 h-3 text-slate-400" />
                                      <input
                                        type="number"
                                        value={editRentAmount}
                                        onChange={(e) => setEditRentAmount(parseInt(e.target.value) || 0)}
                                        className="w-full pl-5 pr-1.5 py-0.5 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                        autoFocus
                                      />
                                    </div>
                                    <button
                                      onClick={() => handleSaveTenantRent(tenant._id)}
                                      disabled={savingRentTenantId === tenant._id}
                                      className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                    >
                                      {savingRentTenantId === tenant._id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Check className="w-3 h-3" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => setEditingRentTenantId(null)}
                                      className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-550 hover:bg-slate-200 transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 group/rent-m">
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                      ₹{((tenant.rentAmount !== undefined && tenant.rentAmount !== null) ? tenant.rentAmount : selectedRoom.monthlyRent).toLocaleString('en-IN')}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingRentTenantId(tenant._id);
                                        setEditRentAmount(tenant.rentAmount !== null && tenant.rentAmount !== undefined ? tenant.rentAmount : selectedRoom.monthlyRent);
                                      }}
                                      className="p-1 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-primary hover:bg-slate-50 rounded"
                                      title="Adjust Rent"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex justify-between items-center pt-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[10px] font-mono text-slate-450">Tap card for Dossier</span>
                            <button
                              type="button"
                              onClick={() => {
                                setTenantToUnassign(tenant);
                                setIsUnassignModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition-all border border-rose-200"
                            >
                              Unassign
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div key={bed._id} className="p-4 space-y-3 bg-slate-50/10 dark:bg-slate-900/5">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full border border-dashed border-slate-350 dark:border-slate-700 flex items-center justify-center text-slate-450 text-xs font-bold shrink-0">
                                ∅
                              </div>
                              <div>
                                <span className="text-slate-400 italic text-sm font-medium block">Vacant Space</span>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">{spaceLabel}</span>
                              </div>
                            </div>
                            {selectedRoom.roomType !== 'flat' && (
                              <span className="font-mono font-bold text-xs text-slate-500">
                                ₹{selectedRoom.monthlyRent.toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartAssignFlow({
                                  propertyId: selectedProperty._id,
                                  propertyName: selectedProperty.propertyName,
                                  roomId: selectedRoom._id,
                                  roomNumber: selectedRoom.roomNumber,
                                  bedId: bed._id,
                                  bedNumber: bed.bedNumber
                                });
                              }}
                              className="inline-flex items-center justify-center px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg transition-all"
                            >
                              <Plus className="w-3.5 h-3.5 mr-0.5" /> Assign
                            </button>
                          </div>
                        </div>
                      );
                    }
                  })
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* Add Property Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-extrabold mb-4">Register New Property</h3>
            <form onSubmit={handleAddProperty} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider text-slate-500">Property Name</label>
                <input type="text" value={propertyName} onChange={(e) => setPropertyName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white"
                  placeholder="e.g. Premium Executive PG" required />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider text-slate-500">Full Address</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white"
                  placeholder="e.g. Sector 45, Gurugram" required />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider text-slate-500">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm h-20 focus:outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white"
                  placeholder="Describe building amenities, location, nearby landmarks..." />
              </div>

              <button type="submit" disabled={submitting}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold shadow-md shadow-primary/20 disabled:opacity-50 transition-all mt-2">
                {submitting ? 'Creating...' : 'Create Property'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Room Modal */}
      {isAddRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
            <button onClick={() => setIsAddRoomModalOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-extrabold mb-4">Add Room to Property</h3>
            <form onSubmit={handleAddRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider text-slate-500">Room Number</label>
                <input type="text" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white"
                  placeholder="e.g. Room-101" required />
              </div>
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider text-slate-500">Unit Type</label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="roomType" checked={roomType === 'pg'} onChange={() => { setRoomType('pg'); setBedCapacity(2); }} className="text-primary focus:ring-primary" />
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">Paying Guest (PG)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="roomType" checked={roomType === 'flat'} onChange={() => { setRoomType('flat'); setBedCapacity(4); }} className="text-primary focus:ring-primary" />
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">Flat / Apartment</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider text-slate-500">
                  {roomType === 'flat' ? 'Max Occupancy (Persons)' : 'Bed Capacity'}
                </label>
                <input type="number" value={bedCapacity} onChange={(e) => setBedCapacity(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white"
                  min={1} required />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5" /> Monthly Rent (INR)
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(parseInt(e.target.value))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    min={0} required />
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold shadow-md shadow-primary/20 disabled:opacity-50 transition-all mt-2">
                {submitting ? 'Adding...' : 'Add Room & Initialize'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Dossier Side Drawer ── */}
      {isDossierOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="flex-1" onClick={() => setIsDossierOpen(false)} />
          <div className="w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl p-6 overflow-y-auto flex flex-col justify-between border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-850 mb-6">
                <h3 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </span>
                  Occupant Dossier
                </h3>
                <button onClick={() => setIsDossierOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg uppercase">
                    {selectedTenant.fullName.substring(0, 2)}
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">{selectedTenant.fullName}</h4>
                    <p className="text-xs text-slate-400 capitalize">{selectedTenant.occupation || 'Occupant'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 text-center">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Credit Score</span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white">{selectedTenant.creditScore || 700}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 text-center">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Rating</span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white flex items-center justify-center gap-0.5">
                      {selectedTenant.tenantRating || 5.0}
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 text-center">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Risk Level</span>
                    <span className={`text-xs font-extrabold uppercase px-2 py-0.5 rounded-full inline-block mt-0.5 ${selectedTenant.riskLevel === 'high'
                      ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200'
                      : selectedTenant.riskLevel === 'medium'
                        ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 border border-amber-200'
                        : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-200'
                      }`}>
                      {selectedTenant.riskLevel || 'low'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contact & Info</h5>
                  <div className="text-xs space-y-2 grid grid-cols-2 gap-x-4">
                    <div>
                      <span className="text-slate-400 block">Phone</span>
                      <span className="font-semibold text-slate-850 dark:text-slate-200">{selectedTenant.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Email</span>
                      <span className="font-semibold text-slate-850 dark:text-slate-200 truncate block">{selectedTenant.email || 'N/A'}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-slate-400 block">Emergency Contact</span>
                      <span className="font-semibold text-slate-855 dark:text-slate-200">{selectedTenant.emergencyContact || 'N/A'}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-slate-400 block">Aadhaar Number</span>
                      <span className="font-semibold text-slate-850 dark:text-slate-200">•••• •••• {selectedTenant.aadhaarNumber?.slice(-4)}</span>
                    </div>
                    <div className="col-span-2 mt-2">
                      <span className="text-slate-400 block">Permanent Address</span>
                      <span className="font-semibold text-slate-850 dark:text-slate-200 block">{selectedTenant.address || 'N/A'}</span>
                    </div>
                    <div className="col-span-2 mt-2">
                      <span className="text-slate-400 block">Joining Date</span>
                      <span className="font-semibold text-slate-850 dark:text-slate-200 block">
                        {selectedTenant.joiningDate ? new Date(selectedTenant.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Outstanding Invoices</h5>
                  {loadingPayments ? (
                    <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
                  ) : (() => {
                    const unpaid = allPayments.filter(p => p.tenant?._id === selectedTenant._id && p.status === 'unpaid');
                    if (unpaid.length === 0) {
                      return <p className="text-xs text-emerald-500 flex items-center gap-1 font-semibold">✓ No outstanding dues</p>;
                    }
                    return (
                      <div className="space-y-2">
                        {unpaid.map((payment: any) => (
                          <div key={payment._id} className="flex justify-between items-center p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-950/20 text-xs">
                            <div>
                              <span className="font-bold text-rose-600 flex items-center gap-1">
                                <IndianRupee className="w-3.5 h-3.5" />
                                {payment.amount.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-slate-400 block">Due: {new Date(payment.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/40 text-rose-600 text-[10px] font-bold uppercase">Pending</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Documents Dossier</h5>
                  <div className="space-y-3">
                    {renderDocItem('Aadhaar Card', 'aadhaar', selectedTenant)}
                    {renderDocItem('Lease Agreement', 'agreement', selectedTenant)}
                    {renderDocItem('Passport Photo', 'photo', selectedTenant)}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-850 mt-6">
              <button
                onClick={() => setIsDossierOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-850 dark:text-slate-300 text-xs font-bold transition-all"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Tenant Modal ── */}
      {isAssignModalOpen && assigningContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
            <button
              onClick={() => {
                setIsAssignModalOpen(false);
                resetAssignForm();
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4 pr-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unit Allocation</span>
              <h3 className="text-xl font-bold mt-0.5 flex items-center gap-1.5">
                <BedDouble className="w-5 h-5 text-primary" /> Assign Tenant
              </h3>
              <p className="text-xs text-slate-550 dark:text-slate-450 mt-1">
                Allocating space at <span className="font-bold text-slate-700 dark:text-slate-300">{assigningContext.propertyName}</span> &rarr; <span className="font-bold text-slate-700 dark:text-slate-300">Room {assigningContext.roomNumber}</span> ({assigningContext.bedNumber.split('-').pop()})
              </p>
            </div>

            <form onSubmit={handleAssignExistingTenant} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase text-slate-500 dark:text-slate-400">Select Unallocated Tenant</label>
                {unassignedTenants.length === 0 ? (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-500 italic">
                    No unallocated tenants found.
                  </div>
                ) : (
                  <select
                    value={selectedTenantToAssign}
                    onChange={(e) => setSelectedTenantToAssign(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    required
                  >
                    <option value="">-- Choose Tenant --</option>
                    {unassignedTenants.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.fullName} ({t.phone})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedTenantToAssign}
                className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50 transition-all hover:scale-[1.01]"
              >
                {submitting ? 'Allocating...' : 'Confirm Allocation'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-150 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-400 mb-3">Don't see your tenant? Register or invite them first.</p>
              <button
                type="button"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  resetAssignForm();
                  router.push('/dashboard/owner/tenants');
                }}
                className="w-full py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-950/40 dark:text-slate-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Go to Tenants Registry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Subscription Payment Modal ── */}
      {isLicensingModalOpen && canAssignDetails && assigningContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative text-slate-900 dark:text-white">
            <button
              onClick={() => {
                setIsLicensingModalOpen(false);
                resetAssignForm();
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-105 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4 text-center">
              <span className="p-2.5 rounded-full bg-amber-500/10 text-amber-500 inline-block mb-3">
                <AlertTriangle className="w-8 h-8" />
              </span>
              <h3 className="text-xl font-bold">Subscription Payment Required</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                You have reached your free tenant limit and need to purchase a license before assigning more tenants.
              </p>
            </div>

            <div className="space-y-3 my-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Current Linked Tenants:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{canAssignDetails.currentLinked}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Paid Limit:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{canAssignDetails.paidLimit}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 font-semibold">
                <span className="text-slate-650 dark:text-slate-350">Amount Due:</span>
                <span className="text-primary font-black">₹{canAssignDetails.amountDue}/month</span>
              </div>
            </div>

            <button
              onClick={async () => {
                setIsPaying(true);
                try {
                  const orderRes = await api.post('/payments/bed-billing/order');
                  const { orderId, amount, currency, isSimulated, keyId } = orderRes.data;

                  if (isSimulated) {
                    showToast('Sandbox mode detected. Simulating payment...', 'info');
                    await api.post('/payments/bed-billing/verify', { razorpay_order_id: orderId, isMock: true });
                    showToast('Payment simulated successfully! Licenses activated.', 'success');
                    setIsLicensingModalOpen(false);
                    fetchBillingStatus();
                    fetchProperties();
                    setSelectedTenantToAssign('');
                    setAssignMode('existing');
                    await fetchUnassignedTenants();
                    setIsAssignModalOpen(true);
                  } else {
                    const scriptLoaded = await loadRazorpayScript();
                    if (!scriptLoaded) {
                      showToast('Failed to load Razorpay SDK.', 'error');
                      setIsPaying(false);
                      return;
                    }
                    const options = {
                      key: keyId,
                      amount,
                      currency,
                      name: 'PropManager Tenant Licensing',
                      description: `Licensing subscription payment`,
                      order_id: orderId,
                      handler: async (response: any) => {
                        try {
                          await api.post('/payments/bed-billing/verify', {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            isMock: false
                          });
                          showToast('Payment verified! Tenant license active.', 'success');
                          setIsLicensingModalOpen(false);
                          fetchBillingStatus();
                          fetchProperties();
                          setSelectedTenantToAssign('');
                          setAssignMode('existing');
                          await fetchUnassignedTenants();
                          setIsAssignModalOpen(true);
                        } catch (err: any) {
                          showToast(err.response?.data?.message || 'Payment verification failed', 'error');
                        }
                      },
                      prefill: { name: '', email: '', contact: '' },
                      theme: { color: '#2563EB' }
                    };
                    const rzp = new (window as any).Razorpay(options);
                    rzp.open();
                  }
                } catch (err: any) {
                  showToast(err.response?.data?.message || 'Failed to initiate payment', 'error');
                } finally {
                  setIsPaying(false);
                }
              }}
              disabled={isPaying}
              className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
            >
              {isPaying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>Pay ₹{canAssignDetails.amountDue} Now</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Unassign Confirmation Modal */}
      {isUnassignModalOpen && tenantToUnassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Unassign Tenant
              </h3>
              <button onClick={() => { setIsUnassignModalOpen(false); setTenantToUnassign(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Are you sure you want to unassign <span className="font-bold text-slate-900 dark:text-white">{tenantToUnassign.fullName}</span> from this property? They will be moved to the unassigned list.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setIsUnassignModalOpen(false); setTenantToUnassign(null); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUnassignTenant}
                  disabled={submitting}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl shadow-md shadow-rose-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Processing...</> : 'Unassign'}
                </button>
              </div>
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
                {deleteConfirmTitle}
              </h3>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteType(null);
                  setDeleteItemId('');
                  setDeleteItemExtraId('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                {deleteConfirmMessage}
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteType(null);
                    setDeleteItemId('');
                    setDeleteItemExtraId('');
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
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
