import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const adminCreateUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['admin', 'owner']).default('owner'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string(),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const propertySchema = z.object({
  body: z.object({
    propertyName: z.string().min(2, 'Property name is required'),
    address: z.string().min(5, 'Address is required'),
    description: z.string().optional(),
    images: z.array(z.string()).optional(),
    totalRooms: z.coerce.number().min(0).default(0).optional(),
  }),
});

export const roomSchema = z.object({
  body: z.object({
    roomNumber: z.string().min(1, 'Room number is required'),
    bedCapacity: z.coerce.number().min(1, 'Bed capacity must be at least 1'),
    monthlyRent: z.coerce.number().min(0, 'Monthly rent must be non-negative'),
    roomType: z.enum(['flat', 'pg']).optional().default('pg'),
  }),
});

export const tenantSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Name is required'),
    aadhaarNumber: z.string().length(12, 'Aadhaar must be exactly 12 digits'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().min(10, 'Phone is required'),
    emergencyContact: z.string().optional().or(z.literal('')),
    occupation: z.string().optional().or(z.literal('')),
    address: z.string().min(5, 'Address is required'),
    joiningDate: z.string().optional().nullable(),
  }),
});

export const tenantInviteSchema = z.object({
  body: z.object({
    aadhaarNumber: z.string().length(12, 'Aadhaar must be exactly 12 digits'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    sendMethod: z.enum(['email', 'whatsapp']).optional(),
    whatsappNumber: z.string().optional().or(z.literal('')),
    joiningDate: z.string().optional().nullable(),
  }),
});

export const acceptTenantInviteSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Phone is required'),
    emergencyContact: z.string().optional().or(z.literal('')),
    occupation: z.string().optional().or(z.literal('')),
    address: z.string().min(5, 'Address is required'),
  }),
});

export const agreementSchema = z.object({
  body: z.object({
    tenant: z.string(),
    property: z.string(),
    room: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    monthlyRent: z.number().min(0),
    securityDeposit: z.number().min(0),
    termsAndConditions: z.string().optional(),
    additionalTerms: z.string().optional(),
    documentUrl: z.string().optional(),
  }),
});

export const paymentSchema = z.object({
  body: z.object({
    tenant: z.string(),
    property: z.string(),
    room: z.string(),
    amount: z.number().min(0),
    dueDate: z.string(),
  }),
});

export const paySchema = z.object({
  body: z.object({
    paymentMethod: z.enum(['cash', 'upi', 'card', 'bank_transfer']),
    transactionId: z.string().optional(),
  }),
});

export const maintenanceRequestSchema = z.object({
  body: z.object({
    property: z.string(),
    room: z.string(),
    tenant: z.string(),
    title: z.string().min(2, 'Title is required'),
    description: z.string().min(5, 'Description is required'),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
  }),
});

export const expenseSchema = z.object({
  body: z.object({
    date: z.string(),
    category: z.enum(['Food', 'Travel', 'Utilities/Bill', 'Maintenance', 'Salary', 'Taxes', 'Insurance', 'Marketing', 'Office', 'Miscellaneous', 'Other']),
    amount: z.coerce.number().min(0, 'Amount must be non-negative'),
    description: z.string().optional().default(''),
  }),
});
