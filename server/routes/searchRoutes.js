const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const searchController = require('../controllers/searchController');

router.get('/categories', auth, searchController.categories);
router.get('/', auth, searchController.search);

module.exports = router;