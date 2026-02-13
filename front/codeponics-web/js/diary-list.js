// js/diary-list.js
import * as API from './common/api.js';

const UI = {
    profileImg: document.querySelector('.profile img'),
    profileName: document.querySelector('.profile-name'),
    diaryGrid: document.querySelector('.cards-row'), // 일지 카드가 들어갈 컨테이너
    pagination: document.getElementById('diary-pagination')
};
let allDevices = [];
let currentPage = 1;
const itemsPerPage = 6;

async function init() {
    // 1. 인증 체크 (관리자님 스타일 유지!)
    const auth = await API.checkAuthStatus();
    if (!auth || !auth.isLoggedIn) {
        window.location.href = "/index.html";
        return;
    }

    if (UI.profileName) UI.profileName.textContent = auth.user.nickname || '관리자님';
    if (auth.user.profile_img && UI.profileImg) UI.profileImg.src = auth.user.profile_img;

    // 2. 일지 목록 로드
    await loadRawData();
    renderPage(1);
}

async function loadRawData() {
    try {
        const response = await API.getMyDevices();
        allDevices = (response.data || []).reverse();
    } catch (e) {
        console.error("데이터 로드 실패:", e);
    }
}

/** [렌더링] 특정 페이지의 카드들만 화면에 출력 */
function renderPage(page) {
    if (!UI.diaryGrid) return;
    currentPage = page;

    // 1. 카드 렌더링
    UI.diaryGrid.innerHTML = '';
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = allDevices.slice(start, end);

    pageItems.forEach(device => {
        const timestamp = Date.now();
        const imageUrl = `http://localhost:5000/api/ai/image/module/${device.module_id}/latest?t=${timestamp}`;
        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `
            <div class="photo">
                <img src="${imageUrl}" onerror="this.src='assets/images/report_list1.png'">
                <div class="card-badges"><div class="zone-badge">${device.module_name}</div></div>
            </div>
            <a class="content-link" href="diary-history.html?id=${device.module_id}&crop=${encodeURIComponent(device.crop_type)}&fish=${encodeURIComponent(device.fish_type)}">
                <div class="crop-headline">🥬 ${device.crop_type}</div>
                <div class="fish-headline">🐟 ${device.fish_type}</div>
            </a>
        `;
        UI.diaryGrid.appendChild(card);
    });

    // 2. 페이징 버튼 생성
    renderPagination();
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