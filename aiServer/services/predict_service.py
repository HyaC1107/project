import joblib
import pandas as pd
import numpy as np
import os

# 모델 경로 설정
MODEL_PATH = os.path.join(os.path.dirname(__file__), "../models/harvest_model.pkl")

def predict_harvest_days(days_grown, avg_temp, total_lux, leaf_area, avg_hum, water_ph, leaf_count):
    """
    LGBM 모델을 사용하여 수확까지 남은 일수 예측
    학습된 모델의 Feature Name과 순서를 정확히 맞춰 DataFrame으로 입력합니다.
    """
    print(days_grown)
    # 1. 모델 파일 확인
    if not os.path.exists(MODEL_PATH):
        print(f"⚠️ Prediction Model Not Found: {MODEL_PATH}")
        # 모델 부재 시 단순 로직 (면적이 크면 수확 임박)
        if leaf_area > 80000: return 2
        return max(0, 30 - days_grown)

    try:
        # 2. 모델 로드
        loaded_obj = joblib.load(MODEL_PATH)
        
        # 저장 방식에 따라 모델 객체 추출 (dict 형태로 저장되었을 경우 처리)
        if isinstance(loaded_obj, dict):
            # 'model' 키가 없으면 'best_estimator'나 객체 자체 사용
            model = loaded_obj.get('model') or loaded_obj.get('best_estimator') or loaded_obj
        else:
            model = loaded_obj

        # 3. 데이터 프레임 생성 (학습 코드 Visualize_result.py와 동일한 컬럼명 사용)
        # 학습 Feature 순서: 
        # ['crop_type_encoded', 'days_elapsed', 'avg_temp', 'avg_humidity', 
        #  'cumulative_lux', 'leaf_area', 'leaf_count', 'water_ph']
        
        input_data = {
            'crop_type_encoded': [0],      # 상추(Lettuce) = 0 으로 고정 (학습 시 LabelEncoder 값)
            'days_elapsed': [days_grown],  # 재배 일수
            'avg_temp': [avg_temp],        # 평균 기온
            'avg_humidity': [avg_hum],     # 평균 습도
            'cumulative_lux': [total_lux], # 누적 조도 (변수명 매핑: total_lux -> cumulative_lux)
            'leaf_area': [leaf_area],      # 잎 면적
            'leaf_count': [leaf_count],    # 잎 개수
            'water_ph': [water_ph]         # 물 pH
        }

        # DataFrame으로 변환 (LGBM은 컬럼명을 매우 중요하게 여김)
        df = pd.DataFrame(input_data)

        # 4. 예측 수행
        prediction = model.predict(df)[0]
        
        # 남은 일수는 음수가 될 수 없으므로 0 이상으로 보정
        remaining_days = int(max(0, round(prediction)))
        print(remaining_days)
        return remaining_days

    except Exception as e:
        print(f"❌ Prediction Error: {e}")
        # 에러 발생 시 안전하게 기본값 반환
        return max(0, 35 - days_grown)

def evaluate_growth_status(days_grown, leaf_area, remaining_days, health_score):
    """
    재배 일수, 면적, 남은 기간, 건강 점수를 종합하여 
    최종 등급(Level), 위험도(Score), 한줄평(Review) 생성
    """
    # 1. 위험도 점수 (Vision의 HSV 점수 반영)
    # health_score가 100점 만점이므로, 위험도(Risk)는 (100 - health_score)
    health_score = max(0, min(100, health_score))
    risk_score = 100 - health_score


    # 2. 성장 단계 (Growth Level)
    # 0: 초기 (Seedling), 1: 중기 (Vegetative), 2: 수확기 (Harvest)
    growth_level = 0
    
    # 남은 일수가 7일 이하거나, 면적이 충분히 크면 수확기
    if remaining_days <= 7 or leaf_area > 60000:
        growth_level = 2 
    # 재배일수가 14일 넘었거나 면적이 어느 정도 되면 중기
    elif days_grown > 14 or leaf_area > 10000:
        growth_level = 1
    # 그 외는 초기
    else:
        growth_level = 0

    total_cycle = days_grown + remaining_days
    if total_cycle == 0:
        growth_pct = 0
    else:
        growth_pct = (days_grown / total_cycle) * 100

    growth_pct =  round(growth_pct, 1)    
    
    return growth_level, risk_score, growth_pct