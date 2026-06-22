const express = require('express');
const router = express.Router();
console.log("   [Routes] Loading tripRoutes.js");
const {
  getTrips,
  getTrip,
  getTripBySlug,
  createTrip,
  updateTrip,
  deleteTrip,
  shuffleTrips,
  bulkUpdateTripOrder,
  seedLiveData
} = require('../controllers/tripController');
const { authenticate, requirePermission, enforceOwnership } = require('../middleware/auth');
const { stripFinancialFieldsForGuides } = require('../middleware/financialStripper');

// Public routes
router.get('/', (req, res, next) => {
  // If authorization header is present, authenticate to apply financial fields stripping for guides
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
}, stripFinancialFieldsForGuides, getTrips);

router.get('/seed/live-data', seedLiveData);

router.get('/slug/:slug', (req, res, next) => {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
}, stripFinancialFieldsForGuides, getTripBySlug);

router.get('/:id', (req, res, next) => {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  next();
}, (req, res, next) => {
  if (req.user) {
    return enforceOwnership('trip')(req, res, next);
  }
  next();
}, stripFinancialFieldsForGuides, getTrip);

// Admin routes
router.post('/', authenticate, requirePermission('trips.create'), createTrip);
router.post('/shuffle', authenticate, requirePermission('trips.edit'), shuffleTrips);
router.post('/bulk-order', authenticate, requirePermission('trips.edit'), bulkUpdateTripOrder);
router.put('/:id', authenticate, requirePermission('trips.edit'), enforceOwnership('trip'), updateTrip);
router.delete('/:id', authenticate, requirePermission('trips.delete'), enforceOwnership('trip'), deleteTrip);

module.exports = router;
