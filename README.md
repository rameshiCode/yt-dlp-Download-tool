# YT-DLP Download Tool

A modern web application for downloading YouTube videos as MP3 files with genre-based organization.

## Features

- 🎵 Download YouTube videos as high-quality MP3 files
- 📁 Automatic genre-based folder organization
- 📝 Batch download support (multiple URLs)
- 📊 Real-time download progress tracking
- 🏷️ Automatic metadata tagging
- 📋 Download history and queue management
- ⚡ Modern React frontend with FastAPI backend

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React with Vite
- **Download Engine**: yt-dlp
- **Audio Processing**: FFmpeg

## Project Structure

```
yt-dlp-Download-tool/
├── backend/           # FastAPI backend
├── frontend/          # React frontend
├── downloads/         # Downloaded files organized by genre
├── venv/             # Python virtual environment
└── README.md
```

## Setup

1. Create and activate virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install backend dependencies:
```bash
cd backend
pip install -r requirements.txt
```

3. Install frontend dependencies:
```bash
cd frontend
npm install
```

4. Run the application:
```bash
# Terminal 1 - Backend
cd backend
uvicorn main:app --reload

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Usage

1. Open the web interface
2. Enter YouTube URL(s) in the input field
3. Select the appropriate genre
4. Click "Download" to start the process
5. Monitor progress in real-time
6. Files will be saved in `downloads/{genre}/` folder

## Download Command

The application uses this optimized yt-dlp command:
```bash
yt-dlp -f bestaudio --extract-audio --audio-format mp3 --audio-quality 0 --embed-subs --write-info-json "YOUTUBE_URL"
```
