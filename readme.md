🐟 AI 지능형 아쿠아포닉스 통합 관리 플랫폼 (CodePonics)
(▲ 여기에 코드포닉스_시연_포스터.pdf를 이미지로 변환해서 넣거나, 메인 스크린샷을 넣으세요)

👀 서비스 소개
서비스명: CodePonics (코드포닉스) - Edge AI & Vision 기반 스마트팜 솔루션

서비스설명:



"물고기와 작물을 동시에, AI로 더 똑똑하게."



코드포닉스는 아쿠아포닉스(물고기 양식+수경재배)에 Edge AI와 Vision 기술을 접목한 무인 자동화 관리 플랫폼입니다.
기존 스마트팜의 단순 모니터링을 넘어, 실시간 수질 제어, 정밀 생육 진단, 그리고 LLM 기반의 자연어 리포트를 통해 누구나 쉽게 농장을 운영할 수 있도록 돕습니다.

📅 프로젝트 기간
2026.01.16 ~ 2026.02.13 (4주)


⭐ 주요 기능
Edge AI 수질 제어: 클라우드 의존 없이 엣지 디바이스(라즈베리파이)에서 LGBM 모델이 수질(pH) 위험을 예측하고 즉시 펌프를 제어합니다.

Vision 생육 모니터링: YOLOv8n-seg 모델을 활용하여 작물의 잎 면적을 픽셀 단위로 분석하고, 생장률 및 수확 시기를 예측합니다.

LLM 지능형 리포트: 복잡한 센서 데이터를 Llama-3가 분석하여, "오늘은 수온이 높으니 주의하세요" 같은 자연어 한줄평과 생장일지를 작성합니다.

실시간 대시보드: 5초 단위로 갱신되는 센서 데이터와 실시간 CCTV 화면을 웹에서 통합 관제합니다.

이중 알림 시스템: 위험 상황 발생 시 대시보드 알림 및 즉각적인 자동 제어 로그를 제공합니다.

⛏ 기술스택
<table>
<tr>
<th>구분</th>
<th>내용</th>
</tr>
<tr>
<td><b>사용언어</b></td>
<td>
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=JavaScript&logoColor=white"/>
<img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=Python&logoColor=white"/>
<img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=HTML5&logoColor=white"/>
<img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=CSS3&logoColor=white"/>
</td>
</tr>
<tr>
<td><b>프레임워크</b></td>
<td>
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=Node.js&logoColor=white"/>
<img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=Express&logoColor=white"/>
<img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=FastAPI&logoColor=white"/>
</td>
</tr>
<tr>
<td><b>AI / ML</b></td>
<td>
<img src="https://img.shields.io/badge/YOLOv8-00FFFF?style=for-the-badge&logo=YOLO&logoColor=black"/>
<img src="https://img.shields.io/badge/LightGBM-FLAML-blue?style=for-the-badge"/>
<img src="https://img.shields.io/badge/Llama 3-Meta-blue?style=for-the-badge"/>
<img src="https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=OpenCV&logoColor=white"/>
</td>
</tr>
<tr>
<td><b>데이터베이스</b></td>
<td>
<img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=PostgreSQL&logoColor=white"/>
</td>
</tr>
<tr>
<td><b>하드웨어</b></td>
<td>
<img src="https://img.shields.io/badge/Raspberry Pi 4-A22846?style=for-the-badge&logo=Raspberry Pi&logoColor=white"/>
<img src="https://img.shields.io/badge/Sensors-Arduino-00979D?style=for-the-badge&logo=Arduino&logoColor=white"/>
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

⚙ 시스템 아키텍처
(▲ 발표자료에 있는 시스템 아키텍처 다이어그램 이미지를 여기에 넣으세요)


📌 하드웨어 구성 (Aqua-Kit)
(▲ 포스터나 발표자료에 있는 수조/하드웨어 세팅 사진을 넣으세요)


📌 서비스 흐름도 (Logic)
(▲ 데이터 수집 -> AI 분석 -> 제어/알림으로 이어지는 흐름도 이미지를 넣으세요)


📌 ER 다이어그램
(▲ DB 설계 ERD 이미지를 넣으세요)


🖥 화면 구성
메인 대시보드 (실시간 센서 모니터링)
생육 모니터링 (YOLO Vision 분석)
AI 리포트 & 생장일지 (LLM)
👨‍👩‍👦‍👦 팀원 역할
<table>
<tr>
<td align="center"><img src="https://via.placeholder.com/100?text=Leader" width="100" height="100"/></td>
<td align="center"><img src="https://via.placeholder.com/100?text=Member1" width="100" height="100"/></td>
<td align="center"><img src="https://via.placeholder.com/100?text=Member2" width="100" height="100"/></td>
<td align="center"><img src="https://via.placeholder.com/100?text=Member3" width="100" height="100"/></td>
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
<td align="center">PM, Backend,


System Arch</td>
<td align="center">AI 모델 학습,


HW 회로 설계</td>
<td align="center">DataBase 설계,


HW 제작</td>
<td align="center">Web Design,


Frontend Dev</td>
</tr>
<tr>
<td align="center"><a href="https://github.com/깃헙아이디" target='_blank'>github</a></td>
<td align="center"><a href="https://github.com/깃헙아이디" target='_blank'>github</a></td>
<td align="center"><a href="https://github.com/깃헙아이디" target='_blank'>github</a></td>
<td align="center"><a href="https://github.com/깃헙아이디" target='_blank'>github</a></td>
</tr>
</table>

🤾‍♂️ 트러블슈팅
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
