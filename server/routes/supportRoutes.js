const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const supportController = require('../controllers/supportController');
const { writeLimiter } = require('../middleware/rateLimiters');

router.use(auth);

router.post('/', writeLimiter, supportController.createTicket);
router.get('/', supportController.getMyTickets);
router.get('/:ticketId', supportController.getTicketDetails);
router.post('/:ticketId/reply', writeLimiter, supportController.replyToTicket);
router.delete('/:ticketId', writeLimiter, supportController.deleteTicket);

module.exports = router;
