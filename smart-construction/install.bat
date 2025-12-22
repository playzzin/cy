@echo off
echo Installing dependencies...
call npm install
call npm install --save typescript @types/node @types/react @types/react-dom @types/jest
call npm install --save styled-components @types/styled-components
call npm install --save @fortawesome/fontawesome-svg-core @fortawesome/free-solid-svg-icons @fortawesome/react-fontawesome

echo.
echo Installation complete! Run 'npm start' to start the development server.
pause
