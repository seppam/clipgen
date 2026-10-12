#!/bin/bash
# ClipGen — Start both server and client
cd "$(dirname "$0")"


echo "🎬 Starting ClipGen..."

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "Installing root dependencies..."
  npm install
fi
if [ ! -d "client/node_modules" ]; then
  echo "Installing client dependencies..."
  npm --prefix client install
fi

# Start server in background
node server/index.js &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Start client in background
npm --prefix client run dev &
CLIENT_PID=$!
echo "Client PID: $CLIENT_PID"

echo ""
echo "🎬 ClipGen is running!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop."

# Wait for either process to exit
wait $SERVER_PID $CLIENT_PID
