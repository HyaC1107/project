const express = require('express');
const router = express.Router();
const db = require('../config/db'); 
const { isLoggedIn } = require('../middleware/auth');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const { 
    generateDailyAnalysis, 
    generateWeeklyReport, 
    generateGrowthJournal 
} = require('../services/aiService');

// [핵심] 파일 시스템 대신 메모리 버퍼 사용 (BLOB 저장을 위해)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


/**
 * [기능 1] 라즈베리파이 사진 수신 (/pi-photo)
 * - MONITOR (5분): 최신 사진 갱신 (저장 X) -> 소켓 전송
 * - ANALYSIS (24시간): 히스토리 저장 + 통계 계산 + AI 서버 전송
*/
// dummy 라우터에도 multer 미들웨어를 추가해줍니다!
router.post('/dummy', upload.single('image_data'), async (req, res) => {
    try {
        // multer를 쓰면 파일 데이터가 req.file.buffer에 BLOB 형태로 들어와요!
        const imageBuffer = req.file.buffer; 
        const { module_id } = req.body;

        await db.query(
            `INSERT INTO growth_photos (module_id, image_data) VALUES ($1, $2)`, 
            [module_id, imageBuffer]
        );

        res.json({ success: true, message: "파일 전송 방식으로 저장 성공! 📸" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/pi-photo', upload.single('image'), async (req, res) => {
    const { serial_number, type } = req.body; 
    const io = req.app.get('io');
    
    if (!req.file) return res.status(400).json({ error: "No image file" });

    try {
        const moduleRes = await db.query('SELECT module_id FROM modules WHERE serial_number = $1', [serial_number]);
        // console.log(moduleRes);
        // console.log(serial_number);                
        if (moduleRes.rows.length === 0) throw new Error("Unregistered module");
        const moduleId = moduleRes.rows[0].module_id;

        // [공통] 최신 모니터링 사진 업데이트
        await db.query('UPDATE modules SET last_photo_blob = $1 WHERE module_id = $2', [req.file.buffer, moduleId]);
        const virtualUrl = `/api/ai/image/module/${moduleId}/latest`;

        // [CASE A] 모니터링 (5분)
        if (type === 'MONITOR') {
            io.to(serial_number).emit('new_monitoring_photo', { photo_url: virtualUrl, timestamp: Date.now() });
            return res.json({ success: true, mode: 'MONITOR' });
        }

        // [CASE B] 정밀 분석 (24시간)
        if (type === 'ANALYSIS') {
            console.log(`🧠 [Analysis] Start Module ${moduleId}`);

            // 1. 24시간 환경 통계 계산
            const statsRes = await db.query(`
                SELECT 
                    AVG(CAST(sensor_data->>'water_temp' AS NUMERIC)) as avg_t, 
                    AVG(CAST(sensor_data->>'humidity' AS NUMERIC)) as avg_h,
                    AVG(CAST(sensor_data->>'lux_value' AS NUMERIC)) as avg_l,
                    AVG(CAST(sensor_data->>'ph_value' AS NUMERIC)) as avg_p,
                    AVG(CAST(sensor_data->>'air_temp' AS NUMERIC)) as avg_a,
                    AVG(CAST(sensor_data->>'ec_value' AS NUMERIC)) as avg_ec,
                    AVG(CAST(sensor_data->>'do_value' AS NUMERIC)) as avg_do
                FROM sensor_logs 
                WHERE module_id = $1 AND recorded_at > NOW() - INTERVAL '24 hours'
            `, [moduleId]);
            
            const avgData = {
                temp: parseFloat(statsRes.rows[0].avg_t || 0).toFixed(1),
                hum: parseFloat(statsRes.rows[0].avg_h || 0).toFixed(1),
                lux: parseFloat(statsRes.rows[0].avg_l || 0).toFixed(0),
                ph: parseFloat(statsRes.rows[0].avg_p || 0).toFixed(2),
                air_temp: parseFloat(statsRes.rows[0].avg_a || 0).toFixed(1),
                ec: parseFloat(statsRes.rows[0].avg_ec || 0).toFixed(1),
                do: parseFloat(statsRes.rows[0].avg_do || 0).toFixed(1)
            };

            // 3. 사진 히스토리 저장
            await db.query(`INSERT INTO growth_photos (module_id, image_data) VALUES ($1, $2)`, [moduleId, req.file.buffer]);

            // 4. 재배일수 계산
            const daysRes = await db.query(`SELECT started_at FROM modules WHERE module_id = $1`, [moduleId]);
            let daysGrown = 1;
            
            if (daysRes.rows.length > 0 && daysRes.rows[0].started_at) {
                daysGrown = Math.max(
                    1,
                    Math.floor(
                        (Date.now() - new Date(daysRes.rows[0].started_at).getTime()) 
                        / 86400000
                    )
                );
            }

            // 5. AI 서버 전송
            const form = new FormData();
            form.append('image', req.file.buffer, { filename: 'capture.jpg', contentType: 'image/jpeg' });
            form.append('module_id', Number(moduleId));
            form.append('days_grown', Number(daysGrown));
            form.append('avg_temp', Number(avgData.temp));
            form.append('avg_hum', Number(avgData.hum));
            form.append('total_lux', Number(avgData.lux));
            form.append('water_ph', Number(avgData.ph));

            const aiServerUrl = process.env.AI_SERVER_URL || 'http://127.0.0.1:8001';
            axios.post(`${aiServerUrl}/analyze/crop`, form, { headers: { ...form.getHeaders() } }).catch(e => console.error(e.message));

            io.to(serial_number).emit('analysis_started', { photo_url: virtualUrl });
            return res.json({ success: true, mode: 'ANALYSIS_STARTED' });
        }
    } catch (error) {
        console.error("Pi-Photo Error:", error);
        res.status(500).json({ error: "Server Error" });
    }
});

/**
 * [기능 2] AI 분석 결과 수신 및 저장 (/save-analysis)
 * - Trigger: AI Server (FastAPI)가 분석 완료 후 호출
 * - 역할: 
 * 1. AI 작물 분석 결과 DB 저장
 * 2. LLM 호출하여 한줄평/일일리포트 생성 및 저장
 * 3. Modules 테이블 상태 업데이트 (대시보드용)
 */
router.post('/save-analysis', async (req, res) => {
    const { type, module_id, data, health_score } = req.body; // type='CROP'
    const io = req.app.get('io');

    try {
        if (type === 'CROP') {
            const { growth_rate_pct, leaf_health_status, estimated_size_cm, expected_harvest_date } = data;
            const statsRes = await db.query(`
                SELECT 
                    AVG(CAST(sensor_data->>'water_temp' AS NUMERIC)) as avg_t, 
                    AVG(CAST(sensor_data->>'humidity' AS NUMERIC)) as avg_h,
                    AVG(CAST(sensor_data->>'lux_value' AS NUMERIC)) as avg_l,
                    AVG(CAST(sensor_data->>'ph_value' AS NUMERIC)) as avg_p,
                    AVG(CAST(sensor_data->>'ec_value' AS NUMERIC)) as avg_ec,
                    AVG(CAST(sensor_data->>'do_value' AS NUMERIC)) as avg_do
                FROM sensor_logs 
                WHERE module_id = $1 AND recorded_at > NOW() - INTERVAL '24 hours'
            `, [module_id]);

            // 1. LLM 생성을 위한 문맥 데이터 수집
            const sensorStats = {
                temp: parseFloat(statsRes.rows[0]?.avg_t || 0).toFixed(1),
                hum: parseFloat(statsRes.rows[0]?.avg_h || 0).toFixed(1),
                lux: parseFloat(statsRes.rows[0]?.avg_l || 0).toFixed(0),
                ph: parseFloat(statsRes.rows[0]?.avg_p || 0).toFixed(2),
                ec: parseFloat(statsRes.rows[0]?.avg_ec || 0).toFixed(1),
                do: parseFloat(statsRes.rows[0]?.avg_do || 0).toFixed(1)
            };
            const moduleInfo = (await db.query('SELECT module_name, crop_type, serial_number FROM modules WHERE module_id = $1', [module_id])).rows[0];            
            const waterAnalysis = (await db.query('SELECT water_score, predicted_risk_level FROM ai_results_water WHERE module_id = $1 ORDER BY analyzed_at DESC LIMIT 1', [module_id])).rows[0] || { water_score: 0, predicted_risk_level: 'Unknown' };

            // 2. [LLM] 일일 분석 (한줄평 + 상세리포트)
            let oneLiner = "데이터 분석 중...";
            let dailyReport = "리포트를 생성할 수 없습니다.";

            try {
                const llmResult = await generateDailyAnalysis(moduleInfo, sensorStats, data, waterAnalysis);
                if (llmResult) {
                    oneLiner = llmResult.one_line_review;
                    dailyReport = llmResult.daily_report;
                }
                io.to(moduleInfo.serial_number).emit('daily_report_updated', {
                    oneLiner: oneLiner,
                    dailyReport: dailyReport
                });
            } catch (e) { console.error("LLM Error:", e.message); }

            // 3. DB 저장
            await db.query(
                `INSERT INTO ai_results_crops 
                (module_id, growth_rate_pct, leaf_health_status, estimated_size_cm, expected_harvest_date, 
                 avg_env_data, one_liner, daily_report) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    module_id, 
                    growth_rate_pct, leaf_health_status, estimated_size_cm, expected_harvest_date,
                    sensorStats, // $6: JSON 객체 -> DB의 JSONB 컬럼으로 저장됨
                    oneLiner, dailyReport
                ]
            );

            // 4. 모듈 테이블 상태 업데이트 (한줄평 등)
            
            const riskScore = health_score ? Math.max(0, 100 - health_score) : 0;
            // console.log(oneLiner);            
            await db.query(
                `UPDATE modules 
                 SET one_line_review = $1, growth_level = $2, risk_score = $3, expected_harvest_date = $4
                 WHERE module_id = $5`,
                [oneLiner, growth_rate_pct, riskScore, expected_harvest_date, module_id]
            );

            // 5. 프론트엔드 알림
            if (moduleInfo.serial_number) {
                io.to(moduleInfo.serial_number).emit('daily_report_updated', { oneLiner, growth_rate: growth_rate_pct });
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error("Save Analysis Error:", error);
        res.status(500).json({ error: "Save Failed" });
    }
});
router.get('/analysis/:module_id/latest', async (req, res) => {
    const { module_id } = req.params;
    try {
        // 가장 최근의 분석 데이터 1건 조회
        const result = await db.query(
            `SELECT *
             FROM ai_results_crops 
             WHERE module_id = $1 
             ORDER BY analyzed_at DESC LIMIT 1`,
            [module_id]
        );

        if (result.rows.length === 0) {
            return res.json({ success: false, message: "아직 생성된 분석이 없습니다." });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error("분석 조회 실패:", error);
        res.status(500).json({ error: "서버 에러" });
    }
});
/**
 * [기능 3] 주간 리포트 생성 및 저장 (/report/weekly/:module_id)
 * - Trigger: 사용자 요청 or 스케줄러
 */
router.post('/report/weekly/:module_id', isLoggedIn, async (req, res) => {
    const { module_id } = req.params;
    try {
        const historyRes = await db.query(`
            SELECT 
                DATE(analyzed_at) as date,
                growth_rate_pct, 
                leaf_health_status, 
                avg_env_data, -- 이미 JSONB로 저장되어 있죠!
                one_liner
            FROM ai_results_crops
            WHERE module_id = $1 AND analyzed_at > NOW() - INTERVAL '7 days'
            ORDER BY analyzed_at ASC
        `, [module_id]);

        if (historyRes.rows.length < 3) return res.json({ success: false, message: "데이터 부족" });
        const historySummary = historyRes.rows.map(row => {
            const env = row.avg_env_data || {};
            return `- ${row.date}: 성장률 ${row.growth_rate_pct}%, 상태 '${row.leaf_health_status}', 평균온도 ${env.temp || '??'}℃`;
        }).join('\n');

        const moduleInfo = (await db.query('SELECT module_name, crop_type FROM modules WHERE module_id = $1', [module_id])).rows[0];
        const weeklyResult = await generateWeeklyReport(moduleInfo, historySummary);
        const contentStr = typeof weeklyResult === 'object' ? JSON.stringify(weeklyResult) : weeklyResult;

        await db.query(`INSERT INTO ai_weekly_reports (module_id, content) VALUES ($1, $2)`, [module_id, contentStr]);

        res.json({ success: true, report: weeklyResult });
    } catch (error) {
        console.error("Weekly Report Error:", error);
        res.status(500).json({ error: "Weekly Report Failed" });
    }
});

/**
 * [기능 4] 수확 생장일지 생성 (균등 주기 사진 추출 버전)
 */
// router.post('/journal/harvest/:module_id', isLoggedIn, async (req, res) => {
//     const { module_id } = req.params;
//     try {
//         // 1. 재배 시작일과 종료일(현재) 가져오기
//         const moduleRes = await db.query('SELECT started_at, crop_type, module_name FROM modules WHERE module_id = $1', [module_id]);
//         const startDate = new Date(moduleRes.rows[0].started_at);
//         const endDate = new Date(); // 수확 시점
//         const moduleInfo = moduleRes.rows[0];

//         // 2. 전체 사진 히스토리 가져오기
//         const allPhotos = await db.query(
//             `SELECT photo_id, image_data, recorded_at FROM growth_photos 
//              WHERE module_id = $1 ORDER BY recorded_at ASC`, [module_id]
//         );

//         if (allPhotos.rows.length < 5) return res.json({ success: false, message: "사진 데이터 부족" });

//         // 3. [핵심] 균등 간격의 사진 5장 선별
//         const selectedPhotos = [];
//         const totalPhotos = allPhotos.rows.length;
        
//         // 0%, 25%, 50%, 75%, 100% 지점의 인덱스 계산
//         [0, 0.25, 0.5, 0.75, 1].forEach(ratio => {
//             const idx = Math.min(Math.floor((totalPhotos - 1) * ratio), totalPhotos - 1);
//             selectedPhotos.push(allPhotos.rows[idx]);
//         });
       
//         // 4. [LLM] 생장일지 텍스트 생성 (선별된 사진 날짜 기반)
//         const journalResult = await generateGrowthJournal(moduleInfo, selectedPhotos);

//         // 5. 사진 바이너리를 Base64로 변환하여 JSON 구성
//         const finalJournalContent = {
//             crop_type: moduleInfo.crop_type,
//             entries: journalResult.map((entry, index) => ({
//                 ...entry,
//                 date: selectedPhotos[index].recorded_at,
//                 photo_base64: `data:image/jpeg;base64,${selectedPhotos[index].image_data.toString('base64')}`
//             }))
//         };

//         // 6. DB 저장
//         await db.query(
//             `INSERT INTO crop_journals (module_id, journal_content) VALUES ($1, $2)`,
//             [module_id, JSON.stringify(finalJournalContent)]
//         );

//         res.json({ success: true });
//     } catch (error) {
//         console.error("Harvest Journal Error:", error);
//         res.status(500).json({ error: "Journal Generation Failed" });
//     }
// });

router.post('/journal/harvest/:module_id', isLoggedIn, async (req, res) => {
    const { module_id } = req.params;

    try {
        // 1️⃣ 모듈 정보 가져오기
        const moduleRes = await db.query(
            `SELECT started_at, crop_type, module_name 
             FROM modules 
             WHERE module_id = $1`,
            [module_id]
        );

        if (moduleRes.rows.length === 0) {
            return res.status(404).json({ error: "Module not found" });
        }

        const moduleInfo = moduleRes.rows[0];
        const startDate = new Date(moduleInfo.started_at);

        // 2️⃣ AI 분석 데이터 가져오기
        const analysisRes = await db.query(
            `SELECT growth_rate_pct,
                    leaf_health_status,
                    estimated_size_cm,
                    expected_harvest_date,
                    analyzed_at,
                    one_liner
             FROM ai_results_crops
             WHERE module_id = $1
             ORDER BY analyzed_at ASC`,
            [module_id]
        );

        if (analysisRes.rows.length < 5) {
            return res.json({ success: false, message: "AI 분석 데이터 부족" });
        }

        // 3️⃣ 균등 간격 5개 선택
        const rows = analysisRes.rows;
        const total = rows.length;
        const selected = [];

        [0, 0.25, 0.5, 0.75, 1].forEach(ratio => {
            const idx = Math.min(Math.floor((total - 1) * ratio), total - 1);
            selected.push(rows[idx]);
        });

        // 4️⃣ 성장 타임라인 생성 + 사진 매칭
        const photoTimeline = [];

        for (const row of selected) {

            // 분석 시점과 가장 가까운 사진 1장 가져오기
            const photoRes = await db.query(
                `SELECT image_data, recorded_at
                 FROM growth_photos
                 WHERE module_id = $1
                 ORDER BY ABS(EXTRACT(EPOCH FROM (recorded_at - $2)))
                 LIMIT 1`,
                [module_id, row.analyzed_at]
            );

            const photo = photoRes.rows[0] || null;

            const analyzedDate = new Date(row.analyzed_at);
            const days_grown = Math.floor(
                (analyzedDate - startDate) / (1000 * 60 * 60 * 24)
            );

            photoTimeline.push({
                days_grown,
                size_cm: row.estimated_size_cm,
                health: row.leaf_health_status,
                growth_rate_pct: row.growth_rate_pct,
                analyzed_at: row.analyzed_at,
                one_liner: row.one_liner,
                photo_base64: photo
                    ? `data:image/jpeg;base64,${photo.image_data.toString('base64')}`
                    : null
            });
        }

        // 5️⃣ LLM 생장일지 생성
        const journalResult = await generateGrowthJournal({
            crop_type: moduleInfo.crop_type,
            module_name: moduleInfo.module_name,
            expected_harvest_date: selected[selected.length - 1].expected_harvest_date,
            photoTimeline
        });

        // 6️⃣ 최종 저장 구조
        const finalJournalContent = {
            crop_type: moduleInfo.crop_type,
            module_name: moduleInfo.module_name,
            harvested_at: new Date(),
            timeline: photoTimeline,
            journal_text: journalResult
        };

        await db.query(
            `INSERT INTO crop_journals (module_id, journal_content)
             VALUES ($1, $2)`,
            [module_id, JSON.stringify(finalJournalContent)]
        );

        res.json({ success: true });

    } catch (error) {
        console.error("Harvest Journal Error:", error);
        res.status(500).json({ error: "Journal Generation Failed" });
    }
});


router.get('/image/module/:module_id/latest', async (req, res) => {    
    try {
        const result = await db.query('SELECT last_photo_blob FROM modules WHERE module_id = $1', [req.params.module_id]);
        if (!result.rows[0]?.last_photo_blob) return res.status(404).send('No Image');
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': result.rows[0].last_photo_blob.length, 'Cache-Control': 'no-cache' });
        res.end(result.rows[0].last_photo_blob);
    } catch (e) { res.status(500).send('Error'); }
});
/**
 * [기능] 특정 모듈의 최신 주간 리포트 조회 (/report/weekly/latest/:module_id)
 * - 리포트 상세 페이지의 '주간' 탭 클릭 시 호출됩니다.
 */
router.get('/report/weekly/latest/:module_id', isLoggedIn, async (req, res) => {
    const { module_id } = req.params;

    try {
        // 1. 해당 기기가 로그인한 사용자의 기기인지 보안 확인
        const moduleCheck = await db.query(
            'SELECT module_id FROM modules WHERE module_id = $1 AND user_id = $2',
            [module_id, req.user.user_id]
        );

        if (moduleCheck.rows.length === 0) {
            return res.status(403).json({ success: false, error: "접근 권한이 없습니다." });
        }

        // 2. 가장 최근에 생성된 주간 리포트 1건 조회
        const result = await db.query(
            `SELECT module_id, content, created_at 
             FROM ai_weekly_reports 
             WHERE module_id = $1 
             ORDER BY created_at DESC LIMIT 1`,
            [module_id]
        );

        if (result.rows.length === 0) {
            return res.json({ 
                success: false, 
                message: "아직 생성된 주간 리포트가 없습니다." 
            });
        }

        // 3. content가 이미 JSON 타입일 수도 있고, 문자열일 수도 있으니 안전하게 처리
        let reportContent = result.rows[0].content;
        if (typeof reportContent === 'string') {
            try {
                reportContent = JSON.parse(reportContent);
            } catch (e) {
                console.error("JSON 파싱 에러:", e);
            }
        }

        res.json({ 
            success: true, 
            data: {
                content: reportContent,
                created_at: result.rows[0].created_at
            }
        });

    } catch (error) {
        console.error("❌ 주간 리포트 조회 에러:", error);
        res.status(500).json({ success: false, error: "서버 에러" });
    }
});

/**
 * [기능 7] 특정 모듈의 모든 성장일지 목록 조회 (/journal/history-list/:module_id)
 */
router.get('/journal/history-list/:module_id', isLoggedIn, async (req, res) => {
    const { module_id } = req.params;
    console.log('일지목록 가져가!',req.params);    
    try {
        const result = await db.query(`
            SELECT journal_id, module_id, created_at,journal_content
            FROM crop_journals
            WHERE module_id = $1
            ORDER BY created_at DESC
        `, [module_id]);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: "목록 조회 실패" });
    }
});
/**
 * [기능 6] 특정 성장일지 상세 조회 (/journal/detail/:journal_id)
 * - 성장일지 상세 페이지 진입 시 호출됩니다.
 */
router.get('/journal/detail/:journal_id', isLoggedIn, async (req, res) => {
    const { journal_id } = req.params;
    console.log(req.user.user_id);

    try {
        // 1. 보안 체크: 해당 일지가 현재 로그인한 사용자의 것인지 확인
        // (modules 테이블과 join하여 user_id 비교)
        const journalCheck = await db.query(`
            SELECT j.*, m.module_name, m.crop_type, m.fish_type
            FROM crop_journals j
            JOIN modules m ON j.module_id = m.module_id
            WHERE j.journal_id = $1 AND m.user_id = $2
        `, [journal_id, req.user.user_id]);
        console.log(journalCheck);
        if (journalCheck.rows.length === 0) {
            return res.status(403).json({ success: false, error: "접근 권한이 없거나 존재하지 않는 일지입니다." });
        }

        const journalData = journalCheck.rows[0];

        // 2. journal_content가 문자열일 경우를 대비한 파싱 (안전장치)
        let content = journalData.journal_content;
        if (typeof content === 'string') {
            try {
                content = JSON.parse(content);
            } catch (e) {
                console.error("Journal JSON Parse Error:", e);
            }
        }

        // 3. 최종 데이터 반환
        res.json({
            success: true,
            data: {
                journal_id: journalData.journal_id,
                module_id: journalData.module_id,
                module_name: journalData.module_name,
                crop_type: journalData.crop_type,
                fish_type: journalData.fish_type,
                content: content, // 사진(Base64)과 텍스트가 포함된 객체
                created_at: journalData.created_at
            }
        });

    } catch (error) {
        console.error("❌ 성장일지 상세 조회 에러:", error);
        res.status(500).json({ success: false, error: "서버 에러" });
    }
});
module.exports = router;