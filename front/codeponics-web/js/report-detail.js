// js/report-detail.js
import * as API from './common/api.js';

const params = new URLSearchParams(window.location.search);
const moduleId = params.get('id') || '1';
let reportCharts = {};
let currentType = 'day'; // 현재 탭 상태 (day 또는 week)
const UI = {
    profileImg: document.querySelector('.profile img'),
    profileName: document.querySelector('.profile-name'),
    reportGrid: document.querySelector('.cards-row') // 카드가 들어갈 컨테이너
};
// 1. 관리자님 설정 적정 수치 (차트 범위 및 상태 판단 기준)
const TARGETS = {
    ph: 6.5,
    ec: 1.2,
    wTemp: 23,
    do: 8,
    aTemp: 25
};

// 2. Y축 고정 범위 (그래프 요동 방지)
const Y_RANGES = {
    ph: { min: 5.5, max: 8 },
    ec: { min: 0, max: 3 },
    wTemp: { min: 10, max: 35 },
    do: { min: 0, max: 15 },
    aTemp: { min: 10, max: 40 },
    hum: { min: 0, max: 100 }
};

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await API.checkAuthStatus();
    if (!auth || !auth.isLoggedIn) {
        window.location.href = "/index.html";
        return;
    }

    if (UI.profileName) UI.profileName.textContent = auth.user.nickname || '관리자님';
    if (auth.user.profile_img && UI.profileImg) UI.profileImg.src = auth.user.profile_img;
    initTabEvents();
    await loadInitialReportData();
});

/**
 * [이벤트] 탭 전환 및 데이터 유지
 */
function initTabEvents() {
    const tabs = document.querySelectorAll('.tab-btn');
    
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // UI 변경
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // 상태 변경 (첫 번째 버튼은 day, 두 번째는 week)
            currentType = index === 0 ? 'day' : 'week';
            
            // 타이틀 변경 (센스!)
            const title = document.querySelector('.page-title');
            if (title) title.textContent = `${currentType === 'day' ? '일간' : '주간'} 분석 리포트`;

            // 데이터 다시 불러오기
            await loadInitialReportData();
        });
    });
}

/**
 * [데이터 로드] 일간/주간 타입에 따라 다른 DB 테이블 조회
 */
async function loadInitialReportData() {
    try {
        let aiData = null;

        if (currentType === 'day') {
            // 1. 일간: 기존 ai_results_crops 등에서 최신 분석 결과 가져오기
            const aiResponse = await API.getLatestAnalysis(moduleId);
            if (aiResponse && aiResponse.success) {
                aiData = aiResponse.data;
            }
        } else {
            // 2. 주간: 새로운 테이블(ai_weekly_reports)에서 가져오는 전용 API 호출
            // API.getWeeklyReport 함수가 백엔드에서 ai_weekly_reports를 조회하도록 구성하세요!
            const weeklyResponse = await API.getWeeklyReport(moduleId);
            if (weeklyResponse && weeklyResponse.success) {
                // weeklyResponse.data.content가 JSON 문자열이면 파싱, 아니면 그대로 사용
                aiData = typeof weeklyResponse.data.content === 'string' 
                         ? JSON.parse(weeklyResponse.data.content) 
                         : weeklyResponse.data.content;
            }
        }

        // UI 업데이트 실행 (가져온 데이터를 꽂아줍니다)
        if (aiData) {
            updateAiReportUI(aiData, currentType);
        }

        // 3. 센서 히스토리는 공통으로 가져오되 타입(day/week)만 파라미터로 전달
        const statsResponse = await API.getSensorHistory(moduleId, currentType); 
        if (statsResponse && statsResponse.success && statsResponse.data.logs) {
            renderAllCharts(statsResponse.data.logs, currentType);
        }
    } catch (error) {
        console.error(`🚨 ${currentType} 리포트 로딩 실패:`, error);
        // 에러 시 사용자에게 알림 (선택)
        const llmText = document.getElementById('llm-report-text');
        if (llmText) llmText.textContent = "리포트 데이터를 가져오는 데 실패했습니다.";
    }
}

/**
 * [UI 업데이트] LLM 리포트 및 상단 요약 배지 업데이트
 */
function updateAiReportUI(data,type) {
    if (!data) return;

    // 상단 요약 카드 업데이트
    const uniformityVal = document.querySelector('.uniformity-val');
    if (uniformityVal) {
        uniformityVal.innerHTML = `${data.uniformity || 5}% <span class="badge green">양호</span>`;
    }

    const goalVal = document.querySelector('.goal-val');
    if (goalVal) {
        goalVal.innerHTML = `${data.growth_rate_pct || 0}% <span class="badge lightblue">품질최상</span>`;
    }

    // LLM 상세 리포트 본문 업데이트
    const llmText = document.getElementById('llm-report-text');
    if (llmText) {
        // 주간일 경우 data.weekly_report, 일간일 경우 data.daily_report 사용
        llmText.innerHTML = type === 'day' ? 
            (data.daily_report || "일간 리포트 생성 중...") : 
            (data.weekly_report || "주간 분석 리포트 생성 중입니다. 잠시만 기다려주세요!");
    }

    // AI TIP 업데이트
    const aiTip = document.getElementById('ai-recommendation');
    if (aiTip && data.one_line_review) {
        aiTip.textContent = data.one_line_review;
    }
}

/**
 * [UI 업데이트] 상단 스택 및 환경 정보 수치
 */
function updateSummaryStats(latestLog) {
    if (!latestLog) return;
    
    // 수질 정보 스택
    const stackItems = document.querySelectorAll('.stack-item strong');
    if (stackItems[0]) stackItems[0].textContent = `${latestLog.ec_value || 0} dS/m`;
    if (stackItems[1]) stackItems[1].textContent = `${latestLog.ph_value || 0} pH`;
    if (stackItems[2]) stackItems[2].textContent = `${latestLog.do_value || 0} mg/L`;

    // 환경 정보 박스
    const envValues = document.querySelectorAll('.report-box .value');
    if (envValues[0]) envValues[0].innerHTML = `${latestLog.light_percent || 0}<span class="unit">%</span>`;
    if (envValues[1]) envValues[1].innerHTML = `${latestLog.air_temp || 0}<span class="unit">%</span>`;
    if (envValues[2]) envValues[2].innerHTML = `${latestLog.humidity || 0}<span class="unit">%</span>`;
}

function createChart(canvasId, datasets, labels, useDualAxes = false, ranges = {}) {
    // 1. [핵심 해결] 기존 차트가 있다면 완전히 파괴하고 캔버스 점유 해제
    // reportCharts 객체에 인스턴스가 잘 담겨있어야 이 로직이 작동합니다!
    if (reportCharts[canvasId] instanceof Chart) {
        reportCharts[canvasId].destroy();
    }

    // 2. HTML 구조에서 해당 차트가 들어갈 박스 찾기
    const chartIds = ['chart-growth', 'chart-ph-ec', 'chart-water', 'chart-air', 'chart-lux'];
    const boxIndex = chartIds.indexOf(canvasId);
    const box = document.querySelectorAll('.chart-box')[boxIndex];
    
    if (!box) {
        console.error(`🚨 ${canvasId}를 넣을 .chart-box를 찾을 수 없습니다.`);
        return null;
    }

    // 3. 박스 안에 canvas가 없으면 동적 생성
    let canvas = box.querySelector('canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = canvasId;
        box.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');

    // 4. 그래프 배경을 흰색으로 채우는 플러그인 정의
    const whiteBgPlugin = {
        id: 'customCanvasBackgroundColor',
        beforeDraw: (chart) => {
            const { ctx: chartCtx } = chart;
            chartCtx.save();
            chartCtx.globalCompositeOperation = 'destination-over';
            chartCtx.fillStyle = '#ffffff';
            chartCtx.fillRect(0, 0, chart.width, chart.height);
            chartCtx.restore();
        }
    };

    // 5. 기본 축 설정 (기존 디자인 유지)
    const scalesConfig = {
        x: {
            grid: { display: false },
            ticks: {
                color: '#888',
                font: { size: 10 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 12 
            }
        },
        y: { 
            position: 'left',
            min: ranges.yMin, 
            max: ranges.yMax,
            grid: { color: '#f0f0f0' },
            ticks: { color: '#333', font: { size: 11 } }
        }
    };

    // 6. 듀얼 Y축 설정 (기존 디자인 유지)
    if (useDualAxes && datasets.length > 1) {
        scalesConfig.y1 = {
            position: 'right',
            min: ranges.y1Min,
            max: ranges.y1Max,
            grid: { drawOnChartArea: false },
            ticks: { 
                color: datasets[1].borderColor,
                font: { size: 11 }
            }
        };
        datasets[0].yAxisID = 'y';
        datasets[1].yAxisID = 'y1';
    }

    // 7. [중요] 새 차트 객체를 생성함과 동시에 전역 변수 reportCharts에 할당!
    // 이렇게 해야 다음 탭 클릭 시 위쪽의 destroy()가 이 녀석을 찾아낼 수 있어요.
    reportCharts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        plugins: [whiteBgPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            elements: {
                point: { radius: 0 },
                line: { borderWidth: 2, tension: 0.3 }
            },
            plugins: {
                legend: { 
                    position: 'top', 
                    labels: { color: '#333', boxWidth: 12, font: { size: 11 } } 
                },
                tooltip: { 
                    mode: 'index', 
                    intersect: false 
                }
            },
            scales: scalesConfig
        }
    });

    return reportCharts[canvasId];
}

/**
 * [차트 실행] 각 섹션별 데이터 매핑
 */
function renderAllCharts(logs) {
    if (!logs || logs.length === 0) return;

    // 1. 데이터 샘플링 (15분 간격)
    const sampledLogs = logs.filter((_, index) => index % 3 === 0);

    // 2. 데이터셋 가공
    const dataSets = {
        ph: sampledLogs.map(l => l.ph_value),
        ec: sampledLogs.map(l => l.ec_value),
        wTemp: sampledLogs.map(l => l.water_temp),
        do: sampledLogs.map(l => l.do_value),
        aTemp: sampledLogs.map(l => l.air_temp),
        hum: sampledLogs.map(l => l.humidity),
        lux: sampledLogs.map(l => l.light_percent || l.lux_value)
    };

    // [핵심 수정] X축 라벨을 데이터 시간이 아닌, 0시부터 23시까지의 고정 라벨로 사용하고 싶을 때
    // 또는 데이터의 created_at을 활용해 시각화합니다.
    const timeLabels = sampledLogs.map(l => {
        const d = new Date(l.created_at);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    // 4. 차트 생성 실행 (Y_RANGES는 기존 정의 사용)
    // pH & EC (수질)
    reportCharts.phEc = createChart('chart-ph-ec', [
        { label: 'pH(좌)', data: dataSets.ph, borderColor: '#0984e3', tension: 0.4 },
        { label: 'EC(우)', data: dataSets.ec, borderColor: '#00b894', tension: 0.4 }
    ], timeLabels, true, { yMin: Y_RANGES.ph.min, yMax: Y_RANGES.ph.max, y1Min: Y_RANGES.ec.min, y1Max: Y_RANGES.ec.max });

    // 수온 & DO
    reportCharts.water = createChart('chart-water', [
        { label: '수온(좌)', data: dataSets.wTemp, borderColor: '#d63031', tension: 0.4 },
        { label: 'DO(우)', data: dataSets.do, borderColor: '#e17055', tension: 0.4 }
    ], timeLabels, true, { yMin: Y_RANGES.wTemp.min, yMax: Y_RANGES.wTemp.max, y1Min: Y_RANGES.do.min, y1Max: Y_RANGES.do.max });

    // 기온 & 습도
    reportCharts.air = createChart('chart-air', [
        { label: '기온(좌)', data: dataSets.aTemp, borderColor: '#fdcb6e', tension: 0.4 },
        { label: '습도(우)', data: dataSets.hum, borderColor: '#74b9ff', tension: 0.4 }
    ], timeLabels, true, { yMin: Y_RANGES.aTemp.min, yMax: Y_RANGES.aTemp.max, y1Min: Y_RANGES.hum.min, y1Max: Y_RANGES.hum.max });

    // 조도
    reportCharts.lux = createChart('chart-lux', [
        { label: '조도(%)', data: dataSets.lux, borderColor: '#f1c40f', tension: 0.4, fill: true, backgroundColor: 'rgba(241, 196, 15, 0.05)' }
    ], timeLabels, false, { yMin: 0, yMax: 100 });
}