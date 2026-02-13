# scripts/mock_sensor.py
import random
import json

# 실제 센서가 없으니 랜덤값을 생성해요! 🐘✨
data = {
    "ph_value": round(random.uniform(5.5, 7.5), 2),
    "water_temp": round(random.uniform(20.0, 25.0), 2),
    "air_temp": round(random.uniform(22.0, 28.0), 2),
    "humidity": round(random.uniform(40, 60), 1)
}

# 결과를 JSON으로 출력해서 Express가 읽을 수 있게 해요.
print(json.dumps(data))