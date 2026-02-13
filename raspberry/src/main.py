import time
import json
import os
import sys
import io
from datetime import datetime

# 모듈 임포트
import sensors
import ai_engine
import transmitter
import actuators
import camera 

# UTF-8 강제 설정
sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8', line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.detach(), encoding='utf-8', line_buffering=True)

# ---------------------------------------------------------
# 1. 설정 로드 및 주기 계산
# ---------------------------------------------------------
# 설정 로드
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(BASE_DIR, 'config', 'settings.json')

with open(CONFIG_PATH, 'r') as f:
    config = json.load(f)

# 주기 설정
INTERVAL_REALTIME = config['interval'].get('realtime_sec', 5)       # 5초
INTERVAL_DB_LOG   = config['interval'].get('db_log_min', 15) * 60   # 15분
INTERVAL_MONITOR  = config['interval'].get('monitor_cam_min', 5) * 60 # 5분
# INTERVAL_ANALYSIS = config['interval'].get('analysis_cam_hour', 24) * 3600 # 24시간
INTERVAL_ANALYSIS = config['interval'].get('monitor_cam_min', 5) * 720 # 테스트용 1시간

# 타이머 초기화 (마지막 실행 시간)
last_db_log_time = 0
last_monitor_cam_time = 0
last_analysis_cam_time = 0

# ---------------------------------------------------------
# 2. 콘솔 색상 클래스
# ---------------------------------------------------------
class C:
    RED = '\033[91m'      
    GREEN = '\033[92m'    
    YELLOW = '\033[93m'   
    BLUE = '\033[94m'     
    BOLD = '\033[1m'      
    RESET = '\033[0m'     

def print_status(data, analysis, act_msg, cam_msg, send_msg):
    # os.system('clear' if os.name == 'posix' else 'cls')
    print(f"{C.GREEN}=== CODEPONICS SMART FARM RPI ==={C.RESET}")
    print(f"🕒 현재 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌡️  센서 데이터: pH {data.get('ph',0)} | EC {data.get('ec',0)} | 수온 {data.get('water_temp',0)}°C")
    print(f"🧠 AI 수질분석: 점수 {analysis.get('score',0)}점 ({analysis.get('status','UNKNOWN')})")
    print(f"⚙️  액추에이터 : {act_msg}")
    print(f"📷 카 메 라   : {cam_msg}")
    print(f"📡 네트워크   : {send_msg}")
    print("====================================")

# ---------------------------------------------------------
# 3. 메인 루프
# ---------------------------------------------------------
def main():
    global last_db_log_time, last_monitor_cam_time, last_analysis_cam_time
    
    # 하드웨어 초기화
    actuators.setup()
    print("시스템 시작 중...")
    time.sleep(2)

    while True:
        loop_start = time.time()
        
        # --- [Step 1] 데이터 수집 (5초 주기) ---
        sensor_data = sensors.read_all()
        
        # --- [Step 2] 로컬 AI 수질 분석 (LGBM 등 활용) ---
        # 위험도 산출: score가 낮거나 status가 DANGER면 즉시 보고 대상
        analysis_result = ai_engine.analyze_water_quality(sensor_data)
        
        # --- [Step 3] 액추에이터 제어 & 로그 전송 ---
        act_msg = "대기 중"
        # 1. pH 펌프 제어
        # 보통 [pH, EC, Temp, DO] 순서라고 가정했을 때:
        predicted_ph = None
        if analysis_result.get('prediction_1h'):
            # prediction_1h가 [pH, EC, Temp, DO] 리스트라면
            predicted_ph = round(analysis_result['prediction_1h'][0], 2)

        # 예측값까지 넘겨서 제어 (수정된 부분)
        is_pump_active, pump_msg, pump_log = actuators.control_ph(
            current_ph=sensor_data.get('ph', 7.0),
            predicted_ph=predicted_ph
        )
        # 2. LED 제어
        is_led_active, led_msg = actuators.control_led(sensor_data.get('light_percent', 0))
        
        act_msg = f"{pump_msg} / {led_msg}"

        # [중요] 액추에이터가 작동했다면 즉시 로그 전송
        if is_pump_active and pump_log:
            transmitter.send_actuator_log(pump_log)
            print(f"{C.YELLOW}🚀 펌프 작동 로그 전송 완료{C.RESET}")

        # --- [Step 4] 카메라 전송 (우선순위: 분석 > 모니터링) ---
        current_time = time.time()
        cam_msg = "-"
        
        # 1. 정밀 분석용 (24시간 주기) -> DB 저장 O, AI 분석 O
        if current_time - last_analysis_cam_time >= INTERVAL_ANALYSIS:
            cam_msg = "분석용 촬영 중..."
            if camera.capture_and_send_live(is_db_log=True):
                cam_msg = "분석 사진 전송 완료"
                last_analysis_cam_time = current_time
                last_monitor_cam_time = current_time # 모니터링 주기도 같이 리셋
            else:
                cam_msg = "분석 촬영 실패"
        
        # 2. 모니터링용 (5분 주기) -> DB 저장 X (Blob만 업데이트), 실시간 뷰
        elif current_time - last_monitor_cam_time >= INTERVAL_MONITOR:
            cam_msg = "모니터링 촬영 중..."
            if camera.capture_and_send_live(is_db_log=False):
                cam_msg = "모니터링 전송 완료"
                last_monitor_cam_time = current_time
            else:
                cam_msg = "모니터링 실패"

        # --- [Step 5] 실시간 데이터 전송 (5초 주기) ---
        # DB 저장 없이 프론트엔드로 소켓 브로드캐스팅만 함
        rt_success, rt_res = transmitter.send_realtime_data(sensor_data, analysis_result)
        send_msg = "Realtime OK" if rt_success else "Realtime Fail"

        # --- [Step 6] DB 저장용 데이터 전송 (조건부) ---
        # 조건 1: 15분이 지났거나
        # 조건 2: 수질 상태가 'DANGER'(위험) 또는 'WARNING'(주의) 일 때 (이상치 발생)
        is_emergency = analysis_result.get('status') in ['DANGER', 'WARNING']
        is_time_up = (current_time - last_db_log_time >= INTERVAL_DB_LOG)

        if is_time_up or is_emergency:
            reason = "정기보고" if is_time_up else f"이상감지({analysis_result.get('status')})"
            
            db_success, db_res = transmitter.send_db_log_data(sensor_data, analysis_result)
            
            if db_success:
                last_db_log_time = current_time
                send_msg += f" / DB Save OK ({reason})"
            else:
                send_msg += f" / DB Fail ({reason})"

        # --- 대시보드 출력 ---
        print_status(sensor_data, analysis_result, act_msg, cam_msg, send_msg)

        # 5초 주기 유지를 위한 Sleep
        elapsed = time.time() - loop_start
        sleep_time = max(0, INTERVAL_REALTIME - elapsed)
        time.sleep(sleep_time)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n프로그램을 종료합니다.")
        actuators.cleanup()