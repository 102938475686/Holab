@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .env (
  copy .env.example .env >nul
  echo .env 파일을 만들었습니다. 메모장으로 열어 OPENAI_API_KEY 를 붙여 넣고 저장한 뒤 다시 실행하세요.
  notepad .env
  pause
  exit /b
)
start "" http://localhost:3000
node server.js
pause
