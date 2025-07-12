#!/bin/bash

# YT-DLP Download Tool Startup Script
# This script starts both the backend and frontend servers

echo "🎵 Starting YT-DLP Download Tool..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    echo -e "${YELLOW}Killing existing process on port $port...${NC}"
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 2
}

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${RED}❌ Virtual environment not found!${NC}"
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
fi

# Check if backend dependencies are installed
if [ ! -f "venv/lib/python*/site-packages/fastapi" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    source venv/bin/activate
    cd backend
    pip install -r requirements.txt
    cd ..
    echo -e "${GREEN}✅ Backend dependencies installed${NC}"
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
fi

# Check and kill existing processes
if check_port 9000; then
    echo -e "${YELLOW}⚠️  Port 9000 (backend) is already in use${NC}"
    kill_port 9000
fi

if check_port 9001; then
    echo -e "${YELLOW}⚠️  Port 9001 (frontend) is already in use${NC}"
    kill_port 9001
fi

# Create downloads directory if it doesn't exist
mkdir -p downloads

echo ""
echo -e "${BLUE}🚀 Starting servers...${NC}"
echo ""

# Start backend server
echo -e "${GREEN}📡 Starting Backend Server (Port 9000)...${NC}"
cd backend
source ../venv/bin/activate
python main.py &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if check_port 9000; then
    echo -e "${GREEN}✅ Backend server started successfully${NC}"
else
    echo -e "${RED}❌ Failed to start backend server${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Start frontend server
echo -e "${GREEN}🌐 Starting Frontend Server (Port 9001)...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait a moment for frontend to start
sleep 5

# Check if frontend started successfully
if check_port 9001; then
    echo -e "${GREEN}✅ Frontend server started successfully${NC}"
else
    echo -e "${RED}❌ Failed to start frontend server${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 YT-DLP Download Tool is now running!${NC}"
echo "=================================="
echo -e "${BLUE}📡 Backend API:${NC} http://localhost:9000"
echo -e "${BLUE}🌐 Frontend UI:${NC} http://localhost:9001"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   • Open http://localhost:9001 in your browser"
echo "   • Press Ctrl+C to stop both servers"
echo "   • Check the terminal for any error messages"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}✅ Servers stopped${NC}"
    exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup SIGINT SIGTERM

# Keep script running and show status
echo -e "${GREEN}✨ Servers are running. Press Ctrl+C to stop.${NC}"
echo ""

# Monitor both processes
while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${RED}❌ Backend server stopped unexpectedly${NC}"
        kill $FRONTEND_PID 2>/dev/null
        exit 1
    fi
    
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${RED}❌ Frontend server stopped unexpectedly${NC}"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
    
    sleep 5
done
