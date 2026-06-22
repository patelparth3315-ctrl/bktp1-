const { prisma } = require('../lib/prisma');
const { logAction } = require('../utils/auditLogger');

/**
 * @desc    Submit inquiry (Public / Link attribution)
 * @route   POST /api/inquiries
 * @access  Public
 */
exports.createInquiry = async (req, res, next) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const { phone, tripId, sourceBookingLinkId } = req.body;
    
    // Check for duplicates in the last 48 hours
    const duplicate = await prisma.inquiry.findFirst({
      where: {
        phone,
        tripId,
        tenantId,
        createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
      }
    });

    // Resolve salesAdminId attribution
    let salesAdminId = null;
    if (sourceBookingLinkId) {
      const link = await prisma.bookingLink.findUnique({
        where: { id: sourceBookingLinkId }
      });
      if (link) {
        salesAdminId = link.createdByAdminId;
      }
    } else if (req.user) {
      if (req.user.role === 'sales') {
        salesAdminId = req.user.id;
      } else if (req.body.salesAdminId) {
        salesAdminId = req.body.salesAdminId;
      }
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        message: req.body.message,
        tripId: req.body.tripId,
        tripTitle: req.body.tripTitle,
        date: req.body.date,
        source: req.body.source,
        adminNotes: `Source: ${req.body.source || 'Unknown'}`,
        tenantId,
        salesAdminId,
        count: req.body.count ? parseInt(req.body.count) : undefined
      }
    });

    res.status(201).json({ success: true, data: inquiry, isDuplicate: !!duplicate });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all inquiries (Scoped by tenantId)
 * @route   GET /api/inquiries
 * @access  Private/Admin
 */
exports.getInquiries = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { status } = req.query;

    const where = { tenantId };
    if (status) where.status = status;

    // Apply sales constraint
    if (req.user?.role === 'sales') {
      where.salesAdminId = req.user.id;
    }

    const inquiries = await prisma.inquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const mappedInquiries = inquiries.map(inq => ({
      ...inq,
      read: inq.status !== 'new'
    }));

    res.json({
      success: true,
      count: mappedInquiries.length,
      data: mappedInquiries
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update inquiry status/notes
 * @route   PATCH /api/inquiries/:id/status
 * @access  Private/Admin
 */
exports.updateInquiryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const { status, adminNotes } = req.body;

    const where = { id, tenantId };
    if (req.user?.role === 'sales') {
      where.salesAdminId = req.user.id;
    }

    const beforeInquiry = await prisma.inquiry.findFirst({ where });
    if (!beforeInquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    await prisma.inquiry.updateMany({
      where,
      data: { status, adminNotes }
    });

    res.json({ success: true, message: 'Inquiry updated' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single inquiry
 * @route   GET /api/inquiries/:id
 */
exports.getInquiry = async (req, res, next) => {
  try {
    const where = { id: req.params.id, tenantId: req.user.tenantId };
    if (req.user?.role === 'sales') {
      where.salesAdminId = req.user.id;
    }

    const inquiry = await prisma.inquiry.findFirst({ where });
    if (!inquiry) return res.status(404).json({ success: false, message: 'Inquiry not found' });
    
    const mappedInquiry = {
      ...inquiry,
      read: inquiry.status !== 'new'
    };

    res.json({ success: true, data: mappedInquiry });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete inquiry
 * @route   DELETE /api/inquiries/:id
 */
exports.deleteInquiry = async (req, res, next) => {
  try {
    const where = { id: req.params.id, tenantId: req.user.tenantId };
    if (req.user?.role === 'sales') {
      where.salesAdminId = req.user.id;
    }

    const inquiry = await prisma.inquiry.findFirst({ where });
    if (!inquiry) return res.status(404).json({ success: false, message: 'Inquiry not found' });

    await prisma.inquiry.deleteMany({ where });
    res.json({ success: true, message: 'Inquiry deleted' });
  } catch (error) {
    next(error);
  }
};
