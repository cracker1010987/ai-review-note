# AI 오답노트

틀린 문제 사진을 찍으면 AI가 문제를 옮겨 적고, 풀이·단원·유형을 정리하고, 망각곡선에 맞춰 복습시켜 주는 앱.

## 폴더
- `app/` — Expo(React Native) 앱. 안드로이드 우선, iOS 호환
- `supabase/` — DB 스키마, 보안 정책(RLS), 서버 함수
- `prototype/` — 기능 검증용 HTML 프로토타입 (브라우저에서 바로 열림)

## 개발
```bash
cd app
npm install
cp .env.example .env   # Supabase URL과 anon key 입력
npx expo start         # 안드로이드 폰의 Expo Go로 QR 스캔
npm test               # 핵심 로직 단위 테스트
npm run typecheck
```

AI는 사용자가 등록한 API 키(OpenAI, Anthropic, Google, OpenRouter)로 기기에서 직접 호출하고, 키는 기기 보안 저장소에만 둔다.
