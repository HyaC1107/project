/**
 * NotificationService
 * - 소켓을 통한 실시간 알림 전송
 * - actuator_logs 기반의 알림 이력 조회
 * - 사용자의 last_checked_at 갱신 및 비교
 */
class NotificationService {
    constructor(io, db) {
        this.io = io; // Socket.IO 인스턴스
        this.db = db; // 데이터베이스 연결 풀
    }

    /**
     * [1] 실시간 소켓 알림 전송
     * @param {Object} data - 알림 데이터 (serial_number, title, message, type, priority)
     */
    async notify(data) {
        const { serial_number, title, message, type = 'actuator', priority = 'medium' } = data;

        if (this.io) {
            // 해당 기기의 룸(Room)에만 실시간 알림 전송
            this.io.to(serial_number).emit('server_alert', {
                title,
                message,
                type,
                priority,
                timestamp: new Date()
            });
            console.log(`📡 [Notification] 실시간 전송 완료 (${serial_number}): ${title}`);
        }
    }

    /**
     * [2] 알림 이력 조회 (actuator_logs 활용)
     * - 사용자의 last_checked_at 정보를 함께 가져와 프론트에서 읽음 여부를 비교하게 함
     * @param {number} userId - 로그를 조회할 유저 ID
     */
    async getAlertHistory(userId) {
        try {
            const query = `
                SELECT 
                    al.log_id,
                    al.actuator_name,
                    al.action_type,
                    al.reason,
                    al.recorded_at,
                    u.last_checked_at
                FROM actuator_logs al
                JOIN modules m ON al.module_id = m.module_id
                JOIN users u ON m.user_id = u.user_id
                WHERE u.user_id = $1
                ORDER BY al.recorded_at DESC
                LIMIT 30; -- 최근 30개까지만 노출
            `;
            const result = await this.db.query(query, [userId]);
            return result.rows;
        } catch (error) {
            console.error("🚨 알림 이력 조회 실패:", error);
            throw error;
        }
    }

    /**
     * [3] 알림 읽음 처리 (last_checked_at 업데이트)
     * - 사용자가 알림 모달을 확인했을 때 호출
     * @param {number} userId - 시간을 갱신할 유저 ID
     */
    async updateLastChecked(userId) {
        try {
            await this.db.query(
                'UPDATE users SET last_checked_at = CURRENT_TIMESTAMP WHERE user_id = $1',
                [userId]
            );
            return { success: true };
        } catch (error) {
            console.error("🚨 읽음 시간 갱신 실패:", error);
            throw error;
        }
    }

    /**
     * [4] 센서 수치 기반 자동 알림 체크 (참고용)
     */
    /**
     * [4] 센서 수치 기반 자동 알림 체크
     * - 각 센서별 임계치를 확인하여 위험 시 즉시 알림 전송
     */
    async checkSensorRisk(sensorData, serialNumber, moduleId, userId) {
        const alerts = [];

        // 1. 수온 (Water Temperature) 체크
        if (sensorData.water_temp > 28) {
            alerts.push({
                title: "🔥 수온 고온 주의보",
                message: `현재 수온이 ${sensorData.water_temp}°C로 너무 높아요! 냉각이 필요합니다.`,
                priority: 'high',
                icon_id: 1
            });
        } else if (sensorData.water_temp < 15) {
            alerts.push({
                title: "❄️ 수온 저온 주의보",
                message: `현재 수온이 ${sensorData.water_temp}°C로 너무 낮아요! 히터를 확인해 주세요.`,
                priority: 'high',
                icon_id: 1
            });
        }

        // 2. pH (산성도) 체크 - 보통 5.5 ~ 6.5가 적정
        if (sensorData.ph_value > 7.5) {
            alerts.push({
                title: "🧪 pH 알칼리 주의",
                message: `pH 수치가 ${sensorData.ph_value}로 높습니다. 수질 점검이 필요해요!`,
                priority: 'medium',
                icon_id: 3
            });
        } else if (sensorData.ph_value < 5.0) {
            alerts.push({
                title: "🧪 pH 산성 주의",
                message: `pH 수치가 ${sensorData.ph_value}로 너무 낮습니다. 조치가 필요해요!`,
                priority: 'medium',
                icon_id: 3
            });
        }

        // 3. DO (용존산소량) 체크 - 보통 5mg/L 이상 유지 권장
        if (sensorData.do_value < 4.0) {
            alerts.push({
                title: "🫧 산소 부족 알림",
                message: `용존산소(DO)가 ${sensorData.do_value}mg/L로 낮습니다. 에어 펌프를 확인하세요!`,
                priority: 'high',
                icon_id: 2
            });
        }

        // 4. 주변 온도 (Air Temperature) 체크
        if (sensorData.air_temp > 35) {
            alerts.push({
                title: "🌡️ 실내 고온 경보",
                message: `실내 온도가 ${sensorData.air_temp}°C 입니다. 환풍기를 가동해 주세요!`,
                priority: 'medium',
                icon_id: 5
            });
        }

        // 생성된 알림들을 순차적으로 전송 (실시간 소켓)
        for (const alert of alerts) {
            await this.notify({
                serial_number: serialNumber,
                title: alert.title,
                message: alert.message,
                type: 'sensor',
                priority: alert.priority,
                icon_id: alert.icon_id
            });
        }
    }
}

module.exports = NotificationService;