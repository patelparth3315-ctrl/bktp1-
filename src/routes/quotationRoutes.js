const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { authenticate, requirePermission } = require('../middleware/auth');

// @desc    Get all quotations
// @route   GET /api/quotations
router.get('/', authenticate, requirePermission('quotations.view'), async (req, res, next) => {
  try {
    const where = { tenantId: req.user.tenantId };
    
    // Ownership gating for sales role
    if (req.user?.role === 'sales') {
      where.salesAdminId = req.user.id;
    }

    const quotations = await prisma.quotation.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    
    const formatted = quotations.map(q => ({
      ...(typeof q.data === 'object' ? q.data : {}),
      id: q.id,
      title: q.title,
      status: q.status,
      clientName: q.clientName,
      totalAmount: q.totalAmount,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
});

// @desc    Get single quotation by ID or Slug
router.get('/:idOrSlug', async (req, res, next) => {
  const { idOrSlug } = req.params;
  
  // Publicly readable quotation details (e.g. for sharing URLs)
  // If authorization header exists, authenticate first to apply potential sales checks
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
}, async (req, res, next) => {
  const { idOrSlug } = req.params;
  try {
    const where = {
      OR: [ { id: idOrSlug }, { slug: idOrSlug }, { title: idOrSlug } ]
    };

    const quotation = await prisma.quotation.findFirst({
      where
    });
    
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    // Gated check if logged in as admin/sales
    if (req.user) {
      if (req.user.role === 'sales' && quotation.salesAdminId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Quotation not found' });
      }
    }

    res.json({ 
      success: true, 
      data: {
        ...(typeof quotation.data === 'object' ? quotation.data : {}),
        id: quotation.id,
        title: quotation.title,
        status: quotation.status,
        clientName: quotation.clientName,
        totalAmount: quotation.totalAmount
      } 
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Create or Update quotation
// @route   POST /api/quotations
router.post('/', authenticate, requirePermission('quotations.create'), async (req, res, next) => {
  try {
    const body = req.body;
    const id = body.id;
    
    const finalTitle = body.title || body.tripTitle || 'Untitled Quote';
    const finalClient = body.clientName || body.customerName || 'Guest';
    const finalAmount = Number(body.totalAmount || body.finalPrice || 0);
    const finalStatus = body.status || 'Draft';
    const finalSlug = body.slug || (finalTitle.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 7));

    let quotation;
    const existing = id ? await prisma.quotation.findFirst({ where: { id, tenantId: req.user.tenantId } }) : null;

    if (existing) {
      // Validate sales ownership before editing
      if (req.user?.role === 'sales' && existing.salesAdminId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Quotation not found' });
      }
      if (req.user?.role === 'sales' && body.salesAdminId !== undefined && body.salesAdminId !== existing.salesAdminId) {
        return res.status(403).json({ success: false, message: 'Sales users cannot modify quotation ownership' });
      }

      quotation = await prisma.quotation.update({
        where: { id },
        data: {
          title: finalTitle,
          slug: finalSlug,
          clientName: finalClient,
          totalAmount: finalAmount,
          status: finalStatus,
          data: body
        }
      });
    } else {
      // Creation: Resolve salesAdminId
      let salesAdminId = null;
      if (req.user?.role === 'sales') {
        salesAdminId = req.user.id;
      } else if (body.salesAdminId) {
        salesAdminId = body.salesAdminId;
      }

      quotation = await prisma.quotation.create({
        data: {
          id: id || undefined, 
          title: finalTitle,
          slug: finalSlug,
          clientName: finalClient,
          totalAmount: finalAmount,
          status: finalStatus,
          data: body,
          salesAdminId,
          tenantId: req.user?.tenantId || 'default'
        }
      });
    }

    res.json({ success: true, data: quotation });
  } catch (err) {
    console.error('❌ Quotation Save Error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save quotation', 
      error: err.message
    });
  }
});

// @desc    Delete quotation
// @route   DELETE /api/quotations/:id
router.delete('/:id', authenticate, requirePermission('quotations.edit'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const existing = await prisma.quotation.findFirst({ where: { id, tenantId: req.user.tenantId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    if (req.user?.role === 'sales' && existing.salesAdminId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    await prisma.quotation.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Quotation deleted' });
  } catch (err) {
    next(err);
  }
});

// @desc    Extend quotation validity
// @route   PATCH /api/quotations/:id/extend
router.patch('/:id/extend', authenticate, requirePermission('quotations.edit'), async (req, res, next) => {
  try {
    const { hours } = req.body;
    const { id } = req.params;
    
    const quotation = await prisma.quotation.findFirst({ where: { id, tenantId: req.user.tenantId } });
    if (!quotation) return res.status(404).json({ success: false, message: 'Not found' });

    if (req.user?.role === 'sales' && quotation.salesAdminId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const currentData = quotation.data || {};
    const newExpiry = new Date(new Date().getTime() + (hours || 48) * 60 * 60 * 1000);
    
    const updated = await prisma.quotation.update({
      where: { id },
      data: {
        data: { ...currentData, expiresAt: newExpiry }
      }
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
