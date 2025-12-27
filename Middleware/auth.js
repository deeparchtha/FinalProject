// Simple middleware to get user ID
function getUserId(req, res, next) {
    if (req.isAuthenticated() && req.user) {
        req.userId = req.user._id;
        return next();
    }
    res.status(401).json({ 
        success: false,
        message: 'Authentication required. Please login.' 
    });
}

module.exports = { getUserId };