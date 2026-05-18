const express = require('express');
const router = express.Router();
const db = require('../config/db'); 
const { isLoggedIn } = require('../middleware/auth');
const axios = require('axios');

/**
 * [GET] 내 기기들의 최신 센서 및 수질 분석 수치 조회
 * - 대시보드 진입 시 처음 보여줄 데이터들을 가져옵니다.
 */
router.get('/latest', isLoggedIn, async (req, res) => {
    try {
        const sql = `
            SELECT DISTINCT ON (m.module_id) 
                m.module_id, m.serial_number, m.module_name, m.crop_type, m.fish_type,
                s.sensor_data,
                w.water_score, w.predicted_risk_level,
                s.recorded_at 
            FROM modules m
            LEFT JOIN sensor_logs s ON m.module_id = s.module_id
            LEFT JOIN ai_results_water w ON m.module_id = w.module_id
            WHERE m.user_id = $1
            ORDER BY m.module_id, s.recorded_at DESC, w.analyzed_at DESC
        `;
        
        const result = await db.query(sql, [req.user.user_id]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("❌ 최신 데이터 조회 에러:", err);
        res.status(500).json({ error: "데이터 로딩 실패" });
    }
});

/**
 * [POST] 라즈베리파이 데이터 수신
 * - RPi가 직접 분석한 '수질 분석 결과'를 포함해서 보낸다고 가정합니다.
 */
router.post('/report', async (req, res) => {
    const io = req.app.get('io');
    const { 
        serial_number, 
        type, 
        sensor_data, 
        water_analysis // RPi에서 계산한 수질 분석 결과 { score, risk_level, factor, predicted_1h }
    } = req.body;

    if (!serial_number || !sensor_data) {
        return res.status(400).json({ error: "필수 데이터 누락" });
    }

    try {
        // 1. [공통] 웹 대시보드로 실시간 쏴주기 (RPi의 수질 분석 결과도 포함)
        io.to(serial_number).emit('realtime_stats', {
            serial_number,
            sensors: sensor_data,
            water: water_analysis, // RPi가 보낸 수질 분석 데이터
            timestamp: new Date()
        });
        // console.log(sensor_data);
        

        if (type === 'REALTIME') {

            const moduleRes = await db.query('SELECT module_id FROM modules WHERE serial_number = $1', [serial_number]);
            if (moduleRes.rows.length === 0) return res.status(404).json({ error: "미등록 기기" });
            const moduleId = moduleRes.rows[0].module_id;
            // await db.query(
            //     'INSERT INTO sensor_logs (module_id, sensor_data) VALUES ($1, $2)',
            //     [moduleId, JSON.stringify(sensor_data)]
            // );
            return res.status(200).json({ status: 'realtime_broadcast_done' });
        }

        if (type === 'DB_LOG') {
            // [Step A] 기기 ID 조회
            // 
            const moduleRes = await db.query('SELECT module_id FROM modules WHERE serial_number = $1', [serial_number]);
            if (moduleRes.rows.length === 0) return res.status(404).json({ error: "미등록 기기" });
            const moduleId = moduleRes.rows[0].module_id;

            // [Step B] 센서 로그 저장 (sensor_logs)
            await db.query(
                'INSERT INTO sensor_logs (module_id, sensor_data) VALUES ($1, $2)',
                [moduleId, JSON.stringify(sensor_data)]
            );
            // console.log('센서로그 15분마다 저장중');           

            // [Step C] RPi가 보내온 수질 분석 결과 저장 (ai_results_water)
            if (water_analysis) {
                await db.query(
                    `INSERT INTO ai_results_water 
                    (module_id, water_score, predicted_risk_level, risk_factor, predicted_1h) 
                    VALUES ($1, $2, $3, $4, $5)`,
                    [
                        moduleId, 
                        water_analysis.score, 
                        water_analysis.risk_level, 
                        water_analysis.factor, 
                        JSON.stringify(water_analysis.predicted_1h)
                    ]
                );
            }

            // [Step D] AI 서버(작물 분석용)에 센서 데이터 동기화 (필요 시)
            // 작물 분석 모델이 주변 환경(온도, 습도 등)을 참고해야 할 경우 호출합니다.
            // axios.post(`${process.env.AI_SERVER_URL}/sync-environment`, {
            //     module_id: moduleId,
            //     sensors: sensor_data
            // }).catch(() => {}); // 분석용 참고 데이터이므로 실패해도 전체 로직에 지장 없게 처리

            return res.status(200).json({ success: true, message: "DB 저장 완료 🐘✨" });
        }

    } catch (err) {
        console.error("❌ 센서 처리 에러:", err);
        res.status(500).json({ error: "서버 내부 오류" });
    }
});

/**
 * [GET] 특정 모듈의 최근 센서 로그 조회 (리포트 차트용)
 * - 최근 24시간 동안 5분 간격(DB_LOG 타입)으로 저장된 데이터를 가져옵니다.
 */
router.get('/:moduleId/history', isLoggedIn, async (req, res) => {
    const { moduleId } = req.params;

    try {
        // 1. 해당 모듈이 로그인한 사용자의 것인지 확인 (보안)
        const moduleCheck = await db.query(
            'SELECT module_id FROM modules WHERE module_id = $1 AND user_id = $2',
            [moduleId, req.user.user_id]
        );

        if (moduleCheck.rows.length === 0) {
            return res.status(403).json({ error: "접근 권한이 없거나 없는 기기입니다." });
        }

        // 2. 최근 24시간 동안의 센서 로그 조회 (시간순 정렬)
        const sql = `
            SELECT sensor_data, recorded_at 
            FROM sensor_logs 
            WHERE module_id = $1 
              AND recorded_at >= NOW() - INTERVAL '24 hours'
            ORDER BY recorded_at ASC
        `;
        
        const result = await db.query(sql, [moduleId]);

        // 3. 프론트엔드 차트가 쓰기 좋게 가공해서 전달
        // sensor_data가 JSON 문자열일 경우를 대비해 파싱 처리
        const logs = result.rows.map(row => ({
            ...row.sensor_data, // ph, ec, water_temp 등이 들어있음
            created_at: row.recorded_at
        }));

        res.json({ 
            success: true, 
            data: {
                module_id: moduleId,
                logs: logs 
            }
        });

    } catch (err) {
        console.error("❌ 히스토리 데이터 조회 에러:", err);
        res.status(500).json({ error: "과거 데이터 로딩 실패" });
    }
});
module.exports = router;