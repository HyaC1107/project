import cv2
import numpy as np
from ultralytics import YOLO
from google.colab.patches import cv2_imshow

# 1. 학습된 최적의 모델 불러오기
model_path = '/content/runs/segment/Lettuce_Project/lettuce_seg_final/weights/best.pt'
model = YOLO(model_path)

# 2. 테스트 이미지 경로 (본인의 이미지 경로로 수정하세요)
test_image = '/content/Lettuce-segmentation-1/test/images/20200320_03291031_jpg.rf.e85983e789846f5175ec8dbb042a2927.jpg' 

# 3. 추론 시작
results = model(test_image)

for r in results:
    img = r.orig_img
    hsv_img = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    if r.masks is not None:
        for i, mask_data in enumerate(r.masks.data):
            # 마스크를 이미지 크기에 맞게 조정
            mask = mask_data.cpu().numpy()
            mask = cv2.resize(mask, (img.shape[1], img.shape[0]))
            
            # --- [분석 1: 면적 계산] ---
            # 0.5보다 큰 값을 가진 픽셀이 상추 잎 영역임
            pixel_area = np.sum(mask > 0.5)
            
            # --- [분석 2: HSV 색상 추출] ---
            # 배경은 버리고 상추 잎 부분의 픽셀값만 가져옴
            leaf_pixels = hsv_img[mask > 0.5]
            
            avg_h = np.mean(leaf_pixels[:, 0]) # 색상 (35-85: 녹색)
            avg_s = np.mean(leaf_pixels[:, 1]) # 채도 (선명도)
            avg_v = np.mean(leaf_pixels[:, 2]) # 명도 (밝기)

            # --- [분석 3: 수확 및 건강 판정] ---
            # 임계값은 실제 데이터를 보며 조정 가능합니다.
            health_label = "Healthy" if 35 <= avg_h <= 85 else "Warning"
            harvest_label = "Ready" if pixel_area > 50000 else "Growing" # 50000은 예시값
            
            print(f"--- [상추 #{i+1} 분석 결과] ---")
            print(f"📏 면적(Pixel Count): {pixel_area}")
            print(f"🎨 평균 HSV: H:{avg_h:.1f}, S:{avg_s:.1f}, V:{avg_v:.1f}")
            print(f"📢 상태: {health_label} | {harvest_label}")
            print("-" * 30)

            # 시각화: 마스크 씌우기
            img[mask > 0.5] = img[mask > 0.5] * 0.7 + np.array([0, 255, 0]) * 0.3

cv2_imshow(img)