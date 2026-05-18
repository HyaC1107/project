import * as API from './common/api.js';

/** UI 요소 관리 객체 */
const UI = {
    profileName: document.querySelector('.profile .profile-name'),
    avatarName: document.querySelector('.profile-info .name'),
    avatarEmail: document.querySelector('.profile-info .email'),
    profileImg: document.querySelector('.profile img'),
    profileImg2: document.getElementById('profile-img'),
    moduleList: document.querySelector('.module-list'),
    resetOverlay: document.getElementById('resetOverlay'),
    addOverlay: document.getElementById('addOverlay'),
    inputs: {
        serial: document.getElementById('moduleSerial'),
        name: document.getElementById('moduleName'),
        crop: document.getElementById('moduleCrop'),
        fish: document.getElementById('moduleFish'),
        location: document.getElementById('moduleLocation'),
        startedAt: document.getElementById('moduleStartedAt')
    },
    user_start: document.getElementById('user_start'),
    my_module_names: document.getElementById('my_module_names')
};

let editMode = false;
let editingModuleId = null; // 수정 시 ID 보관

/** [실행] 초기화 */
async function init() {
    const auth = await API.checkAuthStatus();
    if (!auth || !auth.isLoggedIn) {
        window.location.href = "/index.html";
        return;
    }

    // 1. UI 초기 세팅
    updateUserProfile(auth.user);
    setupMenuLinks();
    
    // 2. 서버에서 모듈 목록 로드 (로컬스토리지 X)
    await loadModulesFromServer();

    // 3. 이벤트 바인딩
    bindEvents();
}

/** [데이터 로드] 서버에서 실제 모듈 목록 가져오기 */
async function loadModulesFromServer() {
    try {
        const response = await API.getMyDevices();
        const devices = response.data || [];
        // console.log(devices);
        
        if (UI.moduleList) {
            UI.moduleList.innerHTML = devices.length > 0 
                ? devices.map(device => `
                    <li data-id="${device.module_id}" 
                        data-serial="${device.serial_number || ''}" 
                        data-fish="${device.fish_type || ''}" 
                        data-location="${device.location || ''}"
                        data-crop="${device.crop_type || ''}"
                        data-started-at="${device.started_at || ''}"> 
                        <label class="chk">
                            <input type="checkbox">
                            <span class="label-text">${device.module_name}</span>
                            <span class="tag">🥬${device.crop_type}</span>
                            <span class="tag">🐟${device.fish_type}</span>
                            <span class="tag">🚩${device.location}</span>
                        </label>
                    </li>
                `).join('')
                : '<p style="text-align:center; padding:20px; color:#94a3b8;">등록된 기기가 없습니다.</p>';
        }
        if (UI.my_module_names) {
            if (devices.length > 0) {
                // 모듈 이름들만 뽑아서 쉼표(,)로 연결해요. 예: "거실 상추팜, 베란다 딸기팜"
                const nameList = devices.map(d => d.module_name).join(', ');
                UI.my_module_names.textContent = nameList;
            } else {
                UI.my_module_names.textContent = '현재 보유 중인 모듈이 없습니다.';
            }
        }
    } catch (e) {
        console.error("모듈 로드 실패:", e);
    }
}

/** [기능] 모듈 저장/수정 실행 (API 통신) */
async function handleSaveModule() {
    const val = {
        serial_number: UI.inputs.serial.value.trim(),
        module_name: UI.inputs.name.value.trim(),
        crop_type: UI.inputs.crop.value,
        fish_type: UI.inputs.fish.value,
        location: UI.inputs.location.value.trim(),        
        started_at: UI.inputs.startedAt.value // 날짜 데이터 추가
    };

    if (!val.module_name) return alert('기기명을 입력하세요.');

    try {
        let result;
        const fetchOptions = {
            method: editMode ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(val),
            // ⭐ 이 옵션이 핵심입니다! ⭐
            credentials: 'include' 
        };

        const url = editMode && editingModuleId 
            ? `http://localhost:5000/api/modules/${editingModuleId}`
            : `http://localhost:5000/api/modules/register`;

        result = await fetch(url, fetchOptions);

        const data = await result.json();
        // ... 뒷부분 동일 ...
        if (data.success) {
            alert(editMode ? '수정되었습니다.' : '추가되었습니다.');
            closeModal(UI.addOverlay);
            await loadModulesFromServer(); // 목록 새로고침
        }
    } catch (e) {
        alert("저장 실패!");
    }
}

/** [기능] 선택 삭제 (API 통신) */
async function handleDeleteSelected() {
    const checked = Array.from(UI.moduleList.querySelectorAll('li'))
        .filter(li => li.querySelector('input:checked'));

    if (checked.length === 0) return alert('삭제할 모듈을 선택하세요.');

    const moduleId = checked[0].dataset.id;

    if (!confirm('수확 처리 후 모듈을 삭제하시겠습니까?')) return;

    try {
        // 1️⃣ 수확일지 생성
        const harvestRes = await fetch(
            `http://localhost:5000/api/ai/journal/harvest/${moduleId}`, 
            { 
                method: 'POST',
                credentials: 'include'
            }
        );

        const harvestData = await harvestRes.json();

        if (!harvestData.success) {
            return alert("수확일지 생성 실패: " + harvestData.message);
        }

        // // 2️⃣ 모듈 삭제
        // await fetch(
        //     `http://localhost:5000/api/modules/${moduleId}`, 
        //     { 
        //         method: 'DELETE',
        //         credentials: 'include'
        //     }
        // );

        alert("수확 완료 및 삭제 완료!");
        await loadModulesFromServer();

    } catch (e) {
        console.error("삭제 실패:", e);
        alert("처리 중 오류 발생");
    }
}


/** [기능] 농장 데이터 초기화 (백엔드 초기화 API 호출) */
async function handleFarmReset() {
    if (!confirm("정말로 모든 데이터를 초기화하시겠습니까?")) return;
    
    try {
        const response = await fetch('http://localhost:5000/api/system/reset', { method: 'POST' });
        const result = await response.json();
        if (result.success) {
            alert("모든 데이터가 초기화되었습니다. 다시 시작합니다!");
            window.location.href = 'index.html';
        }
    } catch (e) {
        alert("초기화 실패");
    }
}

/** [공통] 모달 제어 및 이벤트 바인딩은 기존 구조 유지 */
function openAddModal(isEdit) {
    editMode = isEdit;
    const checked = UI.moduleList.querySelectorAll('input[type="checkbox"]:checked');

    if (isEdit) {
        // 1. 하나만 선택했는지 검사
        if (checked.length !== 1) return alert('수정할 항목을 하나만 선택해주세요! ㅎㅎ');
        
        const li = checked[0].closest('li');
        editingModuleId = li.dataset.id; // 수정할 타겟 ID 저장
        
        // 2. [핵심] 시리얼 번호 및 기존 데이터 표시
        UI.inputs.serial.value = li.dataset.serial || ''; // 리스트의 data-serial 값을 가져옴
        UI.inputs.serial.readOnly = true;                // 수정 불가능하게 설정
        UI.inputs.serial.style.backgroundColor = '#f1f5f9'; // "못 고쳐요" 느낌의 회색 배경
        
        // 3. 나머지 입력창들도 기존 값으로 채우기
        UI.inputs.name.value = li.querySelector('.label-text').textContent.trim();
        UI.inputs.crop.value = li.dataset.crop || li.querySelector('.tag').textContent.trim();
        UI.inputs.fish.value = li.dataset.fish || '';
        UI.inputs.location.value = li.dataset.location || '';
        UI.inputs.startedAt.value = li.dataset.startedAt || ''; // 시작일 데이터
        
    } else {
        // [추가 모드]일 때는 모든 창을 깨끗하게 비워주기
        editingModuleId = null;
        Object.values(UI.inputs).forEach(input => { 
            input.value = ''; 
            input.readOnly = false; // 다시 입력 가능하게!
            input.style.backgroundColor = ''; 
        });
    }
    
    openModal(UI.addOverlay);
}

function openModal(overlay) { overlay.classList.add('is-open'); document.body.classList.add('modal-open'); }
function closeModal(overlay) { overlay.classList.remove('is-open'); document.body.classList.remove('modal-open'); }

function updateUserProfile(user) {
    // console.log(user);
    
    const date = new Date(user.created_at);

    // 년, 월, 일을 각각 추출, 월은 0부터 시작하니 +1 해줌
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // 원하는 형식으로 문자열 만들기 (예: 2026년 2월 11일)
    const formattedDate = `${year}년 ${month}월 ${day}일`;
    const nick = user.nickname || '관리자님';
    if (UI.profileName) UI.profileName.textContent = nick;
    if (UI.avatarName) UI.avatarName.textContent = nick;
    if (UI.avatarEmail) UI.avatarEmail.textContent = user.email || '';
    if (UI.user_start) UI.user_start.textContent = formattedDate || '';
    if (user.profile_img && UI.profileImg) UI.profileImg.src = user.profile_img;
    if (user.profile_img && UI.profileImg2) UI.profileImg2.src = user.profile_img;
}

function setupMenuLinks() {
    const links = document.querySelectorAll('.sidebar .menu a.menu-item');
    links.forEach(a => {
        const text = a.textContent.replace(/\s+/g, '').trim();
        if (text === '모니터링') a.href = 'monitoring.html';
        if (text === '성장일지') a.href = 'diary-list.html';
        if (text === '대시보드') a.href = 'dashboard.html';
    });
}

function bindEvents() {
    document.getElementById('farmResetBtn')?.addEventListener('click', () => openModal(UI.resetOverlay));
    document.getElementById('resetCancelBtn')?.addEventListener('click', () => closeModal(UI.resetOverlay));
    document.getElementById('resetConfirmBtn')?.addEventListener('click', handleFarmReset);
    document.querySelector('.btn-add')?.addEventListener('click', () => openAddModal(false));
    document.querySelector('.btn-edit')?.addEventListener('click', () => openAddModal(true));
    document.getElementById('addCancelBtn')?.addEventListener('click', () => closeModal(UI.addOverlay));
    document.getElementById('addSaveBtn')?.addEventListener('click', handleSaveModule);
    document.querySelector('.btn-delete')?.addEventListener('click', handleDeleteSelected);    
    document.querySelector('.btn-download')?.addEventListener('click', handleExcelDownload);
    UI.moduleList.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const checkboxes = UI.moduleList.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(chk => {
                if (chk !== e.target) chk.checked = false;
            });
        }
    });
}
/** [기능] 선택된 모듈 데이터 엑셀 다운로드 */
async function handleExcelDownload() {
    // 1. 선택된 체크박스 찾기
    const checked = Array.from(UI.moduleList.querySelectorAll('li'))
        .filter(li => li.querySelector('input:checked'));

    if (checked.length === 0) return alert('다운로드할 모듈을 선택해 주세요! 😊');

    const moduleId = checked[0].dataset.id;
    const moduleName = checked[0].querySelector('.label-text').textContent.trim();

    try {
        // 2. 서버에서 해당 모듈의 전체 센서 로그 가져오기
        // (기존에 만들어두신 API.getSensorHistory 등을 활용하세요!)
        const response = await API.getSensorHistory(moduleId, 'all'); 
        if (!response.success || !response.data.logs) throw new Error("데이터 없음");

        const logs = response.data.logs;
        // console.log(logs);        
        // 3. 엑셀 데이터용 배열 생성 (헤더 포함)
        const excelData = logs.map(log => ({
            "기록시간": new Date(log.created_at).toLocaleString(),
            "기온(℃)": log.air_temp,
            "습도(%)": log.humidity,
            "수온(℃)": log.water_temp,
            "pH": log.ph_value,
            "EC(dS/m)": log.ec_value,
            "DO(mg/L)": log.do_value,
            "조도(lux)": log.lux_value
        }));

        // 4. SheetJS를 이용한 엑셀 파일 생성
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "SensorData");

        // 5. 파일 다운로드 실행
        const fileName = `${moduleName}_데이터_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(workbook, fileName);

    } catch (e) {
        console.error("엑셀 생성 실패:", e);
        alert("데이터를 가져오는 중 오류가 발생했습니다.");
    }
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

init();