from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import shutil
import os
import requests
import json
import time
import numpy as np
import cv2
import joblib
from datetime import datetime, timedelta
from ultralytics import YOLO

# 서비스 모듈 임포트
from services.vision_service import analyze_leaf_area
from services.predict_service import predict_harvest_days, evaluate_growth_status

app = FastAPI(title="Codeponics AI Analysis Server")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# [설정] 경로 및 환경 변수
# =========================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "temp_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Express 백엔드 주소 (ai.js의 save-analysis 경로)
EXPRESS_SERVER_URL = "http://127.0.0.1:5000/api/ai/save-analysis"

@app.post("/analyze/crop")
async def analyze_crop(
    image: UploadFile = File(...),
    module_id: int = Form(...),
    days_grown: int = Form(...),
    avg_temp: float = Form(...),
    avg_hum: float = Form(...),
    total_lux: float = Form(...),
    water_ph: float = Form(...)
):
    """
    백엔드로부터 수신된 사진과 환경 데이터를 분석하여 
    DB 스키마(ai_results_crops)에 최적화된 결과를 반환합니다.
    """
    print(f"\n📡 [분석 요청] 모듈 ID: {module_id} ({days_grown}일차)")

    file_path = os.path.join(UPLOAD_DIR, f"temp_m{module_id}_{int(time.time())}.jpg")
    
    try:
        # 1. 이미지 임시 저장
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        
        # 2. Vision 분석 (YOLOv8 & HSV)
        # vision_result 예시: {"leaf_area": 1200.5, "health_score": 95, "health_msg": "..."}
        vision_result = analyze_leaf_area(file_path)
        leaf_area = vision_result.get("leaf_area", 0.0)
        leaf_count = vision_result.get("leaf_count", 0.0)
        health_score = vision_result.get("health_score", 0)
        health_msg = vision_result.get("health_msg", 0)
        avg_hue = vision_result.get("avg_hue", 0)
        
        # 3. 수확일 예측 (LGBM)
        # remaining_days: 수확까지 남은 일수 (정수)
        remaining_days = predict_harvest_days(days_grown, avg_temp, total_lux, leaf_area, avg_hum, water_ph, leaf_count)
        
        # 4. 종합 상태 평가 (DB 필드 규격에 맞춤)
        # health_msg: varchar(50)에 저장될 건강 상태 요약
        
        
        # 5. DB 스키마 필드 계산
        # (1) 성장률: (현재일 / 총 예상재배일) * 100
        total_expected_days = days_grown + remaining_days
        growth_rate = min(100.0, round((days_grown / total_expected_days) * 100, 1)) if total_expected_days > 0 else 0.0
        
        # (2) 예상 수확 날짜: 오늘 + 남은 일수
        harvest_date = (datetime.now() + timedelta(days=remaining_days)).strftime("%Y-%m-%d")
        
        # (3) 추정 크기: 픽셀 면적을 cm 단위로 보정 (프로젝트 설정값에 따라 조정 가능)
        estimated_size = round(leaf_area * 0.005, 2)

        # 6. 최종 페이로드 구성 (DB 테이블 ai_results_crops 컬럼명과 일치)
        analysis_data = {
            "growth_rate_pct": float(growth_rate),
            "leaf_health_status": health_msg[:50],  # varchar(50) 제한
            "estimated_size_cm": float(estimated_size),
            "expected_harvest_date": harvest_date
        }
        
        payload = {
            "type": "CROP",
            "module_id": module_id,
            "data": analysis_data,
            "health_score": health_score
        }
        
        # 7. 백엔드로 결과 전송 (Express 서버)
        try:
            res = requests.post(EXPRESS_SERVER_URL, json=payload, timeout=5)
            send_status = "Success" if res.status_code == 200 else f"Fail({res.status_code})"
        except Exception as e:
            send_status = f"Backend Offline: {str(e)}"

        return {
            "status": "success",
            "send_to_backend": send_status,
            "db_data": analysis_data
        }

    except Exception as e:
        print(f"❌ 분석 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)