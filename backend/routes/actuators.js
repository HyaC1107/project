const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isLoggedIn } = require('../middleware/auth');

router.post('/log', async (req, res) => {
    const { serial_number, actuator_name, action_type, reason } = req.body;
    const notiService = req.app.get('notificationService');

    try {
        // 1. DB 저장 (serial_number를 이용해 모듈 ID 조회 후 저장)
        const moduleResult = await db.query('SELECT module_id FROM modules WHERE serial_number = $1', [serial_number]);
        const moduleId = moduleResult.rows[0]?.module_id;

        if (moduleId) {
            await db.query(
                `INSERT INTO actuator_logs (module_id, actuator_name, action_type, reason) 
                 VALUES ($1, $2, $3, $4)`,
                [moduleId, actuator_name, action_type, reason]
            );
        }

        // 2. [알림 발생] 알림 모달에 실시간으로 뜨게 함
        if (notiService) {
            notiService.notify({
                serial_number,
                title: actuator_name, // 'undefined' 방지를 위해 정확한 이름 전달
                message: `${actuator_name}가 ${action_type === 'on' ? '가동' : '중단'}되었습니다.`,
                priority: 'low',
                recorded_at: new Date()
            });
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).send("Log Error");
    }
});

router.post('/control', isLoggedIn, async (req, res) => {
    const { module_id, serial_number, actuator_name, action_type, reason } = req.body;
    const notiService = req.app.get('notificationService');
    // console.log(req.body);
    try {
        // 1. 제어 로그 저장
        await db.query(
            `INSERT INTO actuator_logs (module_id, actuator_name, action_type, reason) 
            VALUES ($1, $2, $3, $4)`,
            [module_id, actuator_name, action_type, reason]
        );
        console.log('DB저장');
        
        // 2. 대시보드 알림 발생
        if (notiService) {
            notiService.notify({
                serial_number,
                title: "⚙️ 장치 작동",
                message: `${actuator_name}가 ${action_type === 'on' ? '가동' : '중단'}되었습니다. (사유: ${reason})`,
                type: 'actuator',
                priority: 'low'
            });
        }

        res.json({ success: true, message: "제어 명령이 기록되었습니다." });
    } catch (err) {
        res.status(500).json({ error: "로그 저장 실패" });
    }
});

module.exports = router;