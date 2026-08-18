/**
 * Academic Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * REST endpoints for public/authenticated academic taxonomy tree retrieval.
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const academicTaxonomyController = require('../controllers/admin/academicTaxonomyController');

// @desc    Get the academic taxonomy tree
// @route   GET /api/academic/taxonomy or /api/academic/tree
router.get('/taxonomy', auth, academicTaxonomyController.getTaxonomyTree);
router.get('/tree', auth, academicTaxonomyController.getTaxonomyTree);

module.exports = router;
