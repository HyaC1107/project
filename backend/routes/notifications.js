const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth'); // 로그인 체크 미들웨어

// [GET] 알림 이력 및 마지막 확인 시간 조회
router.get('/', isLoggedIn, async (req, res) => {
    try {
        const notiService = req.app.get('notificationService');
        const userId = req.user.user_id; // 패스포트 세션에서 유저 ID 추출

        // 1. 액추에이터 로그 기반 알림 이력 가져오기
        const logs = await notiService.getAlertHistory(userId);
        
        // 2. 현재 유저의 last_checked_at도 함께 전송 (프론트에서 비교용)
        res.json({
            success: true,
            data: {
                logs: logs,
                lastCheckedAt: req.user.last_checked_at 
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "알림 조회 실패" });
    }
});

// [POST] 알림 확인 시간 갱신 (읽음 처리)
router.post('/check', isLoggedIn, async (req, res) => {
    try {
        const notiService = req.app.get('notificationService');
        const userId = req.user.user_id;

        await notiService.updateLastChecked(userId);
        
        res.json({ success: true, message: "읽음 처리 완료!" });
    } catch (err) {
        res.status(500).json({ error: "읽음 처리 실패" });
    }
});

module.exports = router;