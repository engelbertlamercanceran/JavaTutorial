@echo off
title HACKO
cd /d "%~dp0"

REM 1) use Node.js if it is already installed
where node >nul 2>nul && ( set "NODE=node" & goto run )

REM 2) use a local copy downloaded on a previous run
if exist "%~dp0node\node.exe" ( set "NODE=%~dp0node\node.exe" & goto run )

REM 3) download a local, no-install copy of Node.js (one time, needs internet)
echo.
echo   First-time setup: downloading a local copy of Node.js (about 30 MB).
echo   This does not change your computer and needs no admin rights.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $arch = if ([Environment]::Is64BitOperatingSystem) {'x64'} else {'x86'}; $ver='v20.11.1'; $url = 'https://nodejs.org/dist/' + $ver + '/node-' + $ver + '-win-' + $arch + '.zip'; $zip = Join-Path $PSScriptRoot 'node.zip'; $tmp = Join-Path $PSScriptRoot '_node'; Write-Host ('  Downloading ' + $url); Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing; if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }; Expand-Archive -Path $zip -DestinationPath $tmp -Force; $d = Get-ChildItem $tmp -Directory | Select-Object -First 1; $dest = Join-Path $PSScriptRoot 'node'; New-Item -ItemType Directory -Force -Path $dest | Out-Null; Copy-Item (Join-Path $d.FullName '*') $dest -Recurse -Force; Remove-Item $zip, $tmp -Recurse -Force"

if not exist "%~dp0node\node.exe" (
  echo.
  echo   Could not set up Node.js automatically.
  echo   Please install it from https://nodejs.org  ^(the "LTS" button^) and run this again.
  echo.
  pause
  exit /b 1
)
set "NODE=%~dp0node\node.exe"

:run
start "" "http://localhost:__PORT__/"
"%NODE%" serve.js
echo.
echo   HACKO has stopped. You can close this window.
pause
