# HoLab! 노동권 구제 에이전트 (시연용 프로토타입)

## 실행
1. `start.bat` 더블클릭 → 처음이면 `.env`가 열립니다. `OPENAI_API_KEY=` 뒤에 키를 붙여 넣고 저장.
2. 다시 `start.bat` 실행 → 브라우저에서 http://localhost:3000 이 열립니다.
   (키가 없어도 규칙 기반 대체 응답으로 시연 가능)

## 구조
- `server.js` : 의존성 없는 Node 서버. OpenAI 호출(키는 서버 `.env`에만 존재), 법제처 조문 조회, 상담 라우팅. 실패 시 대체 응답.
- `web/` : **화면(React + Tailwind + shadcn/ui)**. 빌드 결과 `web/dist`를 서버가 서비스합니다.
  - 개발: `cd web` → `npm install` → `npm run dev` (서버는 따로 `node server.js`, /api는 3000으로 프록시)
  - 화면 수정 후 반영: `cd web` → `npm run build` → 서버 재시작 불필요(새로고침)
  - shadcn 컴포넌트 추가: `npx shadcn@latest add <이름>`
- `public/` : 이전 버전 화면. `web/dist`가 없을 때만 대신 사용됩니다.
- `knowledge/` : 계약서 분석 때 AI가 참고할 `.md` 자료 폴더.

## 주의
- 시연장 인터넷 연결 필수(OCR 엔진, 글꼴, 법령 조회). 시연 전에 샘플 OCR을 한 번 돌려 두세요.
- 노무사 매칭과 전송은 가상입니다. 이 서비스는 법률 자문이 아닙니다.
- 채팅에 노출된 API 키는 시연 후 반드시 폐기하세요.