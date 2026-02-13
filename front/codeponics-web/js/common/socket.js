// public/js/common/socket.js

// socket.io-client 라이브러리는 HTML에서 스크립트 태그로 먼저 로드되어야 합니다.
// <script src="/socket.io/socket.io.js"></script>

let socket = null;

export function initSocket() {
    if (socket) return socket; // 이미 연결되어 있으면 반환

    // 소켓 서버 연결 (백엔드 주소)
    socket = io('http://localhost:5000', {
        withCredentials: true, // 세션 쿠키 공유
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000
    });

    socket.on('connect', () => {
        // console.log("✅ 소켓 서버에 연결되었습니다! ID:", socket.id);
    });

    socket.on('disconnect', () => {
        // console.log("❌ 소켓 연결이 끊어졌습니다.");
    });

    // [공통] 서버 알림 수신
    socket.on('server_alert', (data) => {
        console.log("🚨 서버 알림:", data);
        showNotification(data); // 알림 표시 함수 (dashboard.js 등에 구현 필요)
    });

    return socket;
}

export function getSocket() {
    if (!socket) {
        return initSocket();
    }
    return socket;
}

// 특정 기기 방 입장 (실시간 데이터 수신을 위해)
export function joinDeviceRoom(serialNumber) {
    const sock = getSocket();
    if (sock && serialNumber) {
        sock.emit('join_room', serialNumber);
        // console.log(`🚪 방 입장 요청: ${serialNumber}`);
    }
}

// 브라우저 알림 표시 (Helper)
function showNotification(data) {
    // 1. 브라우저 알림 권한 확인
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        new Notification(data.title, {
            body: data.message,
            icon: '/images/logo.png' // 로고 이미지 경로 (없으면 생략)
        });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(data.title, {
                    body: data.message,
                    icon: '/images/logo.png'
                });
            }
        });
    }
}