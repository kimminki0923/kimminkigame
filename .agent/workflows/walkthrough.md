---
description: Project Walkthrough for Infinite Stairs AI Game
---

# 🚀 Infinite Stairs AI 프로젝트 워크쓰루

이 프로젝트는 고전적인 "무한의 계단" 게임을 현대적인 웹 기술과 인공지능(강화학습)을 결합하여 재해석한 프로젝트입니다.

## 🏗️ 전체 아키텍처

- **Frontend**: HTML5, Vanilla CSS, JavaScript (Pure logic)
  - **Game Engine**: Canvas API를 이용한 자체 제작 엔진
  - **AI Inference**: `onnxruntime-web`을 사용하여 브라우저에서 직접 AI 모델 실행
  - **UI/UX**: Glassmorphism 디자인 및 모바일 대응 반응형 레이아웃
- **Backend**: Python (PyTorch, Stable Baselines3)
  - **Training**: PPO(Proximal Policy Optimization) 알고리즘을 사용하여 최적의 계단 오르기 전략 학습
  - **Export**: 학습된 모델을 웹에서 사용 가능한 `.onnx` 형식으로 변환
- **Database & Auth**: Firebase (Google Login, Firestore)

## 🎮 주요 기능

1.  **플레이 모드**: 사용자가 직접 방향 전환과 오르기 버튼으로 조작
2.  **AI 모드**: 학습된 ONNX 모델이 실시간으로 계단을 분석하여 자동 플레이
3.  **수집 및 상점**: 게임 중 획득한 코인으로 다양한 캐릭터 스킨 구매
4.  **랭킹 시스템**: 구글 로그인을 통한 사용자별 최고 기록 저장 및 랭킹 확인 (Firebase)
5.  **AI 학습 시스템**: 백엔드에서 에이전트가 끊임없이 학습하며 모델 고도화

## 🛠️ 기술적 특징

- **동적 카메라**: 캐릭터의 움직임에 맞춘 부드러운 카메라 오프셋 적용
- **데이터 지속성**: Firebase Firestore를 통해 로그인 시 이전 기록(최고 점수, 코인, 보유 스킨) 연동
- **모바일 최적화**: 터치 제어와 고해상도 디스플레이 대응

## 📂 폴더 구조

- `/frontend`: 게임 클라이언트 (HTML, CSS, JS)
  - `script.js`: 핵심 게임 엔진 및 렌더링
  - `auth.js`: Firebase 로그인 및 데이터 통신
  - `model.onnx`: AI 모델 파일
- `/backend`: AI 모델 학습 스크립트
  - `train.py`: SB3를 이용한 학습 코드
  - `env.py`: 게임 환경을 시뮬레이션하는 Gym 환경
- `FIREBASE_SETUP.md`: 서비스 설정을 위한 가이드라인

## 🚀 시작하기

1.  **프론트엔드**: `frontend/index.html`을 라이브 서버로 실행
2.  **백엔드 (학습용)**: 
    ```bash
    pip install -r requirements.txt
    python backend/train.py
    ```

---
// turbo-all
## 🔄 개발 워크플로우
- UI 수정 필요 시: `frontend/style.css` 수정
- 게임 밸런스 조정: `frontend/script.js` 내 상수 수정
- AI 성능 향상: `backend/train.py` 파라미터 튜닝 후 ONNX 재배포
