import * as API from './common/api.js';
import * as Socket from './common/socket.js';

// URL 파라미터에서 기기 시리얼 번호 가져오기 (?cam=SERIAL_NUMBER)
const params = new URLSearchParams(window.location.search);
const DEVICE_SERIAL = params.get('cam');

const UI = {
    title: document.getElementById('device-title'),
    aiReview1: document.getElementById('ai-review-1'),
    cameraFeed: document.getElementById('main-camera-feed'),
    bboxContainer: document.getElementById('bbox-container'),
    // 센서 수치
    ph: document.getElementById('val-ph'),
    ec: document.getElementById('val-ec'),
    wTemp: document.getElementById('val-water-temp'),
    do: document.getElementById('val-do'),
    aTemp: document.getElementById('val-air-temp'),
    hum: document.getElementById('val-humidity'),
    lux: document.getElementById('val-lux'),
    // 차트 요소
    barGrowth: document.getElementById('bar-growth-score'),
    barRate: document.getElementById('bar-growth-rate'),
    // 막대그래프 요소
    barHum: document.getElementById('bar-humidity'),
    barLux: document.getElementById('bar-lux'),
    barGrowth: document.getElementById('bar-growth-rate')
};

let currentModule = null;
let socket = null;
let sensorChart = null;
let radarChart = null;
const TARGETS = {
    ph: 6.5,     // pH 6.0~7.0이 보통 적정
    ec: 2,     // 1.2~1.8 mS/cm
    wTemp: 23,   // 22~26도
    do: 8,       // 7~9 mg/L
    aTemp: 25      // 70~90%
};

async function init() {
    if (!DEVICE_SERIAL) {
        alert("기기 정보가 없습니다. 목록으로 돌아갑니다.");
        window.location.href = 'monitoring.html';
        return;
    }

    // 1. 인증 체크
    const auth = await API.checkAuthStatus();
    if (!auth || !auth.isLoggedIn) return;

    // 2. 내 기기 목록에서 현재 기기 정보 찾기
    const res = await API.getMyDevices();
    currentModule = res.data?.find(d => d.serial_number === DEVICE_SERIAL);

    if (!currentModule) {
        alert("등록되지 않은 기기입니다.");
        window.location.href = 'monitoring.html';
        return;
    }

    // 3. UI 초기 세팅
    UI.title.textContent = `${currentModule.module_name} 모니터링`;
    document.title = `${currentModule.module_name} - 상세 모니터링`;

    // 4. 소켓 연결 및 방 입장
    socket = Socket.initSocket();
    Socket.joinDeviceRoom(DEVICE_SERIAL);

    // 5. 초기 데이터 로드 (사진 + 센서 + AI분석)
    loadGrowthMetrics();
    loadInitialData();
    initChart();
    initRadarChart();
    setupImageFallback();
    // 6. 실시간 업데이트 리스너 등록
    setupSocketListeners();
}

async function loadInitialData() {
    if (!currentModule) return;

    // [수정] 페이지 로드 즉시 '진짜 최신' 이미지부터 띄우기 (dashboard.js 방식)
    const timestamp = Date.now();
    UI.cameraFeed.src = `http://localhost:5000/api/ai/image/module/${currentModule.module_id}/latest?t=${timestamp}`;
    UI.cameraFeed.style.opacity = '1';

    // 1. AI 분석 결과 로드 (한줄평 및 지표 업데이트용)
    const analysis = await API.getLatestAnalysis(currentModule.module_id);
    if (analysis.success && analysis.data) {
        updateAIUI(analysis.data);
    }

    // 2. 최신 센서 수치 로드
    const sensorRes = await API.getLatestSensorData();
    if (sensorRes.success && sensorRes.data) {
        const myData = sensorRes.data.find(d => d.module_id === currentModule.module_id);
        if (myData) applySensorValues(myData.sensor_data);
    }
}

function updateAIUI(data) {
    // 1. AI 한줄평 업데이트
    if (UI.aiReview1 && data.one_line_review) {
        UI.aiReview1.textContent = data.one_line_review;
    }

    // 2. 성장 지표 바 업데이트
    if (data.growth_score) updateBar(UI.barGrowth, data.growth_score);
    if (data.growth_rate) updateBar(UI.barRate, data.growth_rate);

    // 3. Bounding Boxes (AI가 찾은 객체 표시) - 데이터가 있을 경우만
    renderBboxes(data.bboxes); 
}
// 각종 수치데이터 
function applySensorValues(sensors) {
    if (!sensors) return;
    const pHValue = sensors.ph_value || 0;
    UI.ph.textContent = sensors.ph || sensors.ph_value || '-';
    UI.ec.textContent = sensors.ec || sensors.ec_value || '-';
    UI.wTemp.textContent = sensors.water_temp || '-';
    UI.do.textContent = sensors.do || sensors.do_value || '-';
    UI.aTemp.textContent = sensors.air_temp || '-';
    UI.hum.textContent = sensors.humidity || '-';
    UI.lux.textContent = sensors.light_percent || sensors.lux_value || '-';

    if (sensorChart) {
        const now = new Date().toLocaleTimeString();
        sensorChart.data.labels.push(now);
        sensorChart.data.datasets[0].data.push(pHValue);

        // 데이터가 너무 많아지면 앞부분 삭제 (최근 20개만 유지)
        if (sensorChart.data.labels.length > 20) {
            sensorChart.data.labels.shift();
            sensorChart.data.datasets[0].data.shift();
        }
        sensorChart.update('none'); // 애니메이션 없이 빠르게 업데이트
    }
    updateRadarData(sensors);
    updateProgressBar(UI.barHum, sensors.humidity);
    updateProgressBar(UI.barLux, sensors.light_percent || sensors.lux_value);
}

function updateBar(element, value) {
    if (!element) return;
    element.style.setProperty('--v', value);
    element.querySelector('.bar__val').textContent = value;
}

function calculateScore(current, target) {
    if (!current) return 0;
    const diff = Math.abs(current - target);
    const score = 100 - (diff / target * 100); 
    return Math.max(0, Math.min(100, score)); 
}

// [추가] 4. 레이더 차트 업데이트 함수
function updateRadarData(sensors) {
    if (!radarChart) return;
    
    const scores = [
        calculateScore(sensors.ph || sensors.ph_value || 0, TARGETS.ph),
        calculateScore(sensors.ec || sensors.ec_value || 0, TARGETS.ec),
        calculateScore(sensors.water_temp || 0, TARGETS.wTemp),
        calculateScore(sensors.do || sensors.do_value || 0, TARGETS.do),
        calculateScore(sensors.air_temp || 0, TARGETS.aTemp)
    ];

    radarChart.data.datasets[0].data = scores;
    radarChart.update();
}

function renderBboxes(bboxes) {
    // 기존 bbox 제거
    const existing = UI.bboxContainer.querySelectorAll('.bbox');
    existing.forEach(b => b.remove());

    if (!bboxes) return;
    // bboxes: [{label: '상추', x: 10, y: 20, w: 15, h: 20}, ...]
    bboxes.forEach(box => {
        const div = document.createElement('div');
        div.className = 'bbox';
        div.style.left = `${box.x}%`;
        div.style.top = `${box.y}%`;
        div.style.width = `${box.w}%`;
        div.style.height = `${box.h}%`;
        div.innerHTML = `<span class="bbox__label">${box.label}</span>`;
        UI.bboxContainer.appendChild(div);
    });
}

function setupSocketListeners() {
    // 실시간 센서 업데이트
    socket.on('realtime_stats', (data) => {
        if (data.serial_number === DEVICE_SERIAL) {
            applySensorValues(data.sensors);
        }
    });

    // 실시간 사진 업데이트 알림
    socket.on('new_monitoring_photo', (data) => {
        if (data.serial_number === DEVICE_SERIAL) {
            // 이미지 업데이트 (캐시 방지)
            UI.cameraFeed.src = `${data.photo_url}?t=${Date.now()}`;
            
            // 시각적 피드백
            const panel = document.getElementById('camera-panel');
            if (panel) {
                panel.style.boxShadow = '0 0 20px rgba(46, 204, 113, 0.5)';
                setTimeout(() => panel.style.boxShadow = 'none', 1000);
            }
            
            // 사진이 바뀌면 분석 결과도 다시 가져오기
            loadInitialData();
        }
    });
}

function initChart() {
    const ctx = document.getElementById('realtimeChart').getContext('2d');
    sensorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // 시간 축
            datasets: [{
                label: 'pH',
                borderColor: '#39c8ff', // 우리 디자인 포인트 컬러!
                backgroundColor: 'rgba(57, 200, 255, 0.1)',
                data: [],
                borderWidth: 2,
                tension: 0.4, // 곡선 부드럽게
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: false },
                y: { 
                    // [핵심 수정 부분] y축의 최솟값과 최댓값을 고정합니다!
                    min: 5.5,
                    max: 8,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { 
                        color: '#fff',
                        stepSize: 0.5 // 0.5 단위로 눈금을 표시하면 더 깔끔해요!
                    }
                }
            },
            plugins: { legend: { display: false } } // 범례 생략해서 깔끔하게
        }
    });
}

function initRadarChart() {
    const ctx = document.getElementById('radarChart').getContext('2d');
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['pH', 'EC', '수온', 'DO', '온도'],
            datasets: [{
                label: '현재 상태',
                data: [0, 0, 0, 0, 0], // 초기값
                backgroundColor: 'rgba(57, 200, 255, 0.2)',
                borderColor: '#39c8ff',
                pointBackgroundColor: '#39c8ff',
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                r: {
                    min: 0,
                    max: 100, // 만점은 100점!
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#fff', font: { size: 12 } },
                    ticks: { display: false } // 숫자 라벨은 숨겨서 깔끔하게
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// 막대그래프
function updateProgressBar(element, value) {
    if (!element) return;
    const roundedValue = Math.round(value || 0);
    element.style.setProperty('--v', roundedValue); // CSS 변수 업데이트
    const valText = element.querySelector('.bar__val');
    if (valText) valText.textContent = roundedValue; // 숫자 텍스트 업데이트
}

async function loadGrowthMetrics() {
    try {
        // currentModule.module_id 혹은 DEVICE_SERIAL 등을 사용
        const response = await API.getGrowthData(currentModule.module_id);
        
        if (response && response.success) {
            const data = response.data; // 백엔드 구조에 따라 response.data 혹은 response 바로 사용
            // console.log(data);
            
            // 1. 성장도 백분율 막대 업데이트 (growth_rate_pct)
            updateProgressBar(UI.barGrowth, data.growth_rate_pct);
            
            // 2. 한 줄 분석(one_liner) 배너 업데이트
            if (UI.aiReview1) {
                UI.aiReview1.textContent = data.one_liner || "데이터 분석 중입니다...";
            }
            
            // 3. (팁) 예상 수확일 같은 추가 정보가 있다면 콘솔이나 UI에 표시
            console.log(`🌱 예상 수확일: ${data.expected_harvest_date}`);
        }
    } catch (error) {
        console.error("생육 지표 로드 실패:", error);
    }
}

function setupImageFallback() {
    const DEFAULT_IMAGE = '/assets/images/monitoring_3.jpg'; // 기본 이미지 경로

    UI.cameraFeed.onerror = function () {
        console.warn('이미지 로드 실패 → 기본 이미지로 대체');
        this.onerror = null; // 무한 루프 방지
        this.src = DEFAULT_IMAGE;
    };
}
init();