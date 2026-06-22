const express = require('express');
const router = express.Router();
const { 
  getPublishedLayout, getDraftLayout, updateAllSections, 
  updateSection, reorderSections, toggleSectionVisibility, publishLayout,
  duplicateSection
} = require('../controllers/pageBuilderController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.get('/:name', getPublishedLayout);
router.get('/:name/draft', authenticate, requirePermission('pagebuilder.view'), getDraftLayout);
router.put('/:name/sections', authenticate, requirePermission('pagebuilder.edit'), updateAllSections);
router.patch('/:name/sections/:sectionId', authenticate, requirePermission('pagebuilder.edit'), updateSection);
router.patch('/:name/sections/reorder', authenticate, requirePermission('pagebuilder.edit'), reorderSections);
router.patch('/:name/sections/:sectionId/toggle', authenticate, requirePermission('pagebuilder.edit'), toggleSectionVisibility);
router.post('/:name/sections/duplicate/:sectionId', authenticate, requirePermission('pagebuilder.edit'), duplicateSection);
router.post('/:name/publish', authenticate, requirePermission('pagebuilder.edit'), publishLayout);

module.exports = router;
