import joblib
import pandas as pd
import numpy as np
import os
import math

# =========================================================
# 1. 설정 및 모델 로드
# =========================================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'model_1h_integrated.pkl')

model = None

if os.path.exists(MODEL_PATH):
    try:
        model = joblib.load(MODEL_PATH)
        print(f">>> [AI Engine] 통합 모델 로드 완료: {MODEL_PATH}")
    except Exception as e:
        print(f">>> [AI Engine] 모델 로드 실패: {e}")
else:
    print(f">>> [AI Engine] 경고: 모델 파일 없음 ({MODEL_PATH})")

# =========================================================
# 2. DO(용존산소) 추정 알고리즘
# =========================================================
def estimate_do(water_temp):
    """
    수온에 따른 포화 용존산소량(DO) 추정 공식
    (Weiss 공식의 간소화 버전 사용)
    - 수온이 낮을수록 DO는 높음
    - 수온이 높을수록 DO는 낮음
    """
    if water_temp is None: return 6.5 # 기본값
    
    # 섭씨 온도(T)를 캘빈(K)으로 변환하지 않고 약식 경험식 사용
    # DO_sat approx = 14.652 - 0.41022*T + ... (복잡하므로 간이 테이블 매핑)
    
    # 간이 매핑 (25도 기준 8.24mg/L)
    # 온도 1도 상승 시 약 0.15 감소 가정
    diff = water_temp - 25.0
    estimated = 8.24 - (diff * 0.15)
    return round(max(0.0, estimated), 2)

# =========================================================
# 3. 수질 점수 계산 로직 (Rule-based)
# =========================================================
def calculate_water_score(data):
    """
    센서 데이터를 기반으로 수질 점수(0~100)와 상태를 반환
    """
    score = 100
    deductions = []
    
    # 1. pH 평가 (적정 5.5 ~ 6.5)
    ph = data.get('pH', 7.0)
    if ph < 5.0 or ph > 7.5:
        score -= 30
        deductions.append("pH 위험")
    elif ph < 5.5 or ph > 6.5:
        score -= 10
        deductions.append("pH 주의")
        
    # 2. EC 평가 (적정 1.0 ~ 2.0 mS/cm)
    ec = data.get('EC', 1.2)
    if ec < 0.5 or ec > 3.0:
        score -= 30
        deductions.append("EC 위험")
    elif ec < 0.8 or ec > 2.5:
        score -= 10
        deductions.append("EC 주의")
        
    # 3. 수온 평가 (적정 18 ~ 24도)
    temp = data.get('Water_Temp', 20.0)
    if temp < 10 or temp > 30:
        score -= 20
        deductions.append("수온 위험")
    elif temp < 15 or temp > 28:
        score -= 10
        deductions.append("수온 주의")
        
    # 4. DO 평가 (적정 5.0 이상)
    do = data.get('DO', 6.0)
    if do < 3.0:
        score -= 20
        deductions.append("용존산소 부족")
    elif do < 5.0:
        score -= 10
        deductions.append("용존산소 주의")

    # 점수 보정
    score = max(0, min(100, score))
    
    # 상태 결정
    if score >= 80: status = "GOOD"
    elif score >= 60: status = "WARNING"
    else: status = "DANGER"
    
    return score, status, deductions

# =========================================================
# 4. 메인 분석 함수 (외부 호출용)
# =========================================================
def analyze_water_quality(sensor_data):
    """
    [Main API] 센서 데이터를 받아 종합 분석 결과 반환
    1) DO 추정
    2) 현재 상태 점수 계산 (Rule-based)
    3) AI 모델 예측 (1시간 뒤 수질) - 모델 있을 경우
    """
    
    # 1) DO 추정
    estimated_do = estimate_do(sensor_data.get('water_temp', 25.0))
    
    # 2) 분석용 데이터 준비
    current_input = {
        'pH': sensor_data.get('ph', 7.0),
        'EC': sensor_data.get('ec', 0.0), # 모델 단위가 uS면 *1000 필요, 여기선 mS 가정
        'Water_Temp': sensor_data.get('water_temp', 25.0),
        'DO': estimated_do 
    }
    
    result = {
        "score": 0,
        "status": "UNKNOWN",
        "deductions": [],
        "prediction_1h": None,
        "estimated_do": estimated_do 
    }

    # 3) 현재 상태 점수 계산
    curr_score, curr_status, curr_reasons = calculate_water_score(current_input)
    result['score'] = curr_score
    result['status'] = curr_status
    result['deductions'] = curr_reasons

    # 4) AI 예측 (1시간 뒤)
    if model:
        try:
            # DataFrame 생성 (Feature 순서 중요: pH, EC, Water_Temp, DO)
            input_df = pd.DataFrame([current_input], columns=['pH', 'EC', 'Water_Temp', 'DO'])
            
            # 예측 (결과가 2차원 배열로 나옴)
            pred_1h = model.predict(input_df) 
            
            # 예측 결과 포맷팅 (리스트 형태)
            # 모델이 [pH, EC, Temp, DO] 4개를 예측한다고 가정
            result['prediction_1h'] = pred_1h[0].tolist()
            
        except Exception as e:
            # 예측 실패해도 메인 로직은 돌게 함
            print(f"AI Prediction Error: {e}")
            result['prediction_1h'] = None
            
    return result