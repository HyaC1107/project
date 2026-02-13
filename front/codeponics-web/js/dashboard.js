import * as API from './common/api.js';
import * as Socket from './common/socket.js';

// DOM 요소 참조 (HTML에 이미 존재하는 요소들)
const UI = {
    userProfileImg: document.querySelector('.profile img'),
    userName: document.getElementById('user-name'),
    currentDate: document.getElementById('current-date'),
    
    // 드롭다운 관련
    zoneSelectContainer: document.getElementById('zone-select-container'),
    zoneSelectBtn: document.getElementById('zone-select-btn'),
    deviceSelectList: document.getElementById('device-select-list'),
    selectedDeviceName: document.getElementById('selected-device-name'),

    // 센서 값 표시 요소
    valPh: document.getElementById('val-ph'),
    valEc: document.getElementById('val-ec'),
    valWTemp: document.getElementById('val-water-temp'),
    valDo: document.getElementById('val-do'),    

    // 작물용
    valATemp: document.getElementById('val-air-temp'),
    valHum: document.getElementById('val-humidity'),
    valLux: document.getElementById('val-lux'),
    
    // AI 브리핑 (LLM 결과물)
    aiBriefText: document.getElementById('ai-brief-text'),
    topBanner: document.getElementById('top-banner'),

    // 카메라 및 제어
    cameraFeed: document.getElementById('camera-feed'),
    // cameraTime: document.getElementById('camera-time'),
    btnPump: document.getElementById('btn-pump-control'),
    
    // 더미생성용
    btnAddDummy: document.getElementById('btn-add-dummy'),

    // 알림
    notiBell: document.getElementById('noti-bell'),
    alertBox: document.getElementById('alert-box'),
    logoutBtn: document.getElementById('logout-btn')
};
// --- [추가] 센서별 적정 범위 설정 (상추/일반 수경재배 기준) ---
const SENSOR_THRESHOLDS = {
    ph: { min: 6.0, max: 7.5, warn_margin: 0.2 }, // 5.2~5.5 또는 6.5~6.8은 주황색
    ec: { min: 1.2, max: 2.5, warn_margin: 0.2 },
    water_temp: { min: 18, max: 24, warn_margin: 3 },
    do: { min: 7, max: 12, warn_margin: 1.5 }, // DO는 낮을수록 위험
    air_temp: { min: 20, max: 28, warn_margin: 4 },
    humidity: { min: 40, max: 70, warn_margin: 10 }
};
const DEFAULT_CAMERA_IMAGE = "/assets/images/monitoring_3.jpg";

// 상태 변수
let currentModule = null;
let socket = null;

// 초기화
async function init() {
    // 1. 날짜 표시
    // const now = new Date();
    // UI.currentDate.textContent = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일`;
    // 2. 인증 및 유저 정보
    const auth = await API.checkAuthStatus();
    if (!auth || !auth.isLoggedIn) {
        alert("로그인이 필요합니다!");
        window.location.href = "/index.html";
        return; // index.html로 리다이렉트 처리됨 inside API
    }
    
    UI.userName.textContent = `${auth.user.nickname || '농부'}`;        
    if (auth.user.profile_img) {
        UI.userProfileImg.src = auth.user.profile_img;        
    }
    
    fetchWeatherViaBackend();
    // 3. 소켓 연결
    socket = Socket.initSocket();

    // 4. 기기 목록 로드 -> 초기 기기 선택
    await loadDevices();
    
    // 5. 이벤트 리스너 등록
    setupEventListeners();
    UI.cameraFeed.onerror = function () {
        console.warn("카메라 이미지 로드 실패 → 기본 이미지로 대체");
        this.onerror = null; // 무한 루프 방지
        this.src = DEFAULT_CAMERA_IMAGE;
    };

}

function fetchWeatherViaBackend() {
    // 1. 날씨 카드 요소 찾기 (제공해주신 HTML 클래스 기준)
    const weatherCard = document.querySelector('.weather-card');
    
    // 카드가 없으면 실행하지 않음 (HTML에 해당 코드를 추가해야 함)
    if (!weatherCard) {
        console.warn("⚠️ .weather-card 요소를 찾을 수 없습니다. 대시보드 HTML에 해당 카드를 추가해주세요.");
        return;
    }

    const mainValue = weatherCard.querySelector('.main-value');
    const dayValue = weatherCard.querySelector('.weather-day');
    const infoSpans = weatherCard.querySelectorAll('.weather-info span');
    const iconImg = weatherCard.querySelector('.weather-icon');

    // 2. 요일 업데이트
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const now = new Date();
    if (dayValue) dayValue.textContent = days[now.getDay()];

    // 3. 위치 기반 날씨 조회
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            // console.log(lat, lon);
            
            try {
                // 백엔드 호출
                const res = await API.getWeather(lat, lon);
                
                if (res.success) {
                    const { temp, humidity, status } = res;
                    
                    // 수치만 변경 (디자인 유지)
                    if (mainValue) mainValue.textContent = `${temp}°`;
                    
                    // 상세 정보 업데이트
                    // 첫 번째 span: 습도 (기존 강수 대신)
                    if (infoSpans[0]) infoSpans[0].textContent = `습도 ${humidity}%`;
                    
                    // 두 번째 span: 날씨 상태 (기존 풍속 대신)
                    // 현재 백엔드에서 풍속을 주지 않으므로 '맑음', '비' 등의 상태로 대체
                    if (infoSpans[1]) infoSpans[1].textContent = status;

                    // 아이콘 alt 텍스트 업데이트 (이미지는 기존 에셋 유지)
                    if (iconImg) iconImg.alt = status;

                } else {
                    if (mainValue) mainValue.textContent = "--°";
                }
            } catch (error) {
                console.error("날씨 정보 로드 실패:", error);
            }
        }, () => {
             console.warn("위치 권한이 필요합니다.");
        });
    }
}
// 기기 목록 로드
async function loadDevices() {
    try {
        const response = await API.getMyDevices(); 
        const devices = response.data || [];
        // console.log(response.data);
        
        if (devices.length === 0) {
            UI.selectedDeviceName.textContent = "등록된 기기 없음";
            alert("등록된 기기가 없습니다. 설정 페이지로 이동합니다.");
            window.location.href = "/settings-main.html";
            return;
        }


        // 드롭다운 아이템 생성
        UI.deviceSelectList.innerHTML = '';
        devices.forEach((device, index) => {
            const button = document.createElement('button');
            button.className = 'zone-option';
            button.innerHTML = `
                <div class="option-title">${device.module_name}</div>                
            `;
            button.onclick = () => selectDevice(device);
            UI.deviceSelectList.appendChild(button);

            // 첫 번째 기기 자동 선택
            if (index === devices.length-1) selectDevice(device);
        });
    } catch (error) {
        console.error("기기 로드 실패:", error);
    }
}

// 기기 선택 시 동작
async function selectDevice(device) {
    currentModule = device;
    
    // 1. UI 업데이트
    UI.selectedDeviceName.textContent = device.module_name;
    UI.zoneSelectContainer.classList.remove('open'); // 드롭다운 닫기
    UI.zoneSelectBtn.setAttribute('aria-expanded', 'false');

    // 2. 소켓 방 변경
    Socket.joinDeviceRoom(device.serial_number);

    // 3. 데이터 갱신 (센서값 + 카메라)
    updateDashboardData(device);
    await fetchLatestAIAnalysis(device.module_id);
}
async function fetchLatestAIAnalysis(moduleId) {
    if (!UI.aiBriefText) return;

    UI.aiBriefText.textContent = "AI가 데이터를 분석하고 있습니다... 🐘";
    
    const res = await API.getLatestAnalysis(moduleId);
    if (res.success && res.data) {
        // DB에 저장된 최신 한줄평 표시
        // console.log(res);
        
        UI.aiBriefText.textContent = res.data.one_liner;
        // console.log("📍 초기 리포트 로드 완료:", res.data.one_liner);
    } else {
        UI.aiBriefText.textContent = "아직 분석된 리포트가 없습니다. 잠시만 기다려주세요! 🌱";
    }
}
// 대시보드 데이터 갱신 (API + Image)
async function updateDashboardData(device) {
    // 1. 이미지 업데이트 (캐시 방지)
    const timestamp = Date.now();
    const BASE_URL = window.location.origin;
    
    UI.cameraFeed.src = `http://localhost:5000/api/ai/image/module/${device.module_id}/latest?t=${timestamp}`;
    

    // UI.cameraFeed.src = `http://localhost:5000/api/ai/image/module/${device.module_id}/latest?t=${timestamp}`;
    UI.cameraFeed.style.opacity = '1';
    
    // 2. 최신 센서 데이터 가져오기 (API)
    try {
        const res = await API.getLatestSensorData();
        if(res.success && res.data) {
            const myData = res.data.find(d => d.module_id === device.module_id);
            if(myData && myData.sensor_data) {
                applySensorValues(myData.sensor_data);
            } else {
                // 데이터가 없을 경우 초기화
                applySensorValues({});
            }
        }
    } catch(e) { console.error(e); }
}

// 센서 값 UI 적용
function applySensorValues(data) {
    console.log(data);    
    const s = data || {}; 
    const mapping = [
        { el: UI.valPh, val: s.ph || s.ph_value, type: 'ph' },
        { el: UI.valEc, val: s.ec || s.ec_value, type: 'ec' },
        { el: UI.valWTemp, val: s.water_temp || s.w_temp, type: 'water_temp' },
        { el: UI.valDo, val: s.do || s.do_value, type: 'do' },
        { el: UI.valATemp, val: s.air_temp || s.a_temp, type: 'air_temp' },
        { el: UI.valHum, val: s.humidity, type: 'humidity' }
    ];

    mapping.forEach(item => {
        if (item.el) {
            const displayVal = (item.val !== undefined && item.val !== null) ? item.val : '-';
            item.el.textContent = displayVal;
            updateElementColor(item.el, getStatusType(displayVal, item.type));
        }
    });

    if (UI.valLux) {
        UI.valLux.textContent = s.light_percent || s.lux_value || '-';
    }
}
function updateElementColor(el, status) {
    if (!el) return;

    // 기존 클래스 제거
    const colorClasses = ['text-red-500', 'text-orange-500', 'text-green-500', 'text-slate-400', 'font-bold', 'animate-pulse'];
    el.classList.remove(...colorClasses);

    // 상태별 색상 및 스타일 적용
    switch (status) {
        case 'danger':
            el.style.color = '#ef4444'; // Red 500
            el.classList.add('text-red-500', 'font-bold', 'animate-pulse');
            break;
        case 'warning':
            el.style.color = '#f97316'; // Orange 500
            el.classList.add('text-orange-500', 'font-bold');
            break;
        case 'success':
            el.style.color = '#000'; // Green 500
            el.classList.add('text-green-500', 'font-bold');
            break;
        default:
            el.style.color = '#94a3b8'; // Slate 400 (회색)
            el.classList.add('text-slate-400');
            break;
    }
}

function getStatusType(value, type) {
    const val = parseFloat(value);
    if (isNaN(val)) return 'normal';
    const cfg = SENSOR_THRESHOLDS[type];
    if (!cfg) return 'normal';
    if (val < (cfg.min - cfg.warn_margin) || val > (cfg.max + cfg.warn_margin)) return 'danger';
    if (val < cfg.min || val > cfg.max) return 'warning';
    return 'success';
}
// 이벤트 리스너 설정
function setupEventListeners() {
    // 1. 드롭다운 토글 (요청하신 로직 적용)
    if (UI.zoneSelectContainer && UI.zoneSelectBtn) {
        // 버튼 클릭 시 토글
        UI.zoneSelectBtn.addEventListener('click', () => {
            const isOpen = UI.zoneSelectContainer.classList.toggle('open');
            UI.zoneSelectBtn.setAttribute('aria-expanded', String(isOpen));
        });

        // 드롭다운 항목 클릭 시 닫기 (이벤트 위임)
        // loadDevices에서 li에 onclick을 걸어두었지만, UI 동작(닫기)은 여기서 처리하면 깔끔합니다.
        if (UI.deviceSelectList) {
            UI.deviceSelectList.addEventListener('click', (event) => {
                // .zone-option 요소가 클릭되었는지 확인
                if (event.target.closest('.zone-dropdown')) {
                    UI.zoneSelectContainer.classList.remove('open');
                    UI.zoneSelectBtn.setAttribute('aria-expanded', 'false');
                }
            });
        }

        // 외부 클릭 시 닫기
        document.addEventListener('click', (event) => {
            if (!UI.zoneSelectContainer.contains(event.target)) {
                UI.zoneSelectContainer.classList.remove('open');
                UI.zoneSelectBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
    

    // 2. [NEW] 더미 기기 추가 버튼
    if (UI.btnAddDummy) {
        UI.btnAddDummy.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm("테스트용 더미 기기를 추가하시겠습니까? ➕")) return;

            // 랜덤 데이터 생성
            const randomId = Math.floor(Math.random() * 9000) + 1000;
            const dummyPayload = {
                serial_number: `DUMMY-${randomId}`,
                module_name: `테스트 팜 ${randomId}`,
                location: '거실',
                crop_type: '상추',
                fish_type: '금붕어'
            };

            try {
                const res = await API.registerDevice(dummyPayload);
                if (res.success) {
                    alert(`✅ '${dummyPayload.module_name}' 기기가 추가되었습니다!`);
                    // 목록 새로고침
                    currentModule = null; // 새로고침을 위해 초기화
                    await loadDevices(); 
                }
            } catch (err) {
                alert("기기 추가 실패: " + err.message);
            }
        });
    }

    // 3. 로그아웃
    // document.getElementById('logout-btn').addEventListener('click', () => {
    //     window.location.href = '/index.html'; 
    // });

    // --- 소켓 실시간 수신 ---
    socket.on('daily_report_updated', (data) => {
        if (UI.aiBriefText) {
            UI.aiBriefText.textContent = data.oneLiner;
            // 시각적 강조
            UI.aiBriefText.classList.add('highlight');
            setTimeout(() => UI.aiBriefText.classList.remove('highlight'), 2000);
        }
    });
    // 센서 데이터 수신
    socket.on('realtime_stats', (data) => {
        // console.log(data);        
        if (currentModule && data.serial_number === currentModule.serial_number) {
            applySensorValues(data.sensors);
        }
    });

    // 모니터링 사진 업데이트 알림
    socket.on('new_monitoring_photo', (data) => {
        console.log("데이터",data);
        
        if (currentModule) { // 시리얼 번호 체크 로직 추가 가능
            UI.cameraFeed.src = `${data.photo_url}?t=${Date.now()}`;
            
            const now = new Date();
            const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
            // UI.cameraTime.textContent = `업데이트: ${timeStr}`;
            
            // 깜빡임 효과
            UI.cameraFeed.parentElement.style.borderColor = '#2ecc71';
            setTimeout(() => UI.cameraFeed.parentElement.style.borderColor = 'transparent', 500);
        }
    });

    // 알림 수신
    socket.on('server_alert', (data) => {
        UI.notiBadge.style.display = 'block';
        UI.notiBadge.classList.add('bounce');
    });
}

// 앱 시작
init();