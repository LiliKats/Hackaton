@echo off

REM -- Set up environment vars and print instructions --
set ENV_NAME=aitools
set ANTHROPIC_AUTH_TOKEN=9aa7db2b45044b0eab0c9b5d8e074e64
set ANTHROPIC_BASE_URL=http://localhost:4000/claude-sonnet-4_20250514

REM -- Turn off the LLM Farm "POST /cc/api/event_logging/batch HTTP/1.1" 404 Not Found errors --
set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
set CLAUDE_CODE_ENABLE_TELEMETRY=0

REM -- Check if local proxy is running on localhost:3128 --
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "try{ $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',3128); if($c.Connected){$c.Close(); 'OPEN'} else {'CLOSED'} }catch{'CLOSED'}"`) do set "PORT=%%P"

REM -- If on BCN and no proxy running exit --
if /I not "%PORT%"=="OPEN" (
  REM --- Check if we are on BCN or IC (Internet Client) ---
  ping -n 1 rb-artifactory.bosch.com >nul 2>&1

  if %errorlevel%==0 ( 
	echo [ERROR] Local proxy not running on localhost:3128. Please run "Cmd with PX.bat" to launch a terminal with a proxy, and try again.
	exit /b 1
  )
)

echo Starting Claude Code...
call conda activate %ENV_NAME%
claude

endlocal