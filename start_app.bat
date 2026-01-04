@echo off
echo Starting Spotify Toolkit...

:: Start Server in a new window
echo Starting Server...
start "Spotify Toolkit Server" cmd /k "cd server && npm start"

:: Start Client in a new window
echo Starting Client...
start "Spotify Toolkit Client" cmd /k "cd client && npm run dev"

echo Done.
