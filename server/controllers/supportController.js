const SupportTicket = require('../models/SupportTicket');

exports.createTicket = async (req, res, next) => {
  try {
    const { title, message, category, priority } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }

    const ticket = await SupportTicket.create({
      user: req.user._id,
      title,
      message,
      category: category || 'general',
      priority: priority || 'normal'
    });

    res.status(201).json({ success: true, data: { ticket, message: 'Support ticket created successfully.' } });
  } catch (err) {
    next(err);
  }
};

exports.getMyTickets = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const tickets = await SupportTicket.find({ user: req.user._id })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SupportTicket.countDocuments({ user: req.user._id });

    res.json({
      success: true,
      data: {
        tickets,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getTicketDetails = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findOne({
      _id: req.params.ticketId,
      user: req.user._id
    }).populate('replies.author', 'name avatar role');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    res.json({ success: true, data: { ticket } });
  } catch (err) {
    next(err);
  }
};

exports.replyToTicket = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Reply message cannot be empty.' });
    }

    const ticket = await SupportTicket.findOne({
      _id: req.params.ticketId,
      user: req.user._id
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.replies.push({
      author: req.user._id,
      authorRole: 'user',
      message: message.trim()
    });

    ticket.lastRepliedAt = Date.now();
    ticket.lastUpdatedAt = Date.now();
    
    // If ticket was resolved or closed, a user reply might reopen it? Let's leave that to the platform's standard logic. 
    // We will just push the reply.
    await ticket.save();

    res.json({ success: true, data: { message: 'Reply added successfully.', ticket } });
  } catch (err) {
    next(err);
  }
};

exports.deleteTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findOneAndDelete({
      _id: req.params.ticketId,
      user: req.user._id
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found or you do not have permission to delete it.' });
    }

    res.json({ success: true, data: { message: 'Ticket deleted successfully.' } });
  } catch (err) {
    next(err);
  }
};
