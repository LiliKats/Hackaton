@echo off

REM -- Set up environment vars and print instructions --
setlocal EnableExtensions
set ENV_NAME=aitools
set LLM_FARM_API_KEY=9aa7db2b45044b0eab0c9b5d8e074e64


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

echo Starting LiteLLM Proxy...
call conda activate %ENV_NAME%
litellm --config config.yaml --port 4000

endlocal