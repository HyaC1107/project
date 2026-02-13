const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isLoggedIn } = require('../middleware/auth');

/**
 * [POST] 기기 등록
 * - 기기를 계정에 연결합니다. (재배 시작일은 나중에 입력 가능하도록 선택사항으로 둡니다.)
 */
router.post('/register', (req, res, next) => {
    console.log("세션 유저 정보:", req.user); // 이게 undefined면 로그인이 안 된 것!
    next();
}, isLoggedIn, async (req, res) => {
    const { 
        serial_number, 
        module_name, 
        location,
        crop_type, 
        fish_type,
        started_at
    } = req.body;
    const user_id = req.user.user_id;
    // console.log(req.body);
    
    try {
        const result = await db.query(
            `INSERT INTO modules (user_id, serial_number, module_name, location, crop_type, fish_type, started_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *`,
            [user_id, serial_number, module_name, location, crop_type, fish_type, started_at]
        );
        res.status(201).json({ success: true, module: result.rows[0] });
    } catch (err) {
        console.error("기기 등록 에러:", err);
        res.status(500).json({ error: '기기 등록 중 오류가 발생했습니다. 🐘💦' });
    }
});

/**
 * [GET] 내 기기 목록 조회
 */
router.get('/my', isLoggedIn, async (req, res) => {
    try {
        // 로그인한 사용자의 ID (req.user.id)를 기반으로 기기 조회
        // users 테이블과 modules 테이블이 user_id로 연결되어 있다고 가정합니다.
        // 만약 user_id 컬럼이 없다면 'WHERE 1=1' 등으로 임시 변경해서 테스트하세요.
        const userId = req.user.user_id; 
        // console.log(req.user);        
        const query = `
            SELECT *
            FROM modules 
            WHERE user_id = $1 
            ORDER BY installed_at DESC
        `;
        const { rows } = await db.query(query, [userId]);
        // console.log(rows);        
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("기기 목록 조회 실패:", error);
        res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
    }
});

/**
 * [PUT] 기기 설정 전체 업데이트
 * - 사용자가 설정 페이지에서 재배 시작일(started_at), 수확 예정일, 이름 등을 수정할 때 사용합니다.
 */
router.put('/:id', isLoggedIn, async (req, res) => {
    const { id } = req.params;
    const { 
        module_name, 
        location,
        crop_type, 
        fish_type, 
        started_at, 
        expected_harvest_date,
        one_line_review 
    } = req.body;
    const user_id = req.user.user_id;

    try {
        // COALESCE를 사용하여 값이 null로 들어오면 기존 값을 유지하도록 할 수도 있지만, 
        // PUT은 보통 전체 수정을 의미하므로 명시적으로 업데이트합니다.
        const result = await db.query(
            `UPDATE modules 
             SET module_name = $1, location = $2, crop_type = $3, fish_type = $4, 
                 started_at = $5, expected_harvest_date = $6, one_line_review = $7
             WHERE module_id = $8 AND user_id = $9 
             RETURNING *`,
            [module_name, location, crop_type, fish_type, started_at, expected_harvest_date, one_line_review, id, user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '수정 권한이 없거나 기기가 없습니다.' });
        }

        res.json({ success: true, module: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '설정 저장 중 오류가 발생했습니다.' });
    }
});

/**
 * [PATCH] 기기 상태 정보 부분 업데이트
 * - AI 분석 결과나 센서 데이터 분석을 통해 점수(growth_level, risk_score)나 한 줄 평만 업데이트할 때 유용합니다.
 */
router.patch('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { growth_level, risk_score, one_line_review, expected_harvest_date } = req.body;

    try {
        // 전달된 값이 있을 때만 업데이트하고, 없으면 기존 값을 유지 (COALESCE 사용)
        const result = await db.query(
            `UPDATE modules 
             SET growth_level = COALESCE($1, growth_level), 
                 risk_score = COALESCE($2, risk_score),
                 one_line_review = COALESCE($3, one_line_review),
                 expected_harvest_date = COALESCE($4, expected_harvest_date)
             WHERE module_id = $5
             RETURNING *`,
            [growth_level, risk_score, one_line_review, expected_harvest_date, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '기기를 찾을 수 없습니다.' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '상태 업데이트 실패' });
    }
});

/**
 * [DELETE] 기기 삭제
 */
router.delete('/:id', isLoggedIn, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.user_id;

    // const client = await db.connect();

    try {
        await db.query('BEGIN');

        // 1️⃣ 모듈 존재 + 권한 체크
        const check = await db.query(
            'SELECT module_id FROM modules WHERE module_id = $1 AND user_id = $2',
            [id, user_id]
        );

        if (check.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: '삭제 권한이 없거나 기기가 없습니다.' });
        }

        // 2️⃣ 재배 데이터만 삭제
        const updateQuery = `
            UPDATE modules
            SET 
                crop_type = ' ',
                fish_type = ' ',
                started_at = NULL,
                expected_harvest_date = NULL,
                growth_level = NULL,
                risk_score = NULL,
                one_line_review = NULL,
                last_photo_blob = NULL
            WHERE module_id = $1
        `;

        await db.query(updateQuery, [id]);

        // 성공 시 커밋
        await db.query('COMMIT');

        res.json({ success: true, message: '재배 데이터가 초기화되었습니다 🌱' });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: '초기화 처리 중 오류 발생' });
    } finally {
        db.release();
    }
});


module.exports = router;