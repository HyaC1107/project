// js/report-list.js
import * as API from './common/api.js';

const UI = {
    profileImg: document.querySelector('.profile img'),
    profileName: document.querySelector('.profile-name'),
    reportGrid: document.querySelector('.cards-row'), // 카드가 들어갈 컨테이너
    pagination: document.getElementById('diary-pagination')
};
let currentPage = 1;
const itemsPerPage = 6;

async function init() {
    // 1. 인증 체크 및 사용자 정보 반영 (monitoring.js 스타일)
    const auth = await API.checkAuthStatus();
    if (!auth || !auth.isLoggedIn) {
        window.location.href = "/index.html";
        return;
    }

    if (UI.profileName) UI.profileName.textContent = auth.user.nickname || '관리자님';
    if (auth.user.profile_img && UI.profileImg) UI.profileImg.src = auth.user.profile_img;

    // 2. 리포트 목록 로드 및 렌더링
    await loadReportListData();
    renderPage(1);
}

async function loadReportListData() {
    if (!UI.reportGrid) return;
    
    try {
        const response = await API.getMyDevices();
        
        const devices = (response.data || []).reverse();
        
        // 기존 더미 HTML 비우기
        UI.reportGrid.innerHTML = '';
        
        for (const device of devices) {
            console.log(device);            
            const crop_res = await API.getGrowthData(device.module_id);
            const ai_crop = crop_res.data || [];
            console.log(ai_crop);
            // 객체를 ISO 문자열로 바꾼 뒤 'T'를 기준으로 자르기
            // 결과: "2026. 3. 14." 또는 "2026-03-14" (브라우저 설정에 따라 다름)
            const harvest_date = new Date(ai_crop.expected_harvest_date).toLocaleDateString('ko-KR').replace(/\. /g, '-').replace(/\.$/, '');
            const dday = calculateDDay(ai_crop.expected_harvest_date);
            // 이미지 로드 (대시보드/모니터링과 동일한 최신 이미지 엔드포인트)
            const timestamp = Date.now();
            const imageUrl = `http://localhost:5000/api/ai/image/module/${device.module_id}/latest?t=${timestamp}`;
            
            // 성장도에 따른 게이지 색상 클래스 (90% 이상 위험)
            const gaugeClass = (device.growth_rate_pct >= 90) ? 'danger' : '';
            // D-Day 배지 클래스 (D-5 이내면 빨간색)
            const ddayClass = (dday <= 5) ? 'red' : '';

            const card = document.createElement('article');
            card.className = 'card';
            card.id = `report-card-${device.serial_number}`;

            card.innerHTML = `
                <a class="card-link" href="report-detail.html?id=${device.module_id}">
                    <div class="photo">
                        <img src="${imageUrl}" alt="${device.module_name}" 
                             onerror="this.src='assets/images/report_list1.png'">
                        <div class="card-badges">
                            <div class="zone-badge">${device.module_name}</div>
                            <div class="dday-badge ${ddayClass}">D-${dday || '?' }</div>
                        </div>
                    </div>
                    <div class="content">
                        <div class="crop-headline">🌿 ${device.crop_type || '작물 없음'}</div>
                        <div class="fish-headline">🐟 ${device.fish_type || '어종 없음'}</div>
                        <div class="harvest-headline">📅 수확 예정일 <span class="harvest-date">${harvest_date || '미정'}</span></div>

                        <div class="gauge-wrapper ${gaugeClass}">
                            <div class="gauge-info">
                                <span class="gauge-percent">${ai_crop.growth_rate_pct || 0}% 성장</span>
                            </div>
                            <div class="gauge-bar">
                                <div class="fill" style="width: ${ai_crop.growth_rate_pct || 0}%;"></div>
                            </div>
                        </div>
                    </div>
                </a>
            `;
            UI.reportGrid.appendChild(card);
        }
    } catch (e) {
        console.error("리포트 목록 로드 실패:", e);
    }
    renderPagination();
}
function calculateDDay(isoString) {
    if (!isoString) return null;

    const targetDate = new Date(isoString);
    const today = new Date();

    // 시간 정보를 00:00:00으로 맞추어 날짜 차이만 정확히 계산
    targetDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    // 날짜 차이 계산 (밀리초 -> 일)
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
}

function renderPagination() {
    if (!UI.pagination) return;
    const totalPages = Math.ceil(allDevices.length / itemsPerPage);
    UI.pagination.innerHTML = '';

    if (totalPages <= 1) return; // 1페이지뿐이면 페이징 안 보임

    // '이전' 버튼
    const prevBtn = document.createElement('div');
    prevBtn.className = `prev ${currentPage === 1 ? 'disabled' : ''}`;
    prevBtn.textContent = '이전';
    prevBtn.onclick = () => currentPage > 1 && renderPage(currentPage - 1);
    UI.pagination.appendChild(prevBtn);

    // 숫자 버튼
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('div');
        pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => renderPage(i);
        UI.pagination.appendChild(pageBtn);
    }

    // '다음' 버튼
    const nextBtn = document.createElement('div');
    nextBtn.className = `next ${currentPage === totalPages ? 'disabled' : ''}`;
    nextBtn.textContent = '다음';
    nextBtn.onclick = () => currentPage < totalPages && renderPage(currentPage + 1);
    UI.pagination.appendChild(nextBtn);
}

init();