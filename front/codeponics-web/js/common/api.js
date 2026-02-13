// public/js/common/api.js

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * 공통 Fetch 래퍼 함수
 * - 인증(Cookie) 포함
 * - JSON 응답 처리
 * - 에러 처리
 */
async function fetchAPI(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // 기본 옵션 설정 (credentials: 'include'는 세션 쿠키 전송을 위해 필수)
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include', 
        ...options
    };

    try {
        const response = await fetch(url, defaultOptions);
        
        // 401(Unauthorized) 에러 시 로그인 페이지로 리다이렉트
        if (response.status === 401) {
            alert("로그인이 필요합니다. 🔒");
            window.location.href = '/index.html';
            return null;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`🚨 API 요청 실패 (${endpoint}):`, error);
        throw error;
    }
}

// --- API 함수들 ---

// 1. 사용자 상태 확인 (로그인 여부)
export async function checkAuthStatus() {
    return fetchAPI('/auth/status');
}

// 2. 내 기기 목록 조회
export async function getMyDevices() {
    return fetchAPI('/modules/my');
}

// 3. 최신 센서 데이터 조회 (대시보드용)
export async function getLatestSensorData() {
    return fetchAPI('/sensors/latest');
}

export async function getLatestAnalysis(moduleId) {
    try {
        const response = await fetch(`http://localhost:5000/api/ai/analysis/${moduleId}/latest`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        return await response.json();
    } catch (error) {
        console.error("API Error (getLatestAnalysis):", error);
        return { success: false };
    }
}

// 5. 기기 등록
export async function registerDevice(deviceData) {
    return fetchAPI('/modules/register', {
        method: 'POST',
        body: JSON.stringify(deviceData)
    });
}

// 6. 기기 삭제
export async function deleteDevice(moduleId) {
    return fetchAPI(`/modules/${moduleId}`, {
        method: 'DELETE'
    });
}

// 날씨 api
export async function getWeather(lat, lon) {
    return fetchAPI(`/weather/current?lat=${lat}&lon=${lon}`);
}
// 작물 생육 지표 분석 데이터 조회
export async function getGrowthData(moduleId) {
    // 공통 fetchAPI를 사용하여 인증과 에러 처리를 동시에!
    return fetchAPI(`/ai/analysis/${moduleId}/latest`);
}

export async function getSensorHistory(moduleId) {
    return fetchAPI(`/sensors/${moduleId}/history`);
};

export async function getWeeklyReport(moduleId) {
    return fetchAPI(`/ai/report/weekly/latest/${moduleId}`);
};

export async function getJournalList(moduleId) {
    return fetchAPI(`/ai/journal/history-list/${moduleId}`);
};

export async function getJournalDetail(journalId) {
    return fetchAPI(`/ai/journal/detail/${journalId}`);
};

export async function getNotifications() {
    return fetchAPI(`/notifications`);
};
export async function markNotificationsAsRead() {
    return fetchAPI('/notifications/check', { method: 'POST' });
}

window.getNotifications = getNotifications;
window.markNotificationsAsRead = markNotificationsAsRead;