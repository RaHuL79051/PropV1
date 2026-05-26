'use client';

import React, { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import { 
  Building, Plus, Trash2, MapPin, Loader2, X, AlertTriangle,
  ChevronDown, ChevronRight, Pencil, Check, BedDouble, IndianRupee,
  Upload, Download, User, Star, FileText, Search, ShieldAlert,
  Calendar, ArrowLeft, Users
} from 'lucide-react';
import { Property, Room, User as OwnerUser } from '../../../../types';

export default function AdminPropertiesPage() {
  const showToast = useToastStore((state) => state.showToast);
  const [properties, setProperties] = useState<any[]>([]);
  const [owners, setOwners] = useState<OwnerUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const [loadingRoomsFor, setLoadingRoomsFor] = useState<string | null>(null);

  // Multi-step navigation views: 'properties' | 'rooms' | 'linked-users'
  const [currentView, setCurrentView] = useState<'properties' | 'rooms' | 'linked-users'>('properties');
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
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

  // Unassign Tenant modal states
  const [isUnassignModalOpen, setIsUnassignModalOpen] = useState(false);
  const [tenantToUnassign, setTenantToUnassign] = useState<any>(null);

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
      // Find who owns the property, so we can map ownerId correctly
      const targetOwnerId = selectedProperty?.owner?._id || selectedProperty?.owner || '';
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
        joiningDate: assignJoiningDate || null,
        ownerId: targetOwnerId
      });

      showToast('Tenant registered and allocated successfully!', 'success');
      setIsAssignModalOpen(false);
      resetAssignForm();
      fetchProperties();
      if (selectedProperty) {
        fetchRoomsForProperty(selectedProperty._id);
      }
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
      const targetOwnerId = selectedProperty?.owner?._id || selectedProperty?.owner || '';
      const res = await api.post('/tenants/invites', {
        aadhaarNumber: assignAadhaar,
        email: resolvedEmail,
        assignedProperty: assigningContext.propertyId,
        assignedRoom: assigningContext.roomId,
        assignedBed: assigningContext.bedId,
        joiningDate: assignJoiningDate || null,
        ownerId: targetOwnerId
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

  // Add Property form
  const [propertyName, setPropertyName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [totalRooms, setTotalRooms] = useState(1);
  const [propertyRoomType, setPropertyRoomType] = useState<'flat' | 'pg'>('pg');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');

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

  // Delete confirmation states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'property' | 'room' | null>(null);
  const [deleteItemId, setDeleteItemId] = useState('');
  const [deleteItemExtraId, setDeleteItemExtraId] = useState('');
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState('');
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

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

  const fetchOwners = async () => {
    try {
      const res = await api.get('/auth/owners');
      setOwners(res.data);
    } catch (err) {
      console.error('Failed to fetch owners list', err);
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
    fetchOwners();
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

  const triggerDeleteRoom = (roomId: string, propId: string) => {
    setDeleteType('room');
    setDeleteItemId(roomId);
    setDeleteItemExtraId(propId);
    setDeleteConfirmTitle('Delete Room');
    setDeleteConfirmMessage('Are you sure you want to delete this room and all its beds? This action is permanent and cannot be undone.');
    setIsDeleteModalOpen(true);
  };

  const handleDeleteRoom = async (roomId: string, propId: string) => {
    try {
      await api.delete(`/properties/rooms/${roomId}`);
      showToast('Room deleted', 'success');
      fetchRoomsForProperty(propId);
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
        setTimeout(() => fetchRoomsForProperty(selectedProperty._id), 200);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to unassign tenant', 'error');
    } finally {
      setSubmitting(false);
      setTenantToUnassign(null);
    }
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyName || !address || !selectedOwnerId) { 
      showToast('Name, address, and owner are required', 'error'); 
      return; 
    }
    setSubmitting(true);
    try {
      await api.post('/properties', { 
        propertyName, 
        address, 
        description, 
        totalRooms, 
        roomType: propertyRoomType,
        ownerId: selectedOwnerId
      });
      showToast('Property created and assigned successfully!', 'success');
      setIsAddModalOpen(false);
      setPropertyName(''); setAddress(''); setDescription(''); setTotalRooms(1); setPropertyRoomType('pg'); setSelectedOwnerId('');
      fetchProperties();
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
      fetchProperties();
      if (selectedProperty?._id === selectedPropertyId) {
        fetchRoomsForProperty(selectedPropertyId);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to add room', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const triggerDeleteProperty = (id: string) => {
    setDeleteType('property');
    setDeleteItemId(id);
    setDeleteConfirmTitle('Delete Property');
    setDeleteConfirmMessage('Are you sure you want to delete this property and all associated rooms/beds? This action is permanent and cannot be undone.');
    setIsDeleteModalOpen(true);
  };

  const handleDeleteProperty = async (id: string) => {
    try {
      await api.delete(`/properties/${id}`);
      showToast('Property deleted successfully', 'success');
      fetchProperties();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete property', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteType || !deleteItemId) return;
    setIsDeleting(true);
    try {
      if (deleteType === 'property') {
        await api.delete(`/properties/${deleteItemId}`);
        showToast('Property deleted successfully', 'success');
        fetchProperties();
        if (selectedProperty && selectedProperty._id === deleteItemId) {
          setCurrentView('properties');
          setSelectedProperty(null);
        }
      } else if (deleteType === 'room') {
        await api.delete(`/properties/rooms/${deleteItemId}`);
        showToast('Room deleted', 'success');
        fetchRoomsForProperty(deleteItemExtraId);
        fetchProperties();
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
              <h2 className="text-2xl font-extrabold tracking-tight">System Properties Directory</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Global real-estate listing oversight, room configurations, and management allocation.</p>
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
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 font-sans">
                  <table className="w-max min-w-full text-left border-collapse">
                    <thead className="bg-[#F1F5F9] dark:bg-slate-950 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4 w-20">S NO</th>
                        <th className="py-3 px-4">Property Name</th>
                        <th className="py-3 px-4">Associated Manager / Owner</th>
                        <th className="py-3 px-4 w-40">Status</th>
                        <th className="py-3 px-4 w-48 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                      {filteredProperties.map((prop, idx) => (
                        <tr key={prop._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                          <td className="py-4 px-4 font-bold text-slate-400 tabular-nums">{idx + 1}</td>
                          <td className="py-4 px-4 font-bold text-slate-800 dark:text-white">
                            <div>
                              <span className="block font-semibold text-slate-800 dark:text-slate-100">{prop.propertyName}</span>
                              <span className="text-xs text-slate-400 flex items-center gap-1 font-normal mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-450" /> {prop.address}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            {prop.owner ? (
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 block">{prop.owner.fullName || 'N/A'}</span>
                                <span className="text-xs text-slate-400 block">{prop.owner.email || 'N/A'}</span>
                              </div>
                            ) : (
                              <span className="text-xs italic text-slate-400">Unassigned</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-600 dark:text-emerald-400">
                              {prop.totalRooms} Rooms
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              <button
                                onClick={() => handleViewRooms(prop)}
                                className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold transition-all"
                              >
                                Manage Spaces
                              </button>
                              <button
                                onClick={() => triggerDeleteProperty(prop._id)}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* 2. ROOMS & BED MANAGEMENT VIEW */}
      {currentView === 'rooms' && selectedProperty && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setCurrentView('properties');
                setSelectedProperty(null);
              }}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-500"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rooms & Bed Setup</span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                {selectedProperty.propertyName}
              </h2>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={roomSearchQuery}
                onChange={(e) => setRoomSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <button
              onClick={() => {
                setSelectedPropertyId(selectedProperty._id);
                setIsAddRoomModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-primary/20 transition-all hover:scale-105 shrink-0"
            >
              <Plus className="w-4.5 h-4.5" /> Add Room Space
            </button>
          </div>

          {/* Rooms List */}
          {(() => {
            const list = propertyRooms[selectedProperty._id] || [];
            const filtered = list.filter((r) =>
              r.roomNumber.toLowerCase().includes(roomSearchQuery.toLowerCase())
            );

            if (filtered.length === 0) {
              return (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <ChevronRight className="w-8 h-8 mx-auto text-slate-400 rotate-90" />
                  <p className="text-sm font-medium text-slate-500 italic mt-2">No rooms configured for this property.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((room) => {
                  const isEditing = editingRoomId === room._id;
                  const roomBeds = room.beds || [];
                  const occupiedCount = roomBeds.filter((b: any) => b.isOccupied).length;

                  return (
                    <div
                      key={room._id}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow relative"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            {room.roomType === 'flat' ? 'Flat Sharing' : 'PG Double sharing'}
                          </span>
                          <h3 className="text-lg font-black text-slate-850 dark:text-white mt-0.5">
                            {room.roomNumber}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <button
                              onClick={() => handleSaveRoom(room._id, selectedProperty._id)}
                              disabled={savingRoomId === room._id}
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 transition-all"
                            >
                              {savingRoomId === room._id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartEditRoom(room)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => triggerDeleteRoom(room._id, selectedProperty._id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Room Metrics & Parameters */}
                      <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Monthly Rent</span>
                          {isEditing ? (
                            <input
                              type="number"
                              value={editRent}
                              onChange={(e) => setEditRent(Number(e.target.value))}
                              className="w-full mt-1 px-2.5 py-1 text-sm rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          ) : (
                            <span className="text-sm font-extrabold text-slate-850 dark:text-white flex items-center font-sans mt-0.5">
                              <IndianRupee className="w-3.5 h-3.5" /> {room.monthlyRent}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Capacity</span>
                          {isEditing ? (
                            <input
                              type="number"
                              value={editBedCapacity}
                              onChange={(e) => setEditBedCapacity(Number(e.target.value))}
                              className="w-full mt-1 px-2.5 py-1 text-sm rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          ) : (
                            <span className="text-sm font-extrabold text-slate-850 dark:text-white block mt-0.5">
                              {occupiedCount} / {room.bedCapacity} Occupied
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Beds Map */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-bold text-slate-450 block">Occupancy Spaces Map</span>
                        <div className="grid grid-cols-2 gap-2">
                          {roomBeds.map((bed: any) => (
                            <div
                              key={bed._id}
                              className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 text-xs transition-all ${
                                bed.isOccupied
                                  ? 'border-primary/20 bg-primary/[0.03] text-primary'
                                  : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-550'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1.5">
                                  <BedDouble className="w-4 h-4 shrink-0" />
                                  <span className="font-bold">{bed.bedNumber.split('-').pop()}</span>
                                </div>
                                <span className={`text-[8px] font-black uppercase px-1 rounded ${
                                  bed.isOccupied ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                }`}>
                                  {bed.isOccupied ? 'Occupied' : 'Vacant'}
                                </span>
                              </div>

                              {bed.isOccupied && bed.tenant ? (
                                <div className="mt-1 flex items-center justify-between">
                                  <div className="min-w-0">
                                    <span className="block font-bold text-slate-800 dark:text-slate-100 truncate text-[11px]">
                                      {bed.tenant.fullName}
                                    </span>
                                    <span className="block text-[9px] text-slate-400">
                                      Rent: ₹{bed.tenant.rentAmount || (room.roomType === 'flat' ? Math.round(room.monthlyRent / (room.bedCapacity || 1)) : room.monthlyRent)}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleViewLinkedUsers(room)}
                                    className="p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary"
                                    title="View Tenant Dossier"
                                  >
                                    <User className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setAssigningContext({
                                      propertyId: selectedProperty._id,
                                      propertyName: selectedProperty.propertyName,
                                      roomId: room._id,
                                      roomNumber: room.roomNumber,
                                      bedId: bed._id,
                                      bedNumber: bed.bedNumber
                                    });
                                    fetchUnassignedTenants();
                                    setIsAssignModalOpen(true);
                                  }}
                                  className="mt-1 w-full py-1 text-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 hover:dark:bg-slate-750 text-[10px] font-extrabold rounded-lg text-slate-700 dark:text-slate-300"
                                >
                                  Assign Tenant
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* 3. LINKED USERS VIEW */}
      {currentView === 'linked-users' && selectedProperty && selectedRoom && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setCurrentView('rooms');
                setSelectedRoom(null);
              }}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {selectedProperty.propertyName} / {selectedRoom.roomNumber}
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Active Room Occupants</h2>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            {(() => {
              const beds = selectedRoom.beds || [];
              const occupied = beds.filter((b: any) => b.isOccupied && b.tenant);

              if (occupied.length === 0) {
                return (
                  <div className="text-center py-10 italic text-slate-400">
                    No active tenants allocated in this room.
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {occupied.map((bed: any) => {
                    const tenant = bed.tenant;
                    const paymentStatus = getTenantPaymentStatus(tenant._id);
                    const defaultRent = selectedRoom.roomType === 'flat' 
                      ? Math.round(selectedRoom.monthlyRent / (selectedRoom.bedCapacity || 1)) 
                      : selectedRoom.monthlyRent;
                    const rentVal = tenant.rentAmount || defaultRent;
                    const isEditingRent = editingRentTenantId === tenant._id;

                    return (
                      <div
                        key={tenant._id}
                        className="p-4 rounded-2xl border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col justify-between gap-4"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm uppercase">
                              {tenant.fullName.substring(0, 2)}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-850 dark:text-white">{tenant.fullName}</h4>
                              <p className="text-[11px] text-slate-400">Space: {bed.bedNumber.split('-').pop()}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setIsDossierOpen(true);
                            }}
                            className="text-xs font-bold text-primary hover:underline"
                          >
                            View Dossier & Documents
                          </button>
                        </div>

                        {/* Adjust Rent & Details */}
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-semibold">Rent Amount</span>
                            {isEditingRent ? (
                              <div className="flex gap-1 mt-1">
                                <input
                                  type="number"
                                  value={editRentAmount}
                                  onChange={(e) => setEditRentAmount(Number(e.target.value))}
                                  className="w-20 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 bg-transparent font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <button
                                  onClick={() => handleSaveTenantRent(tenant._id)}
                                  disabled={savingRentTenantId === tenant._id}
                                  className="p-1 rounded bg-emerald-500 text-white"
                                >
                                  {savingRentTenantId === tenant._id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-extrabold text-slate-850 dark:text-white">₹{rentVal.toLocaleString()}</span>
                                <button
                                  onClick={() => {
                                    setEditingRentTenantId(tenant._id);
                                    setEditRentAmount(rentVal);
                                  }}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-semibold">Invoice Status</span>
                            <span className={`block font-extrabold mt-0.5 ${paymentStatus === 'Cleared' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {paymentStatus}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => {
                              setTenantToUnassign(tenant);
                              setIsUnassignModalOpen(true);
                            }}
                            className="px-3.5 py-1.5 rounded-lg border border-rose-500/20 text-rose-500 bg-rose-500/[0.04] hover:bg-rose-500/10 text-xs font-bold transition-all"
                          >
                            Unallocate Bed Space
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Add Property Modal ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                setPropertyName(''); setAddress(''); setDescription(''); setTotalRooms(1); setPropertyRoomType('pg'); setSelectedOwnerId('');
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <Building className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Register New Property</h3>
            </div>

            <form onSubmit={handleAddProperty} className="space-y-4">
              {/* Owner Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Assign Property Manager (Owner)</label>
                <select
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  <option value="">-- Select Property Owner --</option>
                  {owners.map((owner) => (
                    <option key={(owner as any)._id || owner.id} value={(owner as any)._id || owner.id}>
                      {owner.fullName} ({owner.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Property Name</label>
                <input
                  type="text"
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  placeholder="e.g. Royal PG Suites"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Sector 62, Noida"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Premium sharing PG room spaces"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Total Rooms</label>
                  <input
                    type="number"
                    value={totalRooms}
                    onChange={(e) => setTotalRooms(Number(e.target.value))}
                    min={1}
                    max={100}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Room Type Layout</label>
                  <select
                    value={propertyRoomType}
                    onChange={(e) => setPropertyRoomType(e.target.value as 'flat' | 'pg')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  >
                    <option value="pg">PG Sharing (2 beds)</option>
                    <option value="flat">Flat Layout (4 beds)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50 mt-4 hover:scale-[1.02] transition-transform"
              >
                {submitting ? 'Creating property portfolio...' : 'Register Property'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Room Modal ── */}
      {isAddRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setIsAddRoomModalOpen(false);
                setRoomNumber(''); setBedCapacity(1); setMonthlyRent(8000); setRoomType('pg');
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <Plus className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add New Room Space</h3>
            </div>

            <form onSubmit={handleAddRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Room Number / Name</label>
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g. Room 105"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Bed Capacity</label>
                  <input
                    type="number"
                    value={bedCapacity}
                    onChange={(e) => setBedCapacity(Number(e.target.value))}
                    min={1}
                    max={10}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Room Layout</label>
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value as 'flat' | 'pg')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-955 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  >
                    <option value="pg">PG Sharing Room</option>
                    <option value="flat">Flat Shared space</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Monthly Rent (INR)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(Number(e.target.value))}
                    min={0}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50 mt-4 hover:scale-[1.02] transition-transform"
              >
                {submitting ? 'Creating space configuration...' : 'Add Room'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Tenant Modal ── */}
      {isAssignModalOpen && assigningContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[95vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setIsAssignModalOpen(false);
                resetAssignForm();
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-primary" />
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Allocate Occupancy Space</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {assigningContext.propertyName} — Room {assigningContext.roomNumber} ({assigningContext.bedNumber.split('-').pop()})
                </p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-3 mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <button
                type="button"
                onClick={() => setAssignMode('existing')}
                className={`py-2 rounded-xl text-xs font-extrabold transition-all border ${
                  assignMode === 'existing'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Existing Unassigned Tenant
              </button>
              <button
                type="button"
                onClick={() => setAssignMode('new')}
                className={`py-2 rounded-xl text-xs font-extrabold transition-all border ${
                  assignMode === 'new'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Register & Allocate New
              </button>
            </div>

            {assignMode === 'existing' ? (
              <form onSubmit={handleAssignExistingTenant} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Select Unassigned Tenant</label>
                  {unassignedTenants.length === 0 ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-semibold">
                      No unassigned tenants found in the directory. Please register them first or select "Register & Allocate New".
                    </div>
                  ) : (
                    <select
                      value={selectedTenantToAssign}
                      onChange={(e) => setSelectedTenantToAssign(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      <option value="">-- Choose Tenant --</option>
                      {unassignedTenants.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.fullName} (Aadhaar: {t.aadhaarNumber.slice(-4)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting || !selectedTenantToAssign}
                  className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 disabled:opacity-50 mt-4 hover:scale-[1.02] transition-transform"
                >
                  {submitting ? 'Allocating Space...' : 'Allocate Room Space'}
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                    Aadhaar Card Number (12 Digits)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={assignAadhaar}
                      onChange={(e) => setAssignAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      placeholder="Enter 12-digit number"
                      maxLength={12}
                    />
                    <button
                      type="button"
                      disabled={assignAadhaarVerifying || assignAadhaar.length !== 12}
                      onClick={handleAssignVerifyAadhaar}
                      className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold disabled:opacity-50 shrink-0"
                    >
                      {assignAadhaarVerifying ? 'Checking...' : 'Check'}
                    </button>
                  </div>
                </div>

                {assignVerificationResult && (
                  <form onSubmit={handleRegisterNewTenantInAssign} className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-300">
                    {/* Mode selector: invite vs manual */}
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <button
                        type="button"
                        onClick={() => setAssignRegMode('invite')}
                        className={`py-2 rounded-xl text-[10px] font-extrabold border ${
                          assignRegMode === 'invite' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-800 text-slate-550'
                        }`}
                      >
                        Send Invitation Link
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignRegMode('manual')}
                        className={`py-2 rounded-xl text-[10px] font-extrabold border ${
                          assignRegMode === 'manual' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-800 text-slate-550'
                        }`}
                      >
                        Manual Registration
                      </button>
                    </div>

                    {assignInviteUrl && (
                      <div className="p-3 rounded-2xl border border-emerald-250 bg-emerald-50 text-emerald-900 text-xs font-semibold break-all">
                        Invitation link generated: {assignInviteUrl}
                      </div>
                    )}

                    {assignRegMode === 'invite' ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-550 dark:text-slate-400 mb-1">Tenant Email</label>
                          <input
                            type="email"
                            value={assignInviteEmail || assignEmail}
                            onChange={(e) => {
                              setAssignInviteEmail(e.target.value);
                              setAssignEmail(e.target.value);
                            }}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="tenant@example.com"
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSendInviteInAssign}
                          disabled={assignInviteSending}
                          className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20"
                        >
                          {assignInviteSending ? 'Sending invite...' : 'Send Invitation Link'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-550 mb-1">Occupant Name</label>
                            <input
                              type="text"
                              value={assignFullName}
                              onChange={(e) => setAssignFullName(e.target.value)}
                              required
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-550 mb-1">Email</label>
                            <input
                              type="email"
                              value={assignEmail}
                              onChange={(e) => setAssignEmail(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-550 mb-1">Phone</label>
                            <input
                              type="tel"
                              value={assignPhone}
                              onChange={(e) => setAssignPhone(e.target.value)}
                              required
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-550 mb-1">Emergency Contact</label>
                            <input
                              type="tel"
                              value={assignEmergency}
                              onChange={(e) => setAssignEmergency(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-550 mb-1">Permanent Address</label>
                          <input
                            type="text"
                            value={assignAddress}
                            onChange={(e) => setAssignAddress(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={assignSubmitting}
                          className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold"
                        >
                          {assignSubmitting ? 'Registering & Allocating...' : 'Register and Allocate'}
                        </button>
                      </>
                    )}
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Unassign Confirmation Modal ── */}
      {isUnassignModalOpen && tenantToUnassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Unallocate Tenant
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-450 mt-2">
              Are you sure you want to unallocate <span className="font-extrabold text-slate-900 dark:text-white">{tenantToUnassign.fullName}</span> from their bed space? This will mark their agreement status as expired.
            </p>

            <div className="flex gap-3 pt-5">
              <button
                type="button"
                onClick={() => {
                  setIsUnassignModalOpen(false);
                  setTenantToUnassign(null);
                }}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-550 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnassignTenant}
                disabled={submitting}
                className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold transition-all hover:bg-rose-600 disabled:opacity-60"
              >
                {submitting ? 'Processing...' : 'Yes, Unallocate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dossier drawer ── */}
      {isDossierOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-250 dark:border-slate-800 h-full overflow-y-auto p-6 relative flex flex-col justify-between animate-in slide-in-from-right duration-350 shadow-2xl">
            <button
              onClick={() => {
                setIsDossierOpen(false);
                setSelectedTenant(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-6 flex-1 pb-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg uppercase flex-shrink-0">
                  {selectedTenant.fullName.substring(0, 2)}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">{selectedTenant.fullName}</h3>
                  <span className="text-xs text-slate-450 block">{selectedTenant.occupation || 'Occupant'}</span>
                </div>
              </div>

              {/* Preferences / Info List */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl text-xs">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block">Aadhaar Card</span>
                  <span className="font-extrabold text-slate-850 dark:text-white block mt-0.5 font-sans">
                    XXXX-XXXX-{selectedTenant.aadhaarNumber.slice(-4)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block">Phone Contact</span>
                  <span className="font-extrabold text-slate-850 dark:text-white block mt-0.5 font-sans">
                    {selectedTenant.phone}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block">Permanent Address</span>
                  <span className="font-extrabold text-slate-850 dark:text-white block mt-0.5">
                    {selectedTenant.address || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block">Reliability Credit</span>
                  <span className="font-extrabold text-slate-850 dark:text-white block mt-0.5">
                    {selectedTenant.creditScore || 700}
                  </span>
                </div>
              </div>

              {/* Documents files upload sections */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Verification & Legal Dossier</h4>
                {renderDocItem('Aadhaar Card Document', 'aadhaar', selectedTenant)}
                {renderDocItem('Lease Rental Agreement', 'agreement', selectedTenant)}
                {renderDocItem('Occupant Verification Photo', 'photo', selectedTenant)}
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
            <div className="p-5 flex-1">
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
