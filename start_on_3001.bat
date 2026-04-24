@echo off
set PORT=3001
set NODE_ENV=development
pnpm run dev > server_3001_stdout.log 2> server_3001_stderr.log
