import { z } from 'zod';

/**
 * Field builders.
 *
 * Every message names the field and says exactly what is wrong, so a value that
 * is present but too short never reports itself as "required". Where a field has
 * both a "must not be empty" and a "must be at least N characters" rule, both
 * issues can fire at once; the validate middleware reports only the first issue
 * per field, so the user sees the most relevant one.
 */

const requiredText = (label: string, minLength = 1, unit = 'characters') => {
  let schema = z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be text`
    })
    .trim()
    .min(1, `${label} is required`);

  if (minLength > 1) {
    schema = schema.min(minLength, `${label} must be at least ${minLength} ${unit}`);
  }
  return schema;
};

const optionalText = (label: string) =>
  z
    .string({ invalid_type_error: `${label} must be text` })
    .trim()
    .optional()
    .nullable();

const email = (label = 'Email address') =>
  z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be text`
    })
    .trim()
    .min(1, `${label} is required`)
    .email(`${label} must be a valid email, for example name@example.com`);

// Optional email: an empty string means "not provided".
const optionalEmail = (label = 'Email address') =>
  optionalText(label).refine((v) => !v || z.string().email().safeParse(v).success, {
    message: `${label} must be a valid email, for example name@example.com`
  });

const password = (label = 'Password') =>
  z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be text`
    })
    .min(1, `${label} is required`)
    .min(6, `${label} must be at least 6 characters`);

const phone = (label = 'Phone number') =>
  z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be text`
    })
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => /^[0-9]{10}$/.test(v.replace(/[\s+\-()]/g, '').replace(/^91(?=[0-9]{10}$)/, '')), {
      message: `${label} must be a 10-digit mobile number`
    });

const optionalPhone = (label: string) =>
  optionalText(label).refine(
    (v) => !v || /^[0-9]{10}$/.test(v.replace(/[\s+\-()]/g, '').replace(/^91(?=[0-9]{10}$)/, '')),
    { message: `${label} must be a 10-digit mobile number` }
  );

const aadhaarNumber = z
  .string({
    required_error: 'Aadhaar number is required',
    invalid_type_error: 'Aadhaar number must be text'
  })
  .trim()
  .min(1, 'Aadhaar number is required')
  .refine((v) => /^[0-9]+$/.test(v), { message: 'Aadhaar number must contain digits only' })
  .refine((v) => v.length === 12, { message: 'Aadhaar number must be exactly 12 digits' });

// PAN is optional everywhere; an empty string means "not provided".
const optionalPanNumber = optionalText('PAN number').refine((v) => !v || v.length === 10, {
  message: 'PAN number must be exactly 10 characters, for example ABCDE1234F'
});

// Mongo ObjectId. Validating here turns what would be a 500 CastError deeper in
// the stack into a clear 400 naming the field.
const objectId = (label: string) =>
  z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be text`
    })
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => /^[0-9a-fA-F]{24}$/.test(v), { message: `${label} is not a valid reference` });

const optionalObjectId = (label: string) =>
  z
    .string({ invalid_type_error: `${label} must be text` })
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || /^[0-9a-fA-F]{24}$/.test(v), {
      message: `${label} is not a valid reference`
    });

const money = (label: string, { allowZero = true } = {}) =>
  z.coerce
    .number({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be a number`
    })
    .refine((v) => Number.isFinite(v), { message: `${label} must be a number` })
    .refine((v) => (allowZero ? v >= 0 : v > 0), {
      message: allowZero ? `${label} cannot be negative` : `${label} must be greater than zero`
    });

const dateString = (label: string) =>
  z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be a date`
    })
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => !isNaN(new Date(v).getTime()), {
      message: `${label} must be a valid date`
    });

const optionalDateString = (label: string) =>
  z
    .string({ invalid_type_error: `${label} must be a date` })
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || !isNaN(new Date(v).getTime()), {
      message: `${label} must be a valid date`
    });

// Enums spell out the accepted values instead of leaking Zod's raw text.
// Zod rejects errorMap alongside required_error/invalid_type_error, so the
// "missing" case is distinguished inside the map itself.
const choice = <T extends readonly [string, ...string[]]>(label: string, values: T) =>
  z.enum(values, {
    errorMap: (issue, ctx) => {
      if (ctx.data === undefined || ctx.data === null || ctx.data === '') {
        return { message: `${label} is required` };
      }
      return { message: `${label} must be one of: ${values.join(', ')}` };
    }
  });

/* ------------------------------------------------------------------ auth --- */

export const registerSchema = z.object({
  body: z.object({
    fullName: requiredText('Full name', 2),
    email: email(),
    phone: phone(),
    password: password()
  })
});

export const adminCreateUserSchema = z.object({
  body: z.object({
    fullName: requiredText('Full name', 2),
    email: email(),
    phone: phone(),
    password: password(),
    role: choice('Role', ['admin', 'owner'] as const).default('owner')
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: email(),
    password: z
      .string({ required_error: 'Password is required', invalid_type_error: 'Password must be text' })
      .min(1, 'Password is required')
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: email()
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: requiredText('Reset token'),
    newPassword: password('New password')
  })
});

/* -------------------------------------------------------------- property --- */

// The owner dashboard posts a structured address object, while the admin
// dashboard still posts a single free-text line. Accept both shapes.
const structuredAddressSchema = z
  .object({
    pincode: optionalText('Pincode'),
    flatNo: optionalText('Flat / house number'),
    area: optionalText('Area'),
    landmark: optionalText('Landmark'),
    city: optionalText('Town / city'),
    state: optionalText('State')
  })
  .superRefine((addr, ctx) => {
    const missing: string[] = [];
    if (!addr.pincode?.trim()) missing.push('pincode');
    if (!addr.city?.trim()) missing.push('town / city');
    if (!addr.state?.trim()) missing.push('state');
    if (missing.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Property address needs a ${missing.join(', ')}`
      });
    } else if (!/^[0-9]{6}$/.test(addr.pincode!.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pincode must be 6 digits' });
    }
  });

export const propertySchema = z.object({
  body: z.object({
    propertyName: requiredText('Property name', 2),
    address: z.union([requiredText('Property address', 5), structuredAddressSchema], {
      // Reached only when the value is neither a string nor an object; Zod's
      // own fallback here is the unhelpful "Invalid input".
      errorMap: (issue, ctx) => {
        if (ctx.data === undefined || ctx.data === null || ctx.data === '') {
          return { message: 'Property address is required' };
        }
        if (issue.code === z.ZodIssueCode.invalid_union) {
          return {
            message:
              'Property address must be either a full address line, or an address with pincode, town / city and state'
          };
        }
        return { message: ctx.defaultError };
      }
    }),
    description: optionalText('Description'),
    images: z.array(z.string()).optional(),
    totalRooms: z.coerce
      .number({ invalid_type_error: 'Total rooms must be a number' })
      .int('Total rooms must be a whole number')
      .min(0, 'Total rooms cannot be negative')
      .max(200, 'Total rooms cannot exceed 200')
      .default(0)
      .optional(),
    roomType: choice('Room type', ['flat', 'pg'] as const).optional(),
    ownerId: optionalObjectId('Owner')
  })
});

export const roomSchema = z.object({
  body: z.object({
    roomNumber: requiredText('Room number'),
    bedCapacity: z.coerce
      .number({
        required_error: 'Bed capacity is required',
        invalid_type_error: 'Bed capacity must be a number'
      })
      .int('Bed capacity must be a whole number')
      .min(1, 'Bed capacity must be at least 1')
      .max(50, 'Bed capacity cannot exceed 50'),
    monthlyRent: money('Monthly rent'),
    roomType: choice('Room type', ['flat', 'pg'] as const)
      .optional()
      .default('pg'),
    flatCategory: optionalText('Flat category'),
    propertyType: z.array(z.string()).optional(),
    preferredTenant: z.array(z.string()).optional(),
    furnishedType: optionalText('Furnishing type')
  })
});

/* ---------------------------------------------------------------- tenant --- */

export const tenantSchema = z.object({
  body: z.object({
    fullName: requiredText('Tenant name', 2),
    aadhaarNumber,
    panNumber: optionalPanNumber,
    email: optionalEmail('Tenant email'),
    phone: phone(),
    emergencyContact: optionalPhone('Emergency contact'),
    occupation: optionalText('Occupation'),
    address: requiredText('Permanent address', 5),
    joiningDate: optionalDateString('Joining date'),
    // Optional allocation supplied when a tenant is registered straight into a bed
    assignedProperty: optionalObjectId('Property'),
    assignedRoom: optionalObjectId('Room'),
    assignedBed: optionalObjectId('Bed'),
    rentAmount: money('Rent amount').optional().nullable(),
    ownerId: optionalObjectId('Owner')
  })
});

export const tenantInviteSchema = z.object({
  body: z.object({
    aadhaarNumber,
    panNumber: optionalPanNumber,
    email: optionalEmail('Tenant email'),
    sendMethod: choice('Send method', ['email', 'whatsapp'] as const).optional(),
    whatsappNumber: optionalPhone('WhatsApp number'),
    joiningDate: optionalDateString('Joining date'),
    // The bed the invited tenant will occupy once they accept
    assignedProperty: optionalObjectId('Property'),
    assignedRoom: optionalObjectId('Room'),
    assignedBed: optionalObjectId('Bed'),
    rentAmount: money('Rent amount').optional().nullable(),
    ownerId: optionalObjectId('Owner')
  })
});

export const acceptTenantInviteSchema = z.object({
  body: z.object({
    fullName: requiredText('Full name', 2),
    email: email('Email address'),
    phone: phone(),
    panNumber: optionalPanNumber,
    emergencyContact: optionalPhone('Emergency contact'),
    occupation: optionalText('Occupation'),
    address: requiredText('Permanent address', 5)
  })
});

export const tenantChargeSchema = z.object({
  body: z.object({
    description: requiredText('Charge description', 2),
    amount: money('Charge amount', { allowZero: false })
  })
});

export const checkoutSchema = z.object({
  body: z.object({
    rating: z.coerce
      .number({
        required_error: 'Rating is required',
        invalid_type_error: 'Rating must be a number'
      })
      .int('Rating must be a whole number')
      .min(1, 'Rating must be between 1 and 5')
      .max(5, 'Rating must be between 1 and 5'),
    feedback: requiredText('Feedback', 5)
  })
});

/* ------------------------------------------------------------- agreement --- */

export const agreementSchema = z.object({
  body: z
    .object({
      tenant: objectId('Tenant'),
      property: objectId('Property'),
      room: objectId('Room'),
      startDate: dateString('Start date'),
      endDate: dateString('End date'),
      monthlyRent: money('Monthly rent'),
      securityDeposit: money('Security deposit'),
      termsAndConditions: optionalText('Terms and conditions'),
      additionalTerms: optionalText('Additional terms'),
      documentUrl: optionalText('Document URL')
    })
    .superRefine((body, ctx) => {
      const start = new Date(body.startDate);
      const end = new Date(body.endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'End date must be after the start date'
        });
      }
    })
});

/* --------------------------------------------------------------- payment --- */

export const paymentSchema = z.object({
  body: z.object({
    tenant: objectId('Tenant'),
    property: objectId('Property'),
    room: objectId('Room'),
    amount: money('Invoice amount', { allowZero: false }),
    dueDate: dateString('Due date')
  })
});

export const paySchema = z.object({
  body: z.object({
    paymentMethod: choice('Payment method', ['cash', 'upi', 'card', 'bank_transfer'] as const),
    transactionId: optionalText('Transaction ID')
  })
});

/* ----------------------------------------------------------- maintenance --- */

export const maintenanceRequestSchema = z.object({
  body: z.object({
    property: objectId('Property'),
    room: objectId('Room'),
    tenant: objectId('Tenant'),
    title: requiredText('Issue title', 2),
    description: requiredText('Issue description', 5),
    priority: choice('Priority', ['low', 'medium', 'high'] as const).default('medium')
  })
});

export const maintenanceStatusSchema = z.object({
  body: z.object({
    status: choice('Ticket status', ['pending', 'in_progress', 'resolved'] as const)
  })
});

/* --------------------------------------------------------------- expense --- */

export const EXPENSE_CATEGORIES = [
  'Food',
  'Travel',
  'Utilities/Bill',
  'Maintenance',
  'Salary',
  'Taxes',
  'Insurance',
  'Marketing',
  'Office',
  'Miscellaneous',
  'Other'
] as const;

export const expenseSchema = z.object({
  body: z.object({
    date: dateString('Expense date'),
    category: choice('Category', EXPENSE_CATEGORIES),
    amount: money('Expense amount', { allowZero: false }),
    description: optionalText('Description').default('')
  })
});

/* ---------------------------------------------------------------- owners --- */

export const ownerStatusSchema = z.object({
  body: z.object({
    status: choice('Status', ['approved', 'rejected'] as const)
  })
});

export const settingSchema = z.object({
  body: z.object({
    value: requiredText('Setting value'),
    description: optionalText('Description')
  })
});

export const connectionActivateSchema = z.object({
  body: z.object({
    aadhaarNumber
  })
});

export const verifyAadhaarSchema = z.object({
  body: z
    .object({
      aadhaarNumber: optionalText('Aadhaar number'),
      panNumber: optionalText('PAN number'),
      phone: optionalText('Phone number'),
      fullName: optionalText('Name'),
      operator: choice('Match mode', ['and', 'or'] as const).optional()
    })
    .superRefine((body, ctx) => {
      const hasAny = [body.aadhaarNumber, body.panNumber, body.phone, body.fullName].some((v) =>
        Boolean(v && v.trim())
      );
      if (!hasAny) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter at least one of Aadhaar number, PAN number, phone number or name to search'
        });
        return;
      }
      if (body.aadhaarNumber?.trim() && !/^[0-9]{12}$/.test(body.aadhaarNumber.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['aadhaarNumber'],
          message: 'Aadhaar number must be exactly 12 digits'
        });
      }
      if (body.panNumber?.trim() && body.panNumber.trim().length !== 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['panNumber'],
          message: 'PAN number must be exactly 10 characters, for example ABCDE1234F'
        });
      }
    })
});

export const tenantDocumentsSchema = z.object({
  body: z
    .object({
      aadhaarDocName: optionalText('Aadhaar document name'),
      aadhaarDocData: optionalText('Aadhaar document'),
      agreementDocName: optionalText('Agreement document name'),
      agreementDocData: optionalText('Agreement document'),
      photoDocName: optionalText('Photo name'),
      photoDocData: optionalText('Photo')
    })
    .superRefine((body, ctx) => {
      const provided = Object.values(body).some((v) => v !== undefined);
      if (!provided) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'No document was provided to upload' });
      }
    })
});
