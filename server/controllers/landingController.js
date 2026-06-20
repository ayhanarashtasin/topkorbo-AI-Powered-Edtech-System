const WaitlistEntry = require('../models/WaitlistEntry');
const ApiResponse = require('../utils/apiResponse');

/**
 * Landing page controller — handles waitlist signups and stats
 */
const landingController = {
  /**
   * POST /api/landing/waitlist
   * Save an early-access signup
   */
  joinWaitlist: async (req, res, next) => {
    try {
      const { name, email, phone, targetExam, language } = req.body;
      const entry = await WaitlistEntry.create({ name, email, phone, targetExam, language });
      return ApiResponse.success(res, entry, 'Welcome to TopKorbo! You\'re on the list 🎉', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/landing/stats
   * Return platform statistics (mock data for now)
   */
  getStats: async (req, res) => {
    const stats = {
      students: 52480,
      questions: 128750,
      contests: 1240,
      mentors: 385
    };
    return ApiResponse.success(res, stats, 'Platform stats retrieved');
  }
};

module.exports = landingController;
