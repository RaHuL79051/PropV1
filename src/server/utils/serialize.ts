// The frontend was built against Mongoose's JSON shape: every document (and every
// populated sub-document) carries `_id`, and an un-populated reference field holds
// a plain id string under its own name (e.g. `property.owner` is either the raw id
// or, once populated, the full user object). Prisma instead returns `id` and keeps
// the foreign key on a separate `xxxId` column alongside an optionally-included
// `xxx` relation object. This helper re-shapes Prisma results back into that same
// contract so the frontend needed no changes for the database swap.

type AnyObj = Record<string, any>;

// Foreign-key column name -> the relation field name Mongoose used to expose it as.
const RELATION_FK_FIELDS: Record<string, string> = {
  ownerId: 'owner',
  propertyId: 'property',
  roomId: 'room',
  tenantId: 'tenant',
  bedId: 'bed',
  assignedPropertyId: 'assignedProperty',
  assignedRoomId: 'assignedRoom',
  assignedBedId: 'assignedBed',
  acceptedTenantId: 'acceptedTenant',
  recipientId: 'recipient',
  requesterId: 'requester'
};

const isPlainObject = (v: any): v is AnyObj =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);

export const buildFullAddress = (addr: AnyObj): string => {
  const parts = [addr.flatNo, addr.area, addr.landmark, addr.city, addr.state, addr.pincode].filter(
    (p: any) => typeof p === 'string' && p.trim()
  );
  return parts.join(', ');
};

export const serialize = (value: any): any => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (!isPlainObject(value)) return value;

  const out: AnyObj = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key === 'id') {
      out._id = raw;
      continue;
    }

    const relationField = RELATION_FK_FIELDS[key];
    if (relationField) {
      // If the related record was included in the query it is serialized under
      // its own key below; otherwise expose the bare id under the relation name,
      // matching an un-populated Mongoose reference.
      if (!Object.prototype.hasOwnProperty.call(value, relationField)) {
        out[relationField] = raw;
      }
      continue;
    }

    out[key] = serialize(raw);
  }

  if (isPlainObject(out.address)) {
    out.fullAddress = buildFullAddress(out.address);
  }

  return out;
};
