const communicationsService = require('../../services/admin/adminCommunicationsService');

async function getNotificationAudienceStats(req, res, next) {
  try {
    const data = await communicationsService.getNotificationAudienceStats();
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function listBroadcasts(req, res, next) {
  try {
    const data = await communicationsService.listBroadcasts(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function createBroadcast(req, res, next) {
  try {
    const data = await communicationsService.createBroadcast({
      adminUser: req.user,
      title: req.body.title,
      message: req.body.message,
      audience: req.body.audience,
      priority: req.body.priority,
      channels: req.body.channels,
      scheduledFor: req.body.scheduledFor || null
    });
    return res.json({ success: true, data, message: 'Broadcast created successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function listSupportTickets(req, res, next) {
  try {
    const data = await communicationsService.listSupportTickets(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getSupportTicketDetails(req, res, next) {
  try {
    const data = await communicationsService.getSupportTicketDetails(req.params.ticketId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function updateSupportTicketStatus(req, res, next) {
  try {
    const data = await communicationsService.updateSupportTicketStatus({
      adminUser: req.user,
      ticketId: req.params.ticketId,
      status: req.body.status,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'Support ticket status updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function updateSupportTicketPriority(req, res, next) {
  try {
    const data = await communicationsService.updateSupportTicketPriority({
      adminUser: req.user,
      ticketId: req.params.ticketId,
      priority: req.body.priority,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'Support ticket priority updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function replyToSupportTicket(req, res, next) {
  try {
    const data = await communicationsService.replyToSupportTicket({
      adminUser: req.user,
      ticketId: req.params.ticketId,
      message: req.body.message
    });
    return res.json({ success: true, data, message: 'Support ticket reply sent successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function addSupportTicketNote(req, res, next) {
  try {
    const data = await communicationsService.addSupportTicketNote({
      adminUser: req.user,
      ticketId: req.params.ticketId,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'Support ticket note added successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function listFeedbackEntries(req, res, next) {
  try {
    const data = await communicationsService.listFeedbackEntries(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getFeedbackDetails(req, res, next) {
  try {
    const data = await communicationsService.getFeedbackDetails(req.params.feedbackId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function updateFeedbackStatus(req, res, next) {
  try {
    const data = await communicationsService.updateFeedbackStatus({
      adminUser: req.user,
      feedbackId: req.params.feedbackId,
      status: req.body.status,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'Feedback status updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function addFeedbackNote(req, res, next) {
  try {
    const data = await communicationsService.addFeedbackNote({
      adminUser: req.user,
      feedbackId: req.params.feedbackId,
      note: req.body.note
    });
    return res.json({ success: true, data, message: 'Feedback note added successfully.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getNotificationAudienceStats,
  listBroadcasts,
  createBroadcast,
  listSupportTickets,
  getSupportTicketDetails,
  updateSupportTicketStatus,
  updateSupportTicketPriority,
  replyToSupportTicket,
  addSupportTicketNote,
  listFeedbackEntries,
  getFeedbackDetails,
  updateFeedbackStatus,
  addFeedbackNote
};
