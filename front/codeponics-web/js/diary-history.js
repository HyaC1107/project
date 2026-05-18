// js/diary-history.js
import * as API from './common/api.js';

const params = new URLSearchParams(window.location.search);
const moduleId = params.get('id') || '1';
const cropName = params.get('crop') || '작물';

const UI = {
    profileImg: document.querySelector('.profile img'),
    profileName: document.querySelector('.profile-name'),
    historyTitle: document.getElementById('history-title'),
    historyGrid: document.getElementById('history-grid'), // 카드가 들어갈 컨테이너
    pagination: document.getElementById('history-pagination')
};

let allJournals = [];
let currentPage = 1;
const itemsPerPage = 6;

async function init() {
    // 1. 인증 체크
    const auth = await API.checkAuthStatus();
    if (!auth || !auth.isLoggedIn) {
        window.location.href = "/index.html";
        return;
    }

    if (UI.profileName) UI.profileName.textContent = auth.user.nickname || '관리자님';
    if (auth.user.profile_img && UI.profileImg) UI.profileImg.src = auth.user.profile_img;

    // 2. 제목 세팅
    // if (UI.historyTitle) UI.historyTitle.textContent = `${cropName} 재배 히스토리`;

    // 3. 일지 목록 로드
    await loadHistoryData();
    renderPage(1);
}

/** [데이터 로드] 해당 모듈의 전체 일지 목록 가져오기 */
async function loadHistoryData() {
    try {
        const statsResponse = await API.getJournalList(moduleId); 
        console.log("서버 응답 확인:", statsResponse); // 여기서 구조를 꼭 확인해야 해요!
        
        // 1. 보통 axios 등을 쓰면 statsResponse.data 가 백엔드에서 보낸 result 객체입니다.
        // 백엔드 ai.js 라우터가 res.json({ success: true, data: result.rows }) 로 주니까요!
        const result = statsResponse.data || statsResponse; 
        // console.log(result[0]);
        
        if (result) {
            // 2. 최신 수확 기록이 위로 오도록 정렬
            allJournals = result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            // console.log("정렬된 데이터:", allJournals);
        } else {
            allJournals = [];
            console.warn("데이터가 배열 형식이 아닙니다.");
        }
        
    } catch (e) {
        console.error("히스토리 데이터 로드 실패:", e);
        allJournals = []; // 에러 시 빈 배열로 초기화해서 렌더링 에러 방지
    }
}

/** [렌더링] 특정 페이지의 일지 카드들만 출력 */
function renderPage(page) {
    if (!UI.historyGrid) return;
    currentPage = page;

    UI.historyGrid.innerHTML = '';
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = allJournals.slice(start, end);

    if (pageItems.length === 0) {
        UI.historyGrid.innerHTML = '<p class="no-data" style=" text-align:center; width:100%; margin-top:50px;">아직 저장된 수확 기록이 없습니다. 🌿</p>';
        return;
    }

    pageItems.forEach(journal => {
        // 1. JSON 파싱 및 데이터 유효성 검사
        let content = {};
        try {
            content = typeof journal.journal_content === 'string' 
                    ? JSON.parse(journal.journal_content) 
                    : journal.journal_content;
        } catch (e) {
            console.error("JSON 파싱 에러:", e);
        }

        // 2. [에러 포인트 해결] diaries 혹은 entries 둘 다 체크하도록 방어막 구축!
        const diaryList = content.diaries || content.entries || [];
        
        // 3. 썸네일 결정 (데이터가 있으면 마지막 사진, 없으면 기본 이미지)
        let thumbnail = 'assets/images/report_list1.png'; // 기본 이미지
        if (diaryList.length > 0 && diaryList[diaryList.length - 1].photo_base64) {
            thumbnail = diaryList[diaryList.length - 1].photo_base64;
        }
        
        // 4. 날짜 포맷팅
        const formattedDate = new Date(journal.created_at).toLocaleDateString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).replace(/\. /g, '-').replace(/\./g, '');

        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `
            <a class="card-link" href="diary-view-start.html?journal_id=${journal.journal_id}">
                <div class="photo">
                    <img src="${thumbnail}" alt="수확사진" onerror="this.src='assets/images/report_list1.png'">
                    <div class="card-badges">
                        <div class="zone-badge">완료</div>
                    </div>
                </div>
                <div class="content">
                    <div class="crop-headline">📅 ${formattedDate} 수확</div>
                    <div class="fish-headline">🌿 ${content.crop_type || '작물'} 일지 보기</div>
                </div>
            </a>
        `;
        UI.historyGrid.appendChild(card);
    });

    renderPagination();
}

/** [페이징 생성] */
function renderPagination() {
    if (!UI.pagination) return;
    const totalPages = Math.ceil(allJournals.length / itemsPerPage);
    UI.pagination.innerHTML = '';

    if (totalPages <= 1) return;

    const prevBtn = document.createElement('div');
    prevBtn.className = `prev ${currentPage === 1 ? 'disabled' : ''}`;
    prevBtn.textContent = '이전';
    prevBtn.onclick = () => currentPage > 1 && renderPage(currentPage - 1);
    UI.pagination.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('div');
        pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => renderPage(i);
        UI.pagination.appendChild(pageBtn);
    }

    const nextBtn = document.createElement('div');
    nextBtn.className = `next ${currentPage === totalPages ? 'disabled' : ''}`;
    nextBtn.textContent = '다음';
    nextBtn.onclick = () => currentPage < totalPages && renderPage(currentPage + 1);
    UI.pagination.appendChild(nextBtn);
}

init();