import RPi.GPIO as GPIO
import time
import json
import os

# 1. 설정 파일 로드
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(BASE_DIR, 'config', 'settings.json')

with open(CONFIG_PATH, 'r') as f:
    config = json.load(f)

# 2. 액추에이터 설정값 가져오기
TARGETS = config.get('targets', {})
PH_CONFIG = TARGETS.get('ph', {"min": 6.5, "max": 7.3, "target": 7.0})
PUMP_PIN = config['actuators'].get('ph_pump_pin', 23)

PUMP_DURATION = config['actuators'].get('pump_duration', 3)
DOSING_COOLDOWN = config['actuators'].get('dosing_cooldown', 300)

LED_PIN = config['actuators'].get('led_pin', 18)
LED_THRESHOLD = config['actuators'].get('led_threshold', 80.0)

last_dosing_time = 0
led_pwm = None 
current_led_duty = 0.0 # [NEW] 현재 LED 밝기 상태 저장 (플리커링 방지용)

def setup():
    """GPIO 초기화 (펌프 + LED)"""
    global led_pwm
    try:
        GPIO.setwarnings(False)
        GPIO.setmode(GPIO.BCM)
        
        # 펌프
        GPIO.setup(PUMP_PIN, GPIO.OUT)
        GPIO.output(PUMP_PIN, GPIO.LOW)
        
        # LED
        GPIO.setup(LED_PIN, GPIO.OUT)
        # [수정] 주파수를 1000Hz -> 200Hz로 낮춤 (소프트웨어 PWM 떨림 방지)
        led_pwm = GPIO.PWM(LED_PIN, 200) 
        led_pwm.start(0)
        
        print(f">>> [Actuator] Setup Complete (Pump:{PUMP_PIN}, LED:{LED_PIN})")
    except Exception as e:
        print(f">>> [Actuator] Setup Error: {e}")

def cleanup():
    global led_pwm
    if led_pwm:
        led_pwm.stop()
    GPIO.cleanup()

def control_ph(current_ph, predicted_ph=None):
    """
    [AI 기반 pH 제어 로직]
    1. 현재 값이 목표치 미만이면 즉시 투입
    2. 1시간 뒤 예측값이 급격히 떨어질 것으로 보이면 선제적 투입
    """
    global last_dosing_time
    current_time = time.time()

    # 1. 쿨다운 체크 (가장 먼저 수행)
    if current_time - last_dosing_time < DOSING_COOLDOWN:
        remaining = int(DOSING_COOLDOWN - (current_time - last_dosing_time))
        # 쿨다운 중에는 제어하지 않음
        return False, f"pH 쿨다운 ({remaining}초)", None

    action_reason = None
    
    # -------------------------------------------------------
    # [로직 1] 현재 수치 기반 제어 (Reactive) - 최우선
    # -------------------------------------------------------
    if current_ph < PH_CONFIG['min']:
        action_reason = f"pH 하한선 이탈 (현재 {current_ph} < 최소 {PH_CONFIG['min']})"

    # -------------------------------------------------------
    # [로직 2] AI 예측 기반 제어 (Proactive) - 보조
    # 조건: 현재 pH가 목표치에 근접해 있고(Target + 0.3), 예측값은 목표치보다 낮을 때
    # -------------------------------------------------------
    elif predicted_ph is not None:
        # 안전 범위: 너무 높을 땐 작동 안 함 (target + 0.2 정도에서 대기)
        proactive_threshold = PH_CONFIG['target'] + 0.2
        
        if (current_ph <= proactive_threshold) and (predicted_ph < PH_CONFIG['target']):
            action_reason = f"AI 선제 대응 (예측 {predicted_ph} < 목표 {PH_CONFIG['target']})"

    if current_ph > PH_CONFIG['max']:
        # 현재는 pH UP 펌프만 있으므로 별도 액션은 없지만 로그를 남기면 좋음
        print(f">>> [Warning] pH가 너무 높음! (현재 {current_ph} > 최대 {PH_CONFIG['max']})")
    # -------------------------------------------------------
    # 펌프 실행 (조건 만족 시)
    # -------------------------------------------------------
    if action_reason:
        try:
            GPIO.output(PUMP_PIN, GPIO.HIGH)
            time.sleep(PUMP_DURATION)
            GPIO.output(PUMP_PIN, GPIO.LOW)
            
            last_dosing_time = current_time
            
            log_payload = {
                "actuator_name": "ph_pump",
                "action_type": "PH_UP",
                "duration_sec": PUMP_DURATION,
                "reason": action_reason,
                "target_info": PH_CONFIG # 어떤 기준으로 작동했는지 로그에 포함
            }
            return True, f"펌프 작동 [{action_reason}]", log_payload
        except Exception as e:
            GPIO.output(PUMP_PIN, GPIO.LOW)
            return False, f"펌프 에러: {e}", None

    return False, "pH 정상 범위 유지 중", None

def control_led(current_light_pct):
    """
    [LED 제어] 조도에 따른 밝기 자동 조절 (Inverse Control)
    - 어두우면(0%) -> 밝게(100%)
    - 밝으면(100%) -> 끄기(0%)
    - [개선] 잦은 변경으로 인한 깜빡임 방지 (Hysteresis)
    """
    global led_pwm, current_led_duty
    if led_pwm is None: return False, "LED 설정 오류"

    try:
        target_duty = 0.0

        # 1. 목표 듀티 사이클 계산
        if current_light_pct < LED_THRESHOLD:
            # 반비례 공식: 조도가 낮을수록 LED를 밝게
            raw_duty = 100.0 - current_light_pct
            target_duty = max(0.0, min(100.0, raw_duty))
        
        # 2. [중요] 불감대(Deadband) 적용 
        # 이전 값과 차이가 3% 미만이면 변경하지 않음 (센서 노이즈 무시)
        # 단, 0(완전 꺼짐)이나 100(완전 켜짐)으로 갈 때는 즉시 적용
        if abs(target_duty - current_led_duty) < 3.0:
            if not (target_duty == 0.0 or target_duty == 100.0):
                return True, f"LED 유지 ({int(current_led_duty)}%)"

        # 3. 값이 실제로 크게 변했을 때만 PWM 업데이트
        led_pwm.ChangeDutyCycle(target_duty)
        current_led_duty = target_duty
        
        if target_duty == 0:
            return False, "LED OFF (충분히 밝음)"
        else:
            return True, f"LED ON ({int(target_duty)}%)"
        
    except Exception as e:
        return False, f"LED 에러: {e}"