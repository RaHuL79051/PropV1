import { Response, NextFunction } from 'express';
import Agreement from '../models/Agreement.js';
import Tenant from '../models/Tenant.js';
import Setting from '../models/Setting.js';
import TenantOwnerConnection from '../models/TenantOwnerConnection.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';

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

    const tenantRecord = await Tenant.findById(tenant);
    if (!tenantRecord) {
      throw new AppError('Tenant not found', 404);
    }

    const defaultLeaseSetting = await Setting.findOne({ key: 'default_lease_terms' });
    const defaultTerms = defaultLeaseSetting?.value || 'Standard tenancy terms and conditions apply. The tenant agrees to maintain the property in good condition, pay rent by the due date, and adhere to local housing regulations.';

    const agreement = new Agreement({
      tenant,
      property,
      room,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      monthlyRent,
      securityDeposit,
      termsAndConditions: defaultTerms,
      additionalTerms: additionalTerms || '',
      status: 'active'
    });

    agreement.documentUrl = `/api/agreements/${agreement._id}/pdf`;
    await agreement.save();

    // Update tenant agreement status
    tenantRecord.agreementStatus = 'active';
    await tenantRecord.save();

    return res.status(201).json({
      message: 'Rent agreement registered successfully',
      agreement
    });
  } catch (error) {
    next(error);
  }
};

export const getAgreements = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;

    // Direct check if admin or owner
    let agreements;
    if (req.user?.role === 'admin') {
      agreements = await Agreement.find()
        .populate('tenant', 'fullName phone')
        .populate('property', 'propertyName address')
        .populate('room', 'roomNumber');
    } else {
      // Find tenants owned by this owner
      const tenantConnections = await TenantOwnerConnection.find({ owner: ownerId, isDeleted: false }).select('tenant');
      const tenantIds = tenantConnections.map(c => c.tenant);

      agreements = await Agreement.find({ tenant: { $in: tenantIds } })
        .populate('tenant', 'fullName phone')
        .populate('property', 'propertyName address')
        .populate('room', 'roomNumber');
    }

    return res.status(200).json(agreements);
  } catch (error) {
    next(error);
  }
};

export const getAgreementById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const agreement = await Agreement.findById(id)
      .populate('tenant', 'fullName phone owner')
      .populate('property', 'propertyName address')
      .populate('room', 'roomNumber');

    if (!agreement) {
      throw new AppError('Agreement not found', 404);
    }

    // Auth check
    const tenantOwner = (agreement.tenant as any).owner.toString();
    if (req.user?.role !== 'admin' && tenantOwner !== req.user?.userId) {
      throw new AppError('Unauthorized access to agreement details', 403);
    }

    return res.status(200).json(agreement);
  } catch (error) {
    next(error);
  }
};

export const terminateAgreement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const agreement = await Agreement.findById(id).populate('tenant');

    if (!agreement) {
      throw new AppError('Agreement not found', 404);
    }

    agreement.status = 'expired';
    await agreement.save();

    if (agreement.tenant) {
      const tenantRecord = await Tenant.findById(agreement.tenant._id);
      if (tenantRecord) {
        tenantRecord.agreementStatus = 'expired';
        await tenantRecord.save();
      }
    }

    return res.status(200).json({ message: 'Agreement terminated/expired.', agreement });
  } catch (error) {
    next(error);
  }
};

export const downloadAgreementPdf = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const agreement = await Agreement.findById(id)
      .populate('tenant')
      .populate('property')
      .populate('room');

    if (!agreement) {
      throw new AppError('Agreement not found', 404);
    }

    // Auth check
    const tenantRecord = agreement.tenant as any;
    if (!tenantRecord) {
      throw new AppError('Tenant associated with agreement not found', 404);
    }
    
    if (req.user?.role !== 'admin' && tenantRecord.owner.toString() !== req.user?.userId) {
      throw new AppError('Unauthorized access to agreement PDF', 403);
    }

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
    doc.text(`Address: ${(agreement.property as any)?.address || 'N/A'}`);
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
    const agreement = await Agreement.findById(id);

    if (!agreement) {
      throw new AppError('Agreement not found', 404);
    }

    // Auth check
    const tenantRecord = await Tenant.findById(agreement.tenant);
    if (!tenantRecord) {
      throw new AppError('Tenant associated with agreement not found', 404);
    }

    if (req.user?.role !== 'admin' && tenantRecord.owner.toString() !== req.user?.userId) {
      throw new AppError('Unauthorized to delete this agreement', 403);
    }

    // Reset tenant agreementStatus to pending
    tenantRecord.agreementStatus = 'pending';
    await tenantRecord.save();

    await Agreement.findByIdAndDelete(id);

    return res.status(200).json({
      message: 'Agreement deleted successfully and tenant agreement status reset to pending.'
    });
  } catch (error) {
    next(error);
  }
};
