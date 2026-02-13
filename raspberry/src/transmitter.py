import requests
import json
import os
import time

# 1. 설정 및 경로 초기화
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(BASE_DIR, 'config', 'settings.json')

# 설정 파일 로드
try:
    with open(CONFIG_PATH, 'r') as f:
        config = json.load(f)
except Exception as e:
    # 설정 파일을 읽지 못할 경우 기본값 설정
    config = {
        "server": {"url": "http://localhost:5000/api/sensors/report"},
        "device": {"serial_number": "unknown_device"}
    }

# 백엔드 엔드포인트 설정
# 기본 센서 데이터 전송 URL
SENSOR_URL = config['server']['url']
ACTUATOR_URL = SENSOR_URL.replace("/api/sensors/report", "/api/actuators/log") 
PHOTO_URL = SENSOR_URL.replace("/api/sensors/report", "/api/ai/pi-photo")
# print(PHOTO_URL)

SERIAL_NUMBER = config['device']['serial_number']
TIMEOUT = config['server'].get('timeout', 3)

def map_data_to_backend_format(sensor_data, analysis_result):
    """센서 원본 데이터를 백엔드 DB 구조에 맞게 매핑"""
    return {
        "water_temp": sensor_data.get('water_temp', 0),
        "air_temp": sensor_data.get('air_temp', 0),
        "humidity": sensor_data.get('humidity', 0),
        "ph_value": sensor_data.get('ph', 0),
        "ec_value": sensor_data.get('ec', 0),
        "lux_value": sensor_data.get('light_percent', 0),
        "do_value": analysis_result.get('estimated_do', 0.0),
        "ai_score": analysis_result.get('score', 0.0),
        "ai_status": analysis_result.get('status', 'UNKNOWN')
    }

# ------------------------------------------------------------------
# [기능 1] 실시간 데이터 전송 (5초 주기, DB 저장 X)
# ------------------------------------------------------------------
def send_realtime_data(sensor_data, analysis_result):
    formatted_data = map_data_to_backend_format(sensor_data, analysis_result)
    
    # RPi 로컬 분석 결과 포함
    water_analysis_payload = {
        "score": analysis_result.get('score', 0),
        "risk_level": analysis_result.get('status', 'UNKNOWN'),
        "factor": str(analysis_result.get('deductions', [])),
        "predicted_1h": analysis_result.get('prediction_1h', None)
    }

    payload = {
        "serial_number": SERIAL_NUMBER,
        "type": "REALTIME", # 백엔드가 이 타입을 보고 DB 저장을 건너뜀
        "sensor_data": formatted_data,
        "water_analysis": water_analysis_payload
    }
    return _post_request(SENSOR_URL, payload)

# ------------------------------------------------------------------
# [기능 2] DB 저장용 데이터 전송 (15분 주기 or 이상 감지 시)
# ------------------------------------------------------------------
def send_db_log_data(sensor_data, analysis_result):
    formatted_data = map_data_to_backend_format(sensor_data, analysis_result)
    
    water_analysis_payload = {
        "score": analysis_result.get('score', 0),
        "risk_level": analysis_result.get('status', 'UNKNOWN'),
        "factor": str(analysis_result.get('deductions', [])),
        "predicted_1h": analysis_result.get('prediction_1h', None)
    }

    payload = {
        "serial_number": SERIAL_NUMBER,
        "type": "DB_LOG", # 백엔드가 이 타입을 보고 DB에 INSERT 함
        "sensor_data": formatted_data,
        "water_analysis": water_analysis_payload
    }
    return _post_request(SENSOR_URL, payload)

# ------------------------------------------------------------------
# [기능 3] 액추에이터 로그 전송 (작동 시 즉시)
# ------------------------------------------------------------------
def send_actuator_log(log_data):
    payload = {
        "serial_number": SERIAL_NUMBER,
        "actuator_name": log_data['actuator_name'],
        "action_type": log_data['action_type'],
        "duration_sec": log_data['duration_sec'],
        "reason": log_data['reason']
    }
    return _post_request(ACTUATOR_URL, payload)

# ------------------------------------------------------------------
# [기능 4] 카메라 이미지 전송 (5분/24시간 주기)
# ------------------------------------------------------------------
def send_camera_image(image_stream, is_db_log=False):
    # 백엔드 ai.js의 분기 처리 조건과 일치시킵니다.
    upload_type = "ANALYSIS" if is_db_log else "MONITOR"
    
    data = {
        "serial_number": SERIAL_NUMBER,
        "type": upload_type
    }
    
    files = {
        'image': ('capture.jpg', image_stream, 'image/jpeg')
    }
    
    try:
        # 이미지 전송은 크기가 크므로 timeout을 넉넉하게 설정
        response = requests.post(PHOTO_URL, data=data, files=files, timeout=15)
        if response.status_code in [200, 201]:
            return True, response.json()
        else:
            return False, f"Server Error: {response.status_code}"
    except Exception as e:
        return False, str(e)

def _post_request(url, payload, timeout=3):
    """공통 POST 요청 헬퍼 함수 (JSON 방식)"""
    try:
        response = requests.post(url, json=payload, timeout=timeout)
        if response.status_code in [200, 201]:
            return True, "Success"
        else:
            return False, f"Server Error: {response.status_code}"
    except Exception as e:
        return False, str(e)