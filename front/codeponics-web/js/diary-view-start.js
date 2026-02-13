import * as API from './common/api.js';

const params = new URLSearchParams(window.location.search);
const journalId = params.get('journal_id'); // 히스토리 목록에서 넘겨준 ID

const UI = {
    profileName: document.querySelector('.profile-name'),
    profileImg: document.querySelector('.profile img'),
    pageTitle: document.querySelector('.page-title'),
    tags1: document.getElementById('tags1'),
    tags2: document.getElementById('tags2'),
    diaryTitle: document.getElementById('diaryTitle'),
    diaryBody1: document.getElementById('diaryBody1'),
    diaryBody2: document.getElementById('diaryBody2'),
    diaryBody3: document.getElementById('diaryBody3'),
    mainWrapper: document.querySelector('.diary-main .swiper-wrapper'),
    thumbWrapper: document.querySelector('.diary-thumbs .swiper-wrapper')
};

async function init() {
    // 1. 인증 체크 및 프로필 설정
    
    const auth = await API.checkAuthStatus();
    if (auth?.isLoggedIn) {
        if (UI.profileName) UI.profileName.textContent = auth.user.nickname || '관리자님';
        if (auth.user.profile_img && UI.profileImg) UI.profileImg.src = auth.user.profile_img;
    }
    
    // 2. 데이터 로드 및 렌더링
    if (journalId) {
        await loadJournalDetail(journalId);
    } else {
        alert("일지 정보가 없습니다!");
        location.href = 'diary-list.html';
    }
}

async function loadJournalDetail(journalId) {
    try {
        // 백엔드 라우터: /api/ai/journal/detail/:journal_id
        console.log(journalId);
        
        const response = await API.getJournalDetail(journalId);
        // const result = await response.json();
        console.log(response);
        
        if (response.data) {
            const journal = response.data;
            const content = journal.content; // JSONB 데이터
            
            // 🌟 1. journal_text와 timeline을 합쳐서 완벽한 슬라이드 데이터를 만듭니다.
            const diaryEntries = content.journal_text.map((text, index) => {
                return {
                    title: `${index + 1}번째 추억`,
                    content: text.content,
                    // timeline 배열에서 대응하는 사진 데이터를 가져옵니다.
                    // (만약 timeline에 base64가 없다면 서버에서 생성 시 넣어줘야 해요!)
                    photo: content.timeline[index]?.photo_base64 || "", 
                    date: content.timeline[index]?.date || journal.created_at,
                    health: content.timeline[index]?.health || "건강함"
                };
            });
            
            if (UI.pageTitle) UI.pageTitle.textContent = `${journal.crop_type || '작물'} 성장 일지`;
            UI.tags1.textContent = `🥬 ${journal.crop_type || '상추'}`;
            UI.tags2.textContent = `🐟 ${journal.fish_type || '향어'}`;

            // 🌟 2. 가공된 데이터를 전달합니다.
            renderSlides(diaryEntries);
        }
    } catch (e) {
        console.error("일지 상세 로드 실패:", e);
    }
}

function renderSlides(entries) {
    if (!UI.mainWrapper || !UI.thumbWrapper) return;

    UI.mainWrapper.innerHTML = '';
    UI.thumbWrapper.innerHTML = '';

    entries.forEach((item, index) => {
        // 1. 메인 큰 이미지 슬라이드
        const mainSlide = document.createElement('div');
        mainSlide.className = 'swiper-slide';
        
        // 데이터 속성 매핑 (item 구조에 맞춰서!)
        mainSlide.dataset.title = item.title;
        mainSlide.dataset.body1 = item.content;        
        mainSlide.dataset.body2 = `기록일: ${new Date(item.date).toLocaleDateString()}`;
        mainSlide.dataset.body3 = `상태: ${item.health}`;
        
        // 🌟 여기서 item.photo를 써야 합니다!
        mainSlide.innerHTML = `<img src="${item.photo}" alt="성장일지 사진" onerror="this.src='default_plant.png'">`;

        // 2. 하단 썸네일 슬라이드
        const thumbSlide = document.createElement('div');
        thumbSlide.className = 'swiper-slide';
        thumbSlide.innerHTML = `<img src="${item.photo}" alt="썸네일">`;

        UI.mainWrapper.appendChild(mainSlide);
        UI.thumbWrapper.appendChild(thumbSlide);
    });

    // 슬라이드 삽입 후 Swiper 초기화
    initSwiperCore();
}

function initSwiperCore() {
    // 하단 썸네일 Swiper
    const thumbsSwiper = new Swiper('.diary-thumbs', {
        spaceBetween: 10,
        slidesPerView: 5,
        freeMode: true,
        watchSlidesProgress: true,
    });

    // 메인 Swiper
    const mainSwiper = new Swiper('.diary-main', {
        spaceBetween: 0,
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        thumbs: {
            swiper: thumbsSwiper,
        },
        on: {
            init: function() {
                updateText(this);
            },
            slideChange: function() {
                updateText(this);
            }
        }
    });
}

function updateText(swiper) {
    const activeSlide = swiper.slides[swiper.activeIndex];
    if (!activeSlide) return;

    // data 속성에서 텍스트 꺼내서 하단 UI에 업데이트
    if (UI.diaryTitle) UI.diaryTitle.textContent = activeSlide.dataset.title;
    if (UI.diaryBody1) UI.diaryBody1.textContent = activeSlide.dataset.body1;
    if (UI.diaryBody2) UI.diaryBody2.textContent = activeSlide.dataset.body2;
    if (UI.diaryBody3) UI.diaryBody3.textContent = activeSlide.dataset.body3;
}

init();