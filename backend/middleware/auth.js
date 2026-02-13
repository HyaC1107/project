// backend/middleware/auth.js
module.exports = {
    isLoggedIn: (req, res, next) => {
        if (req.isAuthenticated()) {
            return next(); // 로그인 됐으면 통과!
        }
        res.status(401).json({ message: '로그인이 필요해요! 🐘' });
    }
};