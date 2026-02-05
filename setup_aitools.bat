@echo off

REM -- Set up environment vars and print instructions --
setlocal EnableExtensions
set ENV_NAME=aitools
set PYVER=3.11

REM --- Logic ---

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

REM -- Print instructions --
echo This script will:
echo 1. Create and activate a new Conda environment "%ENV_NAME%" with Python %PYVER%
echo 2. Install LiteLLM Proxy package
echo 3. Install Claude Code package
echo.
echo Note: you need to run this script only once
echo.

echo Installing packages... this will take a few minutes
echo.

REM -- Make sure conda is available in this session --
for /f "delims=" %%I in ('where conda.bat 2^>nul') do set "CONDA_BAT=%%I"
if not defined CONDA_BAT (
  if exist "%UserProfile%\miniconda3\condabin\conda.bat" set "CONDA_BAT=%UserProfile%\miniconda3\condabin\conda.bat"
  if exist "%UserProfile%\anaconda3\condabin\conda.bat" set "CONDA_BAT=%UserProfile%\anaconda3\condabin\conda.bat"
)
if not defined CONDA_BAT (
  echo [ERROR] Could not find conda.bat. Run from "Anaconda Prompt" or add Conda to PATH.
  goto :END
)

REM -- Initialize conda into this cmd.exe session --
call "%CONDA_BAT%" activate

REM -- Create env if missing --
call conda env list | findstr /C:" %ENV_NAME% " >nul
if errorlevel 1 (
  echo Creating environment "%ENV_NAME%" with Python %PYVER%...
  call conda create -y -n "%ENV_NAME%" python=%PYVER%
) else (
  echo Environment "%ENV_NAME%" already exists. Skipping create.
)

REM -- Activate env (must use call) --
call conda activate "%ENV_NAME%"

REM -- Show which Python we’re using --
where python
python -V
echo.

REM -- Install the needed packages. Safer to use python -m pip; add retries if you’re behind a proxy --
set "PIP_DISABLE_PIP_VERSION_CHECK=1"
set "PIP_DEFAULT_TIMEOUT=120"

echo Upgrading pip...
python -m pip install --upgrade pip

echo Installing LiteLLM (proxy extras)...
python -m pip install "litellm[proxy]"

echo Installing Claude Code via official method...
where node >nul 2>&1
if errorlevel 1 (
  echo [WARNING] Node.js not found. Install from https://nodejs.org/ then run: npm install -g @anthropic-ai/claude-code
) else (
  echo Installing Claude Code via NPM...
  npm install -g @anthropic-ai/claude-code
)

REM -- All done! --
echo.
echo Setup complete!
echo.
echo To use later: conda activate %ENV_NAME%

:END
echo.
pause
endlocal
