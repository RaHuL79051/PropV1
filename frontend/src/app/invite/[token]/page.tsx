'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api from '../../../lib/api';
import { useToastStore } from '../../../store/toastStore';
import { Building2, Loader2, ShieldCheck, Mail, Phone, User, CheckCircle2 } from 'lucide-react';

interface InviteDetails {
  token: string;
  aadhaarNumber: string;
  email: string;
  owner?: { fullName?: string; email?: string };
  assignedProperty?: { propertyName?: string; address?: string } | null;
  assignedRoom?: { roomNumber?: string; monthlyRent?: number } | null;
  assignedBed?: { bedNumber?: string } | null;
  expiresAt?: string;
}

export default function TenantInvitePage() {
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const showToast = useToastStore((state) => state.showToast);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [accepted, setAccepted] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [occupation, setOccupation] = useState('');
  const [address, setAddress] = useState('');
  const [panNumber, setPanNumber] = useState('');

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) return;

      try {
        const res = await api.get(`/tenants/invites/${token}`);
        setInvite(res.data.invite);
        setEmail(res.data.invite.email || '');
      } catch (err: any) {
        showToast(err.response?.data?.message || 'Invitation link could not be loaded', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    try {
      await api.post(`/tenants/invites/${token}/accept`, {
        fullName,
        email,
        phone,
        panNumber,
        emergencyContact,
        occupation,
        address
      });
      setAccepted(true);
      showToast('Your profile has been linked successfully', 'success');
    } catch (err: any) {
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const details = err.response.data.errors.map((e: any) => `${e.field.replace('body.', '')}: ${e.message}`).join(', ');
        showToast(`Validation failed: ${details}`, 'error');
      } else {
        showToast(err.response?.data?.message || 'Failed to complete invitation', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.08),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_30%)]" />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        
        {accepted ? (
          /* Simplified Full-Width Success View */
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-lg shadow-emerald-500/5">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Invitation Accepted
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Setup Completed!</h2>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                Your profile has been saved. The property manager now has your confirmed occupant information.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
              You can now safely close this browser window or tab.
            </div>
          </div>
        ) : (
          /* Form Entry View */
          <div className="w-full max-w-4xl grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
                    <Building2 className="w-5 h-5" />
                  </div>
                  Property Manager
                </div>

                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    Secure Verification Link
                  </div>
                  <h1 className="text-3xl font-black tracking-tight text-slate-900">Complete your tenant profile</h1>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Confirm your background details below to complete your check-in registration. This setup links your verified record directly with your host's property ecosystem.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Manager / Owner</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{invite?.owner?.fullName || 'Property Owner'}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Verification ID</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{invite?.aadhaarNumber || 'Linked secure reference'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Your Details</h2>
              <p className="text-sm text-slate-500 mb-6">Please fill out your current contact and verification info.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Enter your official full name"
                      required
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Invitation Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        readOnly
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-sm outline-none text-slate-500 cursor-not-allowed select-none"
                        title="Email is fixed to the address where the invite was sent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">PAN Card Number</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder-slate-400"
                      placeholder="e.g. ABCDE1234F"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Mobile Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Contact number"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Emergency Contact</label>
                    <input
                      type="number"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Family member / Guardian"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Occupation</label>
                    <input
                      type="text"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="e.g. Professional, Student"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Permanent Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Home town address"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving and link processing...
                    </>
                  ) : (
                    'Submit & Complete Profile Link'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}