import psycopg2
import os
import time
import random
from dotenv import load_dotenv
import json  
from datetime import datetime
load_dotenv()

# 1. DB 연결 설정 (Hya 관리자님의 새 계정 정보로 바꿔주세요! hya 등)

DB_HOST = os.getenv("DB_HOST")
DB_DATABASE = os.getenv("DB_DATABASE")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_PORT = os.getenv("DB_PORT")

conn = psycopg2.connect(
    host=DB_HOST,
    database=DB_DATABASE,
    user=DB_USER, 
    password=DB_PASSWORD,
    port=DB_PORT
)
cur = conn.cursor()

def generate_mock_data():
    try:
        cur.execute("SELECT module_id, module_name FROM modules")
        modules = cur.fetchall()

        for mod in modules:
            m_id, m_name = mod
            
            # 1. 데이터를 딕셔너리 형태로 묶어줍니다 (jsonb에 들어갈 내용)
            # 나중에 센서가 추가되면 여기만 한 줄 더 쓰면 끝나요! 🐘✨
            sensor_data = {
                "ph_value": round(random.uniform(6.5, 7.5), 1),
                "ec_value": round(random.uniform(1.0, 2.0), 1),
                "water_temp": round(random.uniform(23.0, 26.0), 1),
                "air_temp": round(random.uniform(24.0, 28.0), 1),
                "humidity": round(random.uniform(50.0, 70.0), 1),
                "lux_value": random.randint(500, 1000)
            }

            # 2. ✨ 핵심: 이제 INSERT 문이 아주 심플해집니다!
            # module_id와 sensor_data(jsonb) 딱 두 개만 넣으면 돼요.
            sql = """INSERT INTO sensor_logs (module_id, sensor_data, recorded_at) 
                     VALUES (%s, %s, NOW())"""
            
            # psycopg2는 딕셔너리를 자동으로 JSON으로 변환해 주기도 하지만, 
            # 확실하게 하기 위해 json.dumps()를 써줍니다.
            cur.execute(sql, (m_id, json.dumps(sensor_data)))
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {m_name} 데이터 전송 완료! -> {sensor_data}")

        conn.commit()
    except Exception as e:
        print(f"에러 발생: {e}")
        conn.rollback()

# 무한 반복 실행 (5초마다)
print("🚀 [jsonb 버전] 코드포닉스 가짜 데이터 생성기가 가동되었습니다! 🐘✨")
while True:
    generate_mock_data()
    time.sleep(5)