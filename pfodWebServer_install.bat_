@echo off
echo Starting pfodWebServer...
echo.
echo This will install dependencies if needed and start the server
echo Press Ctrl+C to stop the server when finished
echo.
::   pfodWebSersver.bat
:: * (c)2025 Forward Computing and Control Pty. Ltd.
:: * NSW Australia, www.forward.com.au
:: * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
:: * This generated code may be freely used for both private and commercial use
:: * provided this copyright is maintained.

cd data

:: Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed or not in your PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo Error installing dependencies
        pause
        exit /b 1
    )
    echo Dependencies installed successfully
    echo.
)

:: Ensure express is installed
echo Checking for express...
call npm install express
if %ERRORLEVEL% NEQ 0 (
    echo Warning: Could not install express
)

:: Start the server
echo Starting pfodWebServer...
echo The server will run on port 8080 by default
echo.
echo Once the server has started, open your browser to:
echo   http://localhost:8080
echo.
echo Usage Instructions:
echo 1. Enter a target IP address (e.g., 192.168.1.100)
echo 2. Click "Launch pfodWeb" for standard interface
echo 3. Click "Launch pfodWebDebug" for debug interface with console logging
echo.
echo The pfodWeb interface will send menu requests to your specified IP
echo while serving all web files from this server.
echo.

node pfodWebServer.js

pause