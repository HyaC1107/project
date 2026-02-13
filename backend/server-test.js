const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// [중요 1] 이미지 전송을 위해 용량 제한을 50MB로 확장
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 업로드 폴더 생성
const GROWTH_DIR = path.join(__dirname, 'public/uploads/growth');
if (!fs.existsSync(GROWTH_DIR)) {
    fs.mkdirSync(GROWTH_DIR, { recursive: true });
}

/**
 * [테스트용] 라즈베리파이 센서 및 이미지 통합 수신 엔드포인트
 * 라즈베리파이의 SENSOR_URL이 이 주소를 바라보게 하세요.
 */
app.post('/api/sensors/report', (req, res) => {
    const { type, serial_number, image_data, sensor_data } = req.body;

    // 1. 이미지 로그 처리 (Base64)
    if (type === 'IMAGE_LOG' && image_data) {
        console.log(`\n📸 [수신] 기기 #${serial_number}로부터 사진 데이터 도착!`);
        
        // 파일명 생성: mod_1_20240522.jpg 형태
        const timestamp = new Date().getTime();
        const fileName = `mod_${serial_number}_${timestamp}.jpg`;
        const filePath = path.join(GROWTH_DIR, fileName);
        
        // Base64 문자열에서 바이너리 추출 (prefix 제거)
        const base64Data = image_data.replace(/^data:image\/\w+;base64,/, "");
        
        fs.writeFile(filePath, base64Data, 'base64', (err) => {
            if (err) {
                console.error("❌ 이미지 저장 실패:", err);
                return res.status(500).json({ status: "Error", message: "Save failed" });
            }
            console.log(`✅ 이미지 저장 성공: ${filePath}`);
            
            // [다음 단계] 여기서 AI 서버(FastAPI)로 파일 경로를 쏴줄 예정입니다.
            res.status(200).json({ 
                status: "Success", 
                message: "Image stored",
                path: `/uploads/growth/${fileName}` 
            });
        });
    } 
    // 2. 일반 실시간 데이터 처리
    else if (type === 'REALTIME') {
        console.log(`📊 [데이터] 기기 #${serial_number} 센서값 수신 중...`);
        // 여기에 소켓 전송 로직이 들어갑니다.
        res.status(200).send("OK");
    }
    else {
        res.status(400).send("Unknown Type");
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`
🚀 ==========================================
   Codeponics 통합 테스트 서버 가동 중
   - 포트: ${PORT}
   - 이미지 저장소: ${GROWTH_DIR}
   ==========================================
    `);
});