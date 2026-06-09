export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'admin' | 'owner';
  isActive: boolean;
  status: 'pending' | 'approved' | 'rejected';
  paidBeds?: number;
  createdAt: string;
}

export interface PropertyAddress {
  pincode: string;
  flatNo: string;
  area: string;
  landmark: string;
  city: string;
  state: string;
}

export interface Property {
  _id: string;
  propertyName: string;
  address: PropertyAddress;
  fullAddress?: string;
  description: string;
  images: string[];
  totalRooms: number;
  owner: any;
  createdAt: string;
}

export interface Room {
  _id: string;
  property: string;
  roomNumber: string;
  bedCapacity: number;
  occupancyStatus: 'vacant' | 'partially_occupied' | 'fully_occupied';
  monthlyRent: number;
  roomType?: 'flat' | 'pg';
  flatCategory?: string;
  propertyType?: string[];
  preferredTenant?: string[];
  furnishedType?: string;
  createdAt: string;
  beds?: any[];
}

export interface Bed {
  _id: string;
  room: string;
  bedNumber: string;
  tenant: any;
  isOccupied: boolean;
}

export interface Tenant {
  _id: string;
  fullName: string;
  aadhaarNumber: string;
  email?: string;
  phone: string;
  emergencyContact: string;
  occupation: string;
  address: string;
  agreementStatus: 'pending' | 'active' | 'expired';
  verificationStatus: 'pending' | 'verified' | 'failed';
  tenantRating: number;
  creditScore?: number;
  riskLevel: 'low' | 'medium' | 'high';
  previousOwnerFeedback: string[];
  rentAmount?: number | null;
  assignedProperty: {
    _id: string;
    propertyName: string;
    address: PropertyAddress;
    fullAddress?: string;
  } | null;
  assignedRoom: {
    _id: string;
    roomNumber: string;
    monthlyRent: number;
  } | null;
  assignedBed: {
    _id: string;
    bedNumber: string;
  } | null;
  documents?: {
    aadhaarDocName?: string;
    aadhaarDocData?: string;
    agreementDocName?: string;
    agreementDocData?: string;
    photoDocName?: string;
    photoDocData?: string;
  };
  additionalCharges?: {
    _id: string;
    description: string;
    amount: number;
    createdAt?: string;
  }[];
  createdAt: string;
}

export interface Agreement {
  _id: string;
  tenant: {
    _id: string;
    fullName: string;
    phone: string;
  };
  property: {
    _id: string;
    propertyName: string;
    address: PropertyAddress;
    fullAddress?: string;
  };
  room: {
    _id: string;
    roomNumber: string;
  };
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  termsAndConditions: string;
  additionalTerms?: string;
  documentUrl: string;
  status: 'pending' | 'active' | 'expired';
  createdAt: string;
}

export interface Payment {
  _id: string;
  tenant: {
    _id: string;
    fullName: string;
    phone: string;
  };
  property: {
    _id: string;
    propertyName: string;
  };
  room: {
    _id: string;
    roomNumber: string;
  };
  amount: number;
  dueDate: string;
  paymentDate: string | null;
  status: 'paid' | 'unpaid' | 'overdue';
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'none';
  transactionId: string | null;
  notes?: string;
}

export interface MaintenanceRequest {
  _id: string;
  property: {
    _id: string;
    propertyName: string;
  };
  room: {
    _id: string;
    roomNumber: string;
  };
  tenant: {
    _id: string;
    fullName: string;
    phone: string;
  };
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'resolved';
  images: string[];
  createdAt: string;
}

export interface VerificationLog {
  _id: string;
  aadhaarNumber: string;
  requester: {
    _id: string;
    fullName: string;
    email: string;
  };
  timestamp: string;
  result: {
    fullName: string;
    previousRating: number;
    riskLevel: 'low' | 'medium' | 'high';
    verificationStatus: 'verified' | 'failed';
    paymentHistory: string;
    feedback: string[];
  };
  riskLevel: 'low' | 'medium' | 'high';
  status: 'verified' | 'failed';
  searchCriteria?: {
    aadhaarNumber?: string;
    panNumber?: string;
    phone?: string;
    fullName?: string;
  };
  operator?: 'and' | 'or';
  createdAt: string;
}
