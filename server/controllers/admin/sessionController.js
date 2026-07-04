async function getAdminSession(req, res) {
  return res.json({
    success: true,
    data: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      forumRole: req.user.forumRole
    }
  });
}

module.exports = {
  getAdminSession
};
