import os
import json
import time
import io
import sys
import transmitter  # 전송 모듈 임포트
from PIL import Image

# UTF-8 강제 설정
sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8', line_buffering=True)

try:
    from picamera2 import Picamera2
except ImportError:
    Picamera2 = None

# 설정 로드
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(BASE_DIR, 'config', 'settings.json')

try:
    with open(CONFIG_PATH, 'r') as f:
        config = json.load(f)
except:
    config = {}

RES_W = config.get('camera', {}).get('resolution', [640, 480])[0]
RES_H = config.get('camera', {}).get('resolution', [640, 480])[1]
QUALITY = config.get('camera', {}).get('quality', 70)

def capture_and_send_live(is_db_log=False):
    """
    [FIXED] 촬영 즉시 백엔드 ai.js로 전송 (메모리 방식)
    - Picamera2 버전 호환성 문제(quality 인자) 해결
    """
    if Picamera2 is None:
        print("Picamera2 라이브러리가 없습니다.")
        return False

    picam2 = None
    try:
        # 1. 카메라 설정 및 시작
        picam2 = Picamera2()
        still_config = picam2.create_still_configuration(main={"size": (RES_W, RES_H)})
        picam2.configure(still_config)
        picam2.start()
        
        time.sleep(1) # 웜업
        
        # 2. 메모리 스트림에 직접 촬영
        image_stream = io.BytesIO()
        
        # --- 수정 포인트: quality 인자 호환성 처리 ---
        try:
            # 일부 버전에서는 quality를 직접 인자로 받음
            picam2.capture_file(image_stream, format="jpeg", quality=QUALITY)
        except TypeError:
            try:
                # 다른 버전에서는 extra_properties나 options 형태를 사용함
                picam2.capture_file(image_stream, format="jpeg", extra_properties={"quality": QUALITY})
            except TypeError:
                # 모두 안 되면 기본값으로 촬영
                picam2.capture_file(image_stream, format="jpeg")
        # ------------------------------------------
        
        # 3. 카메라 종료 (전송 전 리소스 해제)
        picam2.stop()
        picam2.close()
        picam2 = None
        
        # 4. 스트림 위치를 처음으로 되돌려 전송 준비
        image_stream.seek(0)
        # 🔄 [추가] 이미지 반시계 90도 회전
        image = Image.open(image_stream)
        image = image.rotate(90, expand=True)  # 반시계 90도

        # 새 스트림에 다시 저장
        rotated_stream = io.BytesIO()
        image.save(rotated_stream, format="JPEG", quality=QUALITY)
        rotated_stream.seek(0)

        # 5. transmitter를 통해 멀티파트 전송
        success, result = transmitter.send_camera_image(
            rotated_stream,
            is_db_log=is_db_log
        )
        
        if success:
            print(f"전송 성공: {result.get('message', 'OK')}")
            return True
        else:
            print(f"전송 실패: {result}")
            return False

    except Exception as e:
        print(f"카메라 처리 중 오류: {e}")
        return False
    finally:
        if picam2:
            try:
                picam2.stop()
                picam2.close()
            except: pass

if __name__ == "__main__":
    # 테스트용
    capture_and_send_live(is_db_log=False)