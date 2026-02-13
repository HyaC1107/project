// ❌ import 구문 삭제 (이게 범인입니다!)

const AlertManager = {
  overlay: null,
  listContainer: null,

  // 디자인 유지 (수치 데이터 매핑)
  buildModal() {
    if (this.overlay) return;
    
    this.overlay = document.createElement('div');
    this.overlay.className = 'alert-overlay';
    this.overlay.hidden = true;

    // 1. 전체 화면을 덮는 반투명 배경 (오버레이)
    Object.assign(this.overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.6)', // 배경을 살짝 더 어둡게 해서 모달 강조
      zIndex: '10000',
      display: 'none',
      justifyContent: 'center',
      alignItems: 'center'
    });

    // 2. 실제 흰색 모달창 (너비 확장 및 배경색 강제 지정)
    this.overlay.innerHTML = `
      <div class="alert-modal" role="dialog" aria-modal="true" 
           style="position: relative; 
                  width: 95%; 
                  max-width: 650px;    /* 너비를 시원하게 확장 */
                  min-width: 360px; 
                  background-color: #ffffff !important; /* 확실한 흰색 배경 */
                  border-radius: 20px; 
                  box-shadow: 0 15px 40px rgba(0,0,0,0.4);
                  overflow: hidden;
                  display: flex;
                  flex-direction: column;">
        
        <button class="alert-close" type="button" 
                style="position: absolute; right: 20px; top: 20px; z-index: 11; cursor: pointer; border: none; background: transparent;">
          <img src="./assets/icon/x%20button.svg" alt="닫기" style="width: 24px; height: 24px;" />
        </button>

        <div class="alert-list" style="max-height: 75vh; overflow-y: auto; padding: 30px 20px;">
          </div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.listContainer = this.overlay.querySelector('.alert-list');
    this.overlay.querySelector('.alert-close').onclick = () => this.close();
  },

  createRowHtml(log, lastCheckedAt) {
    const isUnread = new Date(log.recorded_at) > new Date(lastCheckedAt);
    const time = new Date(log.recorded_at);
    const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
    const isHigh = log.priority === 'high';
    const iconSrc = `./assets/icon/alert_icon${log.icon_id || (isHigh ? 1 : 2)}.svg`;

    // 이미지에서 보였던 undefined 해결
    const displayTitle = log.title || log.actuator_name || '시스템 알림';
    
    // 수치 강조 로직 (색상 적용)
    const displayDesc = (log.message || log.reason || '').replace(
      /(\d+(\.\d+)?(°C|mg\/L|ppm|%))/g, 
      `<span style="color:${isHigh ? '#FF4D4D' : '#007AFF'}; font-weight:bold;">$1</span>`
    );

    return `
      <div class="alert-row" style="display: flex; align-items: center; padding: 18px 10px; gap: 20px;">
        <div class="left" style="flex-shrink: 0;">
          <div style="width: 52px; height: 52px; background: #f0f4f8; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            <img src="${iconSrc}" alt="아이콘" style="width: 32px; height: 32px;">
          </div>
        </div>

        <div class="center" style="flex-grow: 1; min-width: 0;">
          <div style="font-size: 17px; font-weight: 700; color: #111; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${displayTitle}
          </div>
          <div style="font-size: 14.5px; color: #666; line-height: 1.5;">
            ${displayDesc}
          </div>
        </div>

        <div class="right" style="flex-shrink: 0; text-align: right; min-width: 70px;">
          <div style="font-size: 13px; color: #aaa; margin-bottom: 6px;">${timeStr}</div>
          <div style="font-size: 12px; font-weight: 600; color: ${isUnread ? '#FF4D4D' : '#bbb'}">
            ${isUnread ? '미확인' : '읽음'}
          </div>
        </div>
      </div>
      <hr style="border: 0; border-top: 1px solid #f0f0f0; margin: 0;">
    `;
  },

  // open 함수에서 display 속성 제어 추가
  async open(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.buildModal();
    
    this.overlay.style.display = 'flex'; // 화면 중앙 정렬을 위해 flex 사용
    this.overlay.hidden = false;
    this.listContainer.innerHTML = '<p style="text-align:center; padding:40px;">데이터 로드 중...</p>';

    try {
      const response = await window.getNotifications();
      if (response.success) {
        const { logs, lastCheckedAt } = response.data;
        this.listContainer.innerHTML = logs.length > 0 
          ? logs.map(log => this.createRowHtml(log, lastCheckedAt)).join('')
          : '<p style="text-align:center; padding:40px;">알림 내역이 없습니다.</p>';
      }
    } catch (err) {
      this.listContainer.innerHTML = '<p style="text-align:center; padding:40px; color:red;">데이터 로드 실패</p>';
    }
  },

  close() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
      this.overlay.hidden = true;
    }
    window.markNotificationsAsRead();
  },

  init() {
    document.querySelectorAll('a.bell-link, .bell-icon').forEach(el => {
      el.addEventListener('click', (e) => this.open(e));
    });
  }
};

AlertManager.init();