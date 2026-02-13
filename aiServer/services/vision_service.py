from ultralytics import YOLO
import cv2
import os
import numpy as np

# [설정] 학습된 모델 파일명으로 변경 (lettuce_analyze.pt -> best.pt 가정)
# 만약 파일명이 다르다면 여기서 수정하세요.
MODEL_PATH = os.path.join(os.path.dirname(__file__), "../models/lettuce_analyze.pt")

try:
    model = YOLO(MODEL_PATH)
    print(f"✅ YOLOv8 Custom Model Loaded: {MODEL_PATH}")
except Exception as e:
    print(f"⚠️ Model Load Failed: {e}")
    model = None

def analyze_leaf_area(image_path):
    """
    YOLOv8 Seg를 이용해 1) 잎 면적, 2) 잎 개수, 3) 건강 상태(HSV) 분석
    """
    if model is None:
        return {"leaf_area": 0.0, "leaf_count": 0, "health_score": 0, "health_msg": "System Error"}

    try:
        # 이미지 로드
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Image not found")

        # 추론 (Conf 0.25 이상만 감지)
        results = model.predict(img, conf=0.25)
        
        total_area = 0.0
        leaf_count = 0
        hue_values = [] 
        
        # 1. Segmentation 결과 분석
        for result in results:
            # [CASE A] 마스크(Segmentation) 데이터가 있는 경우 (정상)
            if result.masks is not None:
                # 마스크 데이터 (GPU -> CPU -> Numpy)
                masks = result.masks.data.cpu().numpy()
                
                # [핵심] 감지된 마스크의 개수가 곧 잎의 개수입니다.
                # 단, 너무 작은 노이즈를 거르기 위해 아래 루프에서 실제 면적을 확인 후 카운트할 수도 있습니다.
                # 여기서는 일단 전체 감지 개수로 잡고, 면적 계산 시 필터링을 고려합니다.
                temp_leaf_count = 0 
                
                for i, mask in enumerate(masks):
                    # 마스크 크기 보정 (이미지 원본 크기 640x480 등으로 리사이즈)
                    mask_resized = cv2.resize(mask, (img.shape[1], img.shape[0]))
                    
                    # 이진화 (확률 0.5 이상을 잎으로 간주)
                    mask_binary = mask_resized > 0.5
                    
                    # 면적 계산 (픽셀 수)
                    area = np.sum(mask_binary)
                    
                    # [노이즈 필터] 너무 작은 점(예: 50픽셀 미만)은 무시
                    if area < 50:
                        continue
                        
                    temp_leaf_count += 1
                    total_area += area
                    
                    # --- [HSV 색상 분석] ---
                    # 해당 마스크 영역의 픽셀만 추출하여 평균 색상 계산
                    hsv_img = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
                    leaf_pixels = hsv_img[mask_binary]
                    
                    if len(leaf_pixels) > 0:
                        avg_h = np.mean(leaf_pixels[:, 0]) # Hue 채널
                        hue_values.append(avg_h)
                
                leaf_count = temp_leaf_count

            # [CASE B] 박스(Detection) 데이터만 있는 경우 (Fallback)
            elif result.boxes is not None:
                leaf_count = len(result.boxes)
                for box in result.boxes.xywh:
                    # w * h
                    total_area += (box[2] * box[3])

        # 2. 건강 상태 평가 (HSV 기반)
        # 상추 녹색 범위 (Hue: 35 ~ 85)
        health_score = 100
        health_msg = "아주 건강함"
        
        if hue_values:
            avg_hue_total = np.mean(hue_values)
            
            if 40 <= avg_hue_total <= 85:
                health_score = 95
                health_msg = "건강한 녹색"
            elif 25 <= avg_hue_total < 40:
                health_score = 60
                health_msg = "잎이 노랗게 변함(영양 부족 주의)"
            elif avg_hue_total < 25:
                health_score = 30
                health_msg = "갈변 현상 심각(질병 의심)"
            else:
                # 85 이상 (너무 푸르거나 다른 색)
                health_score = 80
                health_msg = "색상 양호"
        else:
            if leaf_count == 0:
                health_score = 0
                health_msg = "감지된 작물 없음"

        return {
            "leaf_area": float(total_area), # 총 픽셀 면적
            "leaf_count": int(leaf_count),  # 감지된 잎 개수
            "health_score": int(health_score),
            "health_msg": health_msg,
            "avg_hue": float(np.mean(hue_values)) if hue_values else 0.0
        }

    except Exception as e:
        print(f"❌ Vision Analysis Error: {e}")
        return {"leaf_area": 0.0, "leaf_count": 0, "health_score": 0, "health_msg": "Analysis Error"}