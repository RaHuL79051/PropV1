import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { serialize, buildFullAddress } from '../utils/serialize';
import PDFDocument from 'pdfkit';

// Agreement access follows the live owner-tenant link, not the tenant record's
// original creator, so tenants who have moved between owners resolve correctly.
const assertAgreementAccess = async (req: AuthenticatedRequest, tenantId: any, action: string) => {
  if (req.user?.role === 'admin') return;
  const connection = await prisma.tenantOwnerConnection.findFirst({
    where: { tenantId, ownerId: req.user?.userId, isDeleted: false }
  });
  if (!connection) {
    throw new AppError(`Unauthorized attempt to ${action}`, 403);
  }
};

export const createAgreement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      tenant,
      property,
      room,
      startDate,
      endDate,
      monthlyRent,
      securityDeposit,
      additionalTerms
    } = req.body;

    const tenantRecord = await prisma.tenant.findUnique({ where: { id: tenant } });
    if (!tenantRecord) {
      throw new AppError('Tenant not found', 404);
    }

    await assertAgreementAccess(req, tenantRecord.id, 'create an agreement for this tenant');

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      throw new AppError('Valid start and end dates are required', 400);
    }
    if (parsedEnd <= parsedStart) {
      throw new AppError('The agreement end date must be after the start date', 400);
    }

    const defaultLeaseSetting = await prisma.setting.findUnique({ where: { key: 'default_lease_terms' } });
    const defaultTerms = defaultLeaseSetting?.value || 'Standard tenancy terms and conditions apply. The tenant agrees to maintain the property in good condition, pay rent by the due date, and adhere to local housing regulations.';

    const agreementId = crypto.randomUUID();
    const agreement = await prisma.agreement.create({
      data: {
        id: agreementId,
        tenantId: tenant,
        propertyId: property,
        roomId: room,
        startDate: parsedStart,
        endDate: parsedEnd,
        monthlyRent,
        securityDeposit,
        termsAndConditions: defaultTerms,
        additionalTerms: additionalTerms || '',
        documentUrl: `/api/agreements/${agreementId}/pdf`,
        status: 'active'
      }
    });

    // Update tenant agreement status
    await prisma.tenant.update({ where: { id: tenantRecord.id }, data: { agreementStatus: 'active' } });

    return res.status(201).json({
      message: 'Rent agreement registered successfully',
      agreement: serialize(agreement)
    });
  } catch (error) {
    next(error);
  }
};

export const getAgreements = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;

    let where: any = {};
    if (req.user?.role !== 'admin') {
      // Find tenants owned by this owner
      const tenantConnections = await prisma.tenantOwnerConnection.findMany({
        where: { ownerId, isDeleted: false },
        select: { tenantId: true }
      });
      const tenantIds = tenantConnections.map((c) => c.tenantId);
      where = { tenantId: { in: tenantIds } };
    }

    const agreements = await prisma.agreement.findMany({
      where,
      include: {
        tenant: { select: { id: true, fullName: true, phone: true } },
        property: { select: { id: true, propertyName: true, address: true } },
        room: { select: { id: true, roomNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(serialize(agreements));
  } catch (error) {
    next(error);
  }
};

export const getAgreementById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const agreement = await prisma.agreement.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, fullName: true, phone: true, ownerId: true } },
        property: { select: { id: true, propertyName: true, address: true } },
        room: { select: { id: true, roomNumber: true } }
      }
    });

    if (!agreement) {
      throw new AppError('Agreement not found', 404);
    }

    await assertAgreementAccess(req, agreement.tenant.id, 'view this agreement');

    return res.status(200).json(serialize(agreement));
  } catch (error) {
    next(error);
  }
};

export const terminateAgreement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const agreement = await prisma.agreement.findUnique({ where: { id }, include: { tenant: true } });

    if (!agreement) {
      throw new AppError('Agreement not found', 404);
    }

    await assertAgreementAccess(req, agreement.tenant?.id, 'terminate this agreement');

    const updated = await prisma.agreement.update({ where: { id }, data: { status: 'expired' } });

    if (agreement.tenant) {
      await prisma.tenant.update({ where: { id: agreement.tenant.id }, data: { agreementStatus: 'expired' } });
    }

    return res.status(200).json({ message: 'Agreement terminated/expired.', agreement: serialize(updated) });
  } catch (error) {
    next(error);
  }
};

export const downloadAgreementPdf = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const agreement = await prisma.agreement.findUnique({
      where: { id },
      include: { tenant: true, property: true, room: true }
    });

    if (!agreement) {
      throw new AppError('Agreement not found', 404);
    }

    // Auth check
    const tenantRecord = agreement.tenant as any;
    if (!tenantRecord) {
      throw new AppError('Tenant associated with agreement not found', 404);
    }

    await assertAgreementAccess(req, tenantRecord.id, 'download this agreement');

    // Set Response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Lease_Agreement_${id}.pdf`);

    const doc = new PDFDocument({ margin: 50 });

    // Stream PDF directly to client response
    doc.pipe(res);

    // Title / Header
    doc.fontSize(20).text('RENTAL LEASE AGREEMENT', { align: 'center', underline: true });
    doc.moveDown(2);

    // Context / Details
    doc.fontSize(12).text(`This agreement is entered into on ${new Date(agreement.createdAt || Date.now()).toLocaleDateString()} by and between the Landlord and Tenant specified below.`, { align: 'justify' });
    doc.moveDown(1.5);

    // Parties
    doc.fontSize(14).text('1. PARTIES', { underline: true });
    doc.fontSize(12).text(`Landlord: Owner of Property [${(agreement.property as any)?.propertyName || 'N/A'}]`);
    doc.text(`Tenant: ${tenantRecord?.fullName || 'N/A'}`);
    doc.text(`Aadhaar Number: ${tenantRecord?.aadhaarNumber || 'N/A'}`);
    doc.text(`Phone: ${tenantRecord?.phone || 'N/A'}`);
    doc.moveDown(1.5);

    // Property details
    doc.fontSize(14).text('2. PREMISES', { underline: true });
    doc.fontSize(12).text(`Property Name: ${(agreement.property as any)?.propertyName || 'N/A'}`);
    doc.text(`Address: ${buildFullAddress(((agreement.property as any)?.address || {}) as any) || 'N/A'}`);
    doc.text(`Room Assigned: Room No. ${(agreement.room as any)?.roomNumber || 'N/A'}`);
    doc.moveDown(1.5);

    // Term and Dates
    doc.fontSize(14).text('3. TERM OF LEASE', { underline: true });
    doc.fontSize(12).text(`Start Date: ${new Date(agreement.startDate).toLocaleDateString()}`);
    doc.text(`End Date: ${new Date(agreement.endDate).toLocaleDateString()}`);
    doc.moveDown(1.5);

    // Financials
    doc.fontSize(14).text('4. RENT & DEPOSIT DETAILS', { underline: true });
    doc.fontSize(12).text(`Monthly Rent: INR ${agreement.monthlyRent}/- (Rupees ${(agreement.monthlyRent).toLocaleString()})`);
    doc.text(`Security Deposit: INR ${agreement.securityDeposit}/- (Rupees ${(agreement.securityDeposit).toLocaleString()})`);
    doc.moveDown(1.5);

    // Terms
    doc.fontSize(14).text('5. TERMS & CONDITIONS', { underline: true });
    doc.fontSize(11).text(agreement.termsAndConditions || 'Standard tenancy terms and conditions apply.', { align: 'justify' });
    doc.moveDown(1.5);

    if (agreement.additionalTerms) {
      doc.fontSize(14).text('6. ADDITIONAL COVENANTS', { underline: true });
      doc.fontSize(11).text(agreement.additionalTerms, { align: 'justify' });
      doc.moveDown(1.5);
    }

    // Signatures
    doc.fontSize(12);
    const startY = doc.y;
    doc.text('_______________________', 50, startY);
    doc.text('Landlord Signature', 50, startY + 15);

    doc.text('_______________________', 350, startY);
    doc.text('Tenant Signature', 350, startY + 15);

    // Finalize
    doc.end();

  } catch (error) {
    next(error);
  }
};

export const deleteAgreement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const agreement = await prisma.agreement.findUnique({ where: { id } });

    if (!agreement) {
      throw new AppError('Agreement not found', 404);
    }

    // Auth check
    const tenantRecord = await prisma.tenant.findUnique({ where: { id: agreement.tenantId } });
    if (!tenantRecord) {
      throw new AppError('Tenant associated with agreement not found', 404);
    }

    await assertAgreementAccess(req, tenantRecord.id, 'delete this agreement');

    // Reset tenant agreementStatus to pending
    await prisma.tenant.update({ where: { id: tenantRecord.id }, data: { agreementStatus: 'pending' } });

    await prisma.agreement.delete({ where: { id } });

    return res.status(200).json({
      message: 'Agreement deleted successfully and tenant agreement status reset to pending.'
    });
  } catch (error) {
    next(error);
  }
};
