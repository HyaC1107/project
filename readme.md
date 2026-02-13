# 🐟 AI 지능형 아쿠아포닉스 통합 관리 플랫폼 (팀명: CodePonics)
<p align="center">
<img width="700" height="990" alt="image" src="https://github.com/user-attachments/assets/0739485b-a715-474f-8d19-e256b65a3649" />
</p>
## 👀 서비스 소개
### 서비스명: AI 지능형 아쿠아포닉스 통합 관리 모듈

### 서비스설명:
CodePonics는 아쿠아포닉스(물고기 양식 + 수경재배)에 Edge AI와 Computer Vision 기술을 접목한 무인 자동화 통합 관리 플랫폼입니다.
기존 스마트팜의 단순 모니터링 한계를 넘어, 엣지 디바이스에서 스스로 위험을 판단·제어하고, openCV와 yolov8을 이용하여 작물의 생장분석 및 수확시기 예측을 하고,
LLM을 통해 사용자에게 직관적인 리포트를 제공하여 누구나 쉽게 농장을 운영할 수 있도록 돕습니다.

### 📅 프로젝트 기간
2026.01.16 ~ 2026.02.13 (4주)


## ⭐ 주요 기능
**Edge AI 수질 제어**: 클라우드 의존 없이 엣지 디바이스(라즈베리파이)에서 LGBM 모델이 수질(pH) 위험을 예측하고 즉시 펌프를 제어합니다.

**Vision 생육 모니터링**: openCV와 YOLOv8n-seg 모델을 활용하여 작물의 잎 면적을 픽셀 단위로 분석하고, 분석된 데이터를 기반으로 LGBM모델에서 수확 시기를 예측합니다.

**LLM 지능형 리포트**: 복잡한 센서 데이터를 Llama-3가 분석하여, "오늘은 수온이 높으니 주의하세요" 같은 자연어 한줄평과 일일/주간 리포트 생장일지를 작성합니다.

**사용자 친화적인 대시보드**: 단위 시간 별로 갱신되는 센서 데이터와 작물 사진을 모니터링으로 웹에서 사용자게 제공

## ⛏ 기술스택
<table>
<tr>
<th>구분</th>
<th>내용</th>
</tr>
<tr>
<td><b>Programming Language</b></td>
<td>
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=JavaScript&logoColor=white"/>
<img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=Python&logoColor=white"/>
</td>
</tr>
<tr>
<td><b>FrontEnd</b></td>
<td>
<img src="https://img.shields.io/badge/javascript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black">
<img src="https://img.shields.io/badge/HTML-E34F26?style=for-the-badge&logo=html5&logoColor=white">
<img src="https://img.shields.io/badge/CSS-1572B6?style=for-the-badge&logo=css3&logoColor=white">
</td>
</tr>
<tr>
<td><b>BackEnd</b></td>
<td>
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=Node.js&logoColor=white"/> 
<img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=Express&logoColor=white"/>
<img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=Socket.io&logoColor=white">
</td>
</tr>
<tr>
<td><b>Database</b></td>
<td>
<img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=PostgreSQL&logoColor=white"/>
</td>
</tr>
<tr>
<td><b>IDE</b></td>
<td>
<img src="https://img.shields.io/badge/VSCode-007ACC?style=for-the-badge&logo=VisualStudioCode&logoColor=white"/>
</td>
</tr>
<tr>
<tr>
<td><b>AI</b></td>
<td>
<img src="https://img.shields.io/badge/YOLOv8-00FFFF?style=for-the-badge&logo=YOLO&logoColor=black"/>
<img src="https://img.shields.io/badge/LightGBM-FLAML-blue?style=for-the-badge"/>
<img src="https://img.shields.io/badge/Llama 3-Meta-blue?style=for-the-badge"/>
<img src="https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=OpenCV&logoColor=white"/>
</td>
</tr>
<tr>
<td><b>협업도구</b></td>
<td>
<img src="https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=Git&logoColor=white"/>
<img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=GitHub&logoColor=white"/>
</td>
</tr>
</table>

## ⚙ 시스템 아키텍처
<p align="center">
<img width="1920" height="1080" alt="Server" src="https://github.com/user-attachments/assets/3fe869a0-84b1-42a7-b5a9-f2220cca7d30" />
</p>

## 📌 유스케이스
<p align="center">
<img width="775" height="559" alt="image" src="https://github.com/user-attachments/assets/3adf29dc-4685-43fc-bde0-e0c4eb6" />
</p>

## 📌 서비스 흐름도 (Logic)
<p align="center">
<img width="1133" height="626" alt="image" src="https://github.com/user-attachments/assets/aad7a2db-6320-405e-9c38-73c1bcce6f9d" />
</p>

## 📌 ER 다이어그램
<p align="center">
<img width="1212" height="1314" alt="codeponics v3" src="https://github.com/user-attachments/assets/82b85408-e462-4c5c-827d-fe66e517db61" />
</p>

## 🖥 화면 구성
### **메인 대시보드**
<p align="center">
<img width="1487" height="909" alt="2" src="https://github.com/user-attachments/assets/b9820331-50fa-4416-bcbb-f9ae106eff13" />
</p>

### **모니터링 상세 페이지**
<p align="center">
<img width="1477" height="908" alt="4" src="https://github.com/user-attachments/assets/cffd19a6-b326-49d4-b41c-c3752c4c5245" />
</p>

### **일일 리포트(LLM)**
<p align="center">
<img width="1453" height="901" alt="6" src="https://github.com/user-attachments/assets/e90aac8b-1b62-45a5-a7b2-1c0a7da4ad05" />
</p>

### **생장일지(LLM)**
<p align="center">
<img width="1483" height="904" alt="10" src="https://github.com/user-attachments/assets/8bd652b3-ff18-4757-915e-88f0491d79d3" />
</p>

### **사용자 설정**
<p align="center">
<img width="1493" height="912" alt="11" src="https://github.com/user-attachments/assets/f9a5db5d-892c-4e14-b28e-145aa26127eb" />
</p>

## 👨‍👩‍👦‍👦 팀원 역할
<table>

<tr>


<td align="center"><img width="100" height="100" alt="치즈" src="https://github.com/user-attachments/assets/a471010b-cd8c-424e-b8fe-a8d03e17ed4b" /></td>
<td align="center"><img width="100" height="100" alt="image" src="https://github.com/user-attachments/assets/67bd835d-b848-4823-aac8-5fe0cbd5a538" /></td>
<td align="center"><img width="100" height="100" alt="image" src="https://github.com/user-attachments/assets/8a624d72-62d5-44dd-b336-e8598224980d" /></td>
<td align="center"><img width="100" height="100" alt="image" src="https://github.com/user-attachments/assets/633a47b7-c5ed-44e7-b8cc-6fc25ae37622" /></td>
</tr>
<tr>
<td align="center"><strong>장철영</strong></td>
<td align="center"><strong>권태향</strong></td>
<td align="center"><strong>김태용</strong></td>
<td align="center"><strong>이엘리사</strong></td>
</tr>
<tr>
<td align="center"><b>👑 Team Leader</b></td>
<td align="center"><b>Hardware / AI</b></td>
<td align="center"><b>DB / Hardware</b></td>
<td align="center"><b>UI/UX / Frontend</b></td>
</tr>
<tr>
<td align="center">PM, Backend, AIServer, 
 Raspberry Embedded, System Arch</td>
  
<td align="center">AI 모델 학습,
HW 회로 설계</td>

<td align="center">DataBase 설계,
HW 제작</td>

<td align="center">Web Design,
Frontend Dev</td>

</tr>
<tr>
<td align="center"><a href="https://github.com/HyaC1107" target='_blank'>github</a></td>
<td align="center"><a href="https://github.com/Capernaum-user" target='_blank'>github</a></td>
<td align="center"><a href="https://github.com/kimtytytyty" target='_blank'>github</a></td>
<td align="center"><a href="https://github.com/eelishalee" target='_blank'>github</a></td>
</tr>
</table>

## 🤾‍♂️ 트러블슈팅
프로젝트 진행 중 발생한 주요 이슈와 해결 과정입니다.

Issue 1: 엣지 디바이스(RPi)의 연산 한계

문제: 라즈베리파이 환경에서 LSTM 같은 무거운 시계열 모델 구동 시 딜레이 발생.

해결: 경량화된 머신러닝 모델인 LightGBM으로 교체하여 정확도는 유지하되 추론 속도를 획기적으로 개선함.


Issue 2: 정형화되지 않은 잎 면적 계산

문제: 단순 Object Detection(Box)으로는 작물의 실제 생장 면적을 산출하기 어려움.

해결: YOLOv8n-seg(Segmentation) 모델을 도입하여 잎의 모양(Mask)을 픽셀 단위로 따내어 면적을 정밀 계산함.


Issue 3: 센서 데이터 노이즈

문제: 수조 환경 특성상 센서 데이터가 순간적으로 튀는 이상치(Outlier) 빈번 발생.

해결: 이동 평균 필터(Moving Average)와 이상치 제거 로직을 적용하여 데이터 신뢰도 확보.





