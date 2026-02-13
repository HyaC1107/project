const express = require('express');
const router = express.Router();
const axios = require('axios');

// 환경변수 로드
const SERVICE_KEY = process.env.KMA_API_KEY;

/**
 * [GET] /api/weather/current
 */
router.get('/current', async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: '위도(lat)와 경도(lon)가 필요합니다.' });
        }

        // 1. 좌표 변환 (위경도 -> 격자)
        const grid = dfs_xy_conv("toXY", lat, lon);

        // 2. 시간 계산 (기본: 45분 이전이면 1시간 전 데이터 요청)
        let now = new Date();
        if (now.getMinutes() < 45) {
            now.setHours(now.getHours() - 1);
        }

        // 3. 데이터 조회 (실패 시 1시간 전 데이터로 재시도하는 함수)
        const weatherData = await getKmaDataWithRetry(grid, now);
        
        if (weatherData) {
            res.json({ success: true, ...weatherData });
        } else {
            res.status(500).json({ error: '기상청 정보를 가져올 수 없습니다.' });
        }

    } catch (error) {
        console.error("날씨 조회 최종 실패:", error.message);
        res.status(500).json({ error: '서버 내부 오류' });
    }
});

/**
 * 기상청 API 호출 및 재시도 로직
 * - NO_DATA(03) 발생 시 1시간 전 데이터로 한 번 더 시도합니다.
 */
async function getKmaDataWithRetry(grid, dateObj, retryCount = 0) {
    const year = dateObj.getFullYear();
    const month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
    const day = ('0' + dateObj.getDate()).slice(-2);
    const dateStr = `${year}${month}${day}`;

    const hours = ('0' + dateObj.getHours()).slice(-2);
    const timeStr = `${hours}00`;

    const url = `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst` +
                `?serviceKey=${SERVICE_KEY}` +
                `&pageNo=1&numOfRows=10&dataType=JSON` +
                `&base_date=${dateStr}&base_time=${timeStr}` +
                `&nx=${grid.x}&ny=${grid.y}`;

    // console.log(`🌦️ 날씨 요청(Try ${retryCount+1}): ${dateStr} ${timeStr} (NX:${grid.x}, NY:${grid.y})`);

    try {
        const response = await axios.get(url);
        const json = response.data;

        // 정상 응답
        if (json.response && json.response.header.resultCode === '00') {
            return parseWeatherData(json.response.body.items.item);
        } 
        // 데이터 없음 (아직 생성 안됨) -> 1시간 전으로 재시도
        else if (json.response && json.response.header.resultCode === '03') {
            if (retryCount === 0) {
                console.log("⚠️ NO_DATA 수신. 1시간 전 데이터로 재시도합니다...");
                const prevHour = new Date(dateObj);
                prevHour.setHours(prevHour.getHours() - 1);
                return await getKmaDataWithRetry(grid, prevHour, retryCount + 1);
            }
        }
        
        console.error("기상청 에러 응답:", json.response?.header);
        return null;

    } catch (e) {
        console.error("API 호출 중 에러:", e.message);
        return null;
    }
}

/**
 * API 응답 데이터 파싱
 */
function parseWeatherData(items) {
    // T1H: 기온, REH: 습도, PTY: 강수형태
    const tempItem = items.find(i => i.category === 'T1H');
    const humItem = items.find(i => i.category === 'REH');
    const ptyItem = items.find(i => i.category === 'PTY'); 

    const temp = tempItem ? tempItem.obsrValue : '-';
    const hum = humItem ? humItem.obsrValue : '-';
    const pty = ptyItem ? parseInt(ptyItem.obsrValue) : 0;

    let status = "맑음";
    // 강수형태(PTY) 코드: 0=없음, 1=비, 2=비/눈, 3=눈, 5=빗방울, 6=빗방울눈날림, 7=눈날림
    if (pty === 1 || pty === 5) status = "비";
    else if (pty === 2 || pty === 6) status = "비/눈";
    else if (pty === 3 || pty === 7) status = "눈";
    
    return { temp, humidity: hum, status, pty };
}

// -----------------------------------------------------------
// [유틸리티] 위경도 <-> 격자 좌표 변환 함수 (OLAT 수정완료)
// -----------------------------------------------------------
function dfs_xy_conv(code, v1, v2) {
    const RE = 6371.00877; // 지구 반경(km)
    const GRID = 5.0; // 격자 간격(km)
    const SLAT1 = 30.0; // 투영 위도1(degree)
    const SLAT2 = 60.0; // 투영 위도2(degree)
    const OLON = 126.0; // 기준점 경도(degree)
    const OLAT = 38.0; // [중요] 기준점 위도(degree) - 이게 있어야 y값 계산됨!
    const XO = 43; // 기준점 X좌표(GRID)
    const YO = 136; // 기준점 Y좌표(GRID)

    const DEGRAD = Math.PI / 180.0;
    
    const re = RE / GRID;
    const slat1 = SLAT1 * DEGRAD;
    const slat2 = SLAT2 * DEGRAD;
    const olon = OLON * DEGRAD;
    const olat = OLAT * DEGRAD;

    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = re * sf / Math.pow(ro, sn);
    
    let rs = {};
    if (code == "toXY") {
        rs['lat'] = v1;
        rs['lng'] = v2;
        
        const latVal = Number(v1);
        const lonVal = Number(v2);

        let ra = Math.tan(Math.PI * 0.25 + (latVal) * DEGRAD * 0.5);
        ra = re * sf / Math.pow(ra, sn);
        let theta = lonVal * DEGRAD - olon;
        if (theta > Math.PI) theta -= 2.0 * Math.PI;
        if (theta < -Math.PI) theta += 2.0 * Math.PI;
        theta *= sn;
        rs['x'] = Math.floor(ra * Math.sin(theta) + XO + 0.5);
        rs['y'] = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
    }
    return rs;
}

module.exports = router;