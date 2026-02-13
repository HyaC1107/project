// js/monitoring.js
import * as API from './common/api.js';
import * as Socket from './common/socket.js';

const UI = {
    profileImg: document.querySelector('.profile img'),
    profileName: document.querySelector('.profile-name'),
    cameraGrid: document.querySelector('.camera-grid')
};

let socket = null;
let devices = [];

async function init() {
    // 1. 인증 체크 및 사용자 정보 반영
    const auth = await API.checkAuthStatus();
    if (!auth || !auth.isLoggedIn) return;

    if (UI.profileName) UI.profileName.textContent = auth.user.nickname || '관리자님';
    if (auth.user.profile_img && UI.profileImg) UI.profileImg.src = auth.user.profile_img;

    // 2. 소켓 초기화 및 연결
    socket = Socket.initSocket();

    // 3. 기기 목록 로드 및 렌더링
    await loadMonitoringData();

    // 4. 실시간 소켓 이벤트 리스너 등록
    setupSocketListeners();
}

async function loadMonitoringData() {
    if (!UI.cameraGrid) return;
    
    try {
        const response = await API.getMyDevices();
        devices = (response.data || []).reverse();
        UI.cameraGrid.innerHTML = '';

        for (const device of devices) {
            // 초기 이미지 로드 (캐시 방지 timestamp)
            const timestamp = Date.now();
            const imageUrl = `http://localhost:5000/api/ai/image/module/${device.module_id}/latest?t=${timestamp}`;

            const card = document.createElement('a');
            card.className = 'camera-card';
            // id를 부여해서 소켓 수신 시 특정 카드만 찾기 쉽게 함
            card.id = `card-${device.serial_number}`; 
            card.href = `monitoring-cam-detail.html?cam=${device.serial_number}`;
            
            card.innerHTML = `
                <div class="camera-card__top">
                    <span class="dot"></span>
                    <span class="camera-card__title">${device.module_name}</span>
                </div>
                <div class="camera-card__img">
                    <img src="${imageUrl}" alt="${device.module_name}" 
                         onerror="this.src='./assets/images/monitoring_1.jpg'" />
                </div>
            `;
            UI.cameraGrid.appendChild(card);
            
            // 실시간 데이터를 받기 위해 각 기기별 방에 입장
            Socket.joinDeviceRoom(device.serial_number);
        }
    } catch (e) {
        console.error("데이터 로드 실패:", e);
    }
}

function setupSocketListeners() {
    // [핵심] 새로운 모니터링 사진이 업로드되었을 때
    socket.on('new_monitoring_photo', (data) => {
        // data.serial_number와 일치하는 카드를 찾음
        const targetCard = document.getElementById(`card-${data.serial_number}`);
        if (targetCard) {
            const imgTag = targetCard.querySelector('img');
            const dotTag = targetCard.querySelector('.dot');
            
            // 1. 이미지 업데이트 (캐시 방지)
            imgTag.src = `${data.photo_url}?t=${Date.now()}`;

            // 2. 시각적 피드백 (테두리 깜빡임 + 점 색상 변경)
            targetCard.style.transition = 'outline 0.3s ease';
            targetCard.style.outline = '3px solid #2ecc71';
            if (dotTag) dotTag.style.backgroundColor = '#2ecc71';

            // 3. 효과 제거
            setTimeout(() => {
                targetCard.style.outline = 'none';
                if (dotTag) dotTag.style.backgroundColor = '#ff4d4d'; // 다시 대기 상태로
            }, 1000);
        }
    });
}

init();