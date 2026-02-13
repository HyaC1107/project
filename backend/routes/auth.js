const express = require('express');
const router = express.Router();
const passport = require('passport');


// 구글 로그인 시작 버튼이 누르는 주소
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/kakao', passport.authenticate('kakao'));
router.get('/naver', passport.authenticate('naver', { authType: 'reprompt' }));
// process.env.LOCAL_URL
// process.env.VERCEL_URL
// 구글 로그인 성공 후 돌아오는 주소 (Callback)
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: process.env.LOCAL_URL+'/index.html' }),
  (req, res) => {
    res.redirect(process.env.LOCAL_URL+'/dashboard.html'); 
  }
);
// 카카오 로그인 성공 후 돌아오는 주소 (Callback)
router.get('/kakao/callback', 
    passport.authenticate('kakao', { 
        failureRedirect: process.env.LOCAL_URL+'/index.html' 
    }),
    (req, res) => {
        res.redirect(process.env.LOCAL_URL+'/dashboard.html');
    }
);
// 네이버 로그인 성공 후 돌아오는 주소 (Callback)
router.get('/naver/callback', 
    passport.authenticate('naver', { 
        failureRedirect: process.env.LOCAL_URL+'/index.html' 
    }),
    (req, res) => {
        res.redirect(process.env.LOCAL_URL+'/dashboard.html');
    }
);
router.get('/status', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ isLoggedIn: true, user: req.user });
    } else {
        res.json({ isLoggedIn: false });
    }
});

// 로그아웃
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) { return next(err); }
        // 세션 쿠키도 삭제!
        req.session.destroy(() => {
            res.clearCookie('connect.sid'); // 세션 쿠키 이름 (기본값)
            // 성공 시 프론트엔드 로그인 페이지로 리다이렉트 🐘✨
            res.redirect(process.env.LOCAL_URL+'/index.html'); 
        });
    });
});

module.exports = router;