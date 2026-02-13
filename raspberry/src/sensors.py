import spidev
import adafruit_dht
from w1thermsensor import W1ThermSensor
import json
import board
import os
import random  # [추가] 랜덤 값 생성을 위해

# ==========================================
# [설정] 테스트 모드 (True: 센서 없어도 가짜 값 생성 / False: 실제 센서 읽기)
TEST_MODE = False 
water_temp_sensor = None
if not TEST_MODE:
    try:
        water_temp_sensor = W1ThermSensor()
    except:
        # 센서가 연결 안 되어 있으면 None (나중에 기본값 처리)
        pass
# ==========================================

# 설정 로드
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(BASE_DIR, 'config', 'settings.json')


with open(CONFIG_PATH, 'r') as f:
    config = json.load(f)

DHT_BCM_PIN = config['sensors']['dht_pin']
DHT_PIN = getattr(board, f"D{DHT_BCM_PIN}")
dht = adafruit_dht.DHT22(DHT_PIN)

# 하드웨어 초기화 (테스트 모드일 땐 실패해도 무시)
spi = spidev.SpiDev()
try:
    spi.open(config['sensors']['spi_bus'], config['sensors']['spi_device'])
    spi.max_speed_hz = 1350000
except:
    print("SPI open failed (테스트 모드라면 무시하세요)")

try:
    water_temp_sensor = W1ThermSensor()
except:
    water_temp_sensor = None

def read_adc(channel):
    if TEST_MODE: return 0 # 테스트 모드면 ADC 안 읽음
    if channel < 0 or channel > 7:
        return -1
    adc = spi.xfer2([1, (8 + channel) << 4, 0])
    data = ((adc[1] & 3) << 8) + adc[2]
    return data

def read_dht():
    if TEST_MODE: return (25.0, 60.0)
    try:
        t = dht.temperature
        h = dht.humidity
        return t, h
    except RuntimeError as e:
        # DHT 읽기 실패는 흔함
        return None, None
    except Exception as e:
        return None, None

def read_water_temp():
    if TEST_MODE: return 24.5
    if water_temp_sensor:
        try:
            return water_temp_sensor.get_temperature()
        except:
            return None
    return None

def read_all():
    """
    모든 센서 값을 읽어서 딕셔너리로 반환
    """
    data = {}

    # 1. 수온 (DS18B20)
    if water_temp_sensor:
        try:
            data['water_temp'] = round(water_temp_sensor.get_temperature(), 1)
        except:
            data['water_temp'] = 25.0
    else:
        data['water_temp'] = 25.0

    # 2. 온습도
    air_temp, humidity = read_dht()

    data['air_temp'] = air_temp if air_temp is not None else 0.0
    data['humidity'] = humidity if humidity is not None else 0.0
    
    # 3. 조도, pH, EC (ADC)
    try:
        # 조도 3.3v
        light_raw = read_adc(0)
        light_percent = 100.0 - ((light_raw / 1023.0) * 100.0)

        data['light_percent'] = round(max(0.0, min(100.0, light_percent)), 1)
        data['light_raw'] = light_raw

        # pH 5
        ph_raw = read_adc(1)
        ph_volt = (ph_raw * 3.3) / 1023.0
        neutral_v = config['calibration']['ph_neutral_voltage']
        ph_val = 7.0 + (ph_volt - neutral_v) * 3.5 
        data['ph'] = round(max(0.0, min(14.0, ph_val)), 2)
        data['ph_volt'] = round(ph_volt, 2)

        # EC 5
        ec_raw = read_adc(2)
        ec_volt = (ec_raw * 5) / 1023.0
        
        # 온도 보상 계수 계산 (표준 25도 기준)
        # 예: 1도 차이마다 2% 보정
        temp_coefficient = 1.0 + 0.02 * (data['water_temp'] - 25.0)
        
        # 전압 -> EC 변환 (간이 공식)
        # K값(1.0) * 전압 / 온도계수
        k_value = config['calibration']['ec_k_value']
        ec_val = (ec_volt * k_value) / temp_coefficient - 1.8
        
        data['ec'] = round(max(0.0, ec_val), 2) # mS/cm 단위 가정
        data['ec_volt'] = round(ec_volt, 2)

    except Exception as e:
        print(f"ADC Error: {e}")
        data['light_percent'] = 0
        data['ph'] = 7.0
        data['ec'] = 0.0
        
    return data