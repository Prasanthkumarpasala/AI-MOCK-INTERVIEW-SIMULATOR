#!/bin/bash

echo "🚀 Starting AI Mock Interview Simulator..."
echo ""

# Activate virtual environment
source .venv/Scripts/activate

# Start Backend in background
echo "⚙️  Starting Backend on http://localhost:8000 ..."
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Small delay to let backend boot
sleep 2

# Start Frontend
echo "🌐 Starting Frontend on http://localhost:3000 ..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Both servers are running!"
echo "   Frontend → http://localhost:3000"
echo "   Backend  → http://localhost:8000"
echo "   API Docs → http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

# Wait and handle Ctrl+C to kill both
trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
