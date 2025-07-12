from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Any
import asyncio
import json
import os
import subprocess
import uuid
from pathlib import Path
import yt_dlp
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, TIT2, TPE1, TALB, TCON
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="YT-DLP Download Tool", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class DownloadRequest(BaseModel):
    urls: List[HttpUrl]
    genre: str
    quality: Optional[str] = "0"  # 0 = best quality

class DownloadStatus(BaseModel):
    id: str
    url: str
    status: str  # pending, downloading, completed, error
    progress: float = 0.0
    title: Optional[str] = None
    error: Optional[str] = None
    file_path: Optional[str] = None

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                pass

manager = ConnectionManager()

# Global storage for download status
download_queue: Dict[str, DownloadStatus] = {}
download_history: List[DownloadStatus] = []

# Ensure downloads directory exists
DOWNLOADS_DIR = Path("../downloads")
DOWNLOADS_DIR.mkdir(exist_ok=True)

def get_genre_folder(genre: str) -> Path:
    """Create and return genre-specific folder"""
    genre_folder = DOWNLOADS_DIR / genre.lower().replace(" ", "_")
    genre_folder.mkdir(exist_ok=True)
    return genre_folder

class DownloadProgressHook:
    def __init__(self, download_id: str):
        self.download_id = download_id

    def __call__(self, d):
        if d['status'] == 'downloading':
            if 'total_bytes' in d and d['total_bytes']:
                progress = (d['downloaded_bytes'] / d['total_bytes']) * 100
            elif '_percent_str' in d:
                progress = float(d['_percent_str'].replace('%', ''))
            else:
                progress = 0.0
            
            download_queue[self.download_id].progress = progress
            
            # Broadcast progress update
            asyncio.create_task(manager.broadcast({
                'type': 'progress',
                'download_id': self.download_id,
                'progress': progress
            }))
        
        elif d['status'] == 'finished':
            download_queue[self.download_id].status = 'completed'
            download_queue[self.download_id].progress = 100.0
            download_queue[self.download_id].file_path = d['filename']
            
            # Broadcast completion
            asyncio.create_task(manager.broadcast({
                'type': 'completed',
                'download_id': self.download_id,
                'file_path': d['filename']
            }))

async def download_video(download_id: str, url: str, genre: str, quality: str = "0"):
    """Download a single video"""
    try:
        genre_folder = get_genre_folder(genre)
        
        # yt-dlp options
        ydl_opts = {
            'format': 'bestaudio/best',
            'extractaudio': True,
            'audioformat': 'mp3',
            'audioquality': quality,
            'outtmpl': str(genre_folder / '%(title)s.%(ext)s'),
            'writeinfojson': True,
            'embedsubs': True,
            'progress_hooks': [DownloadProgressHook(download_id)],
        }
        
        download_queue[download_id].status = 'downloading'
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Extract info first
            info = ydl.extract_info(url, download=False)
            download_queue[download_id].title = info.get('title', 'Unknown')
            
            # Broadcast title update
            await manager.broadcast({
                'type': 'title_update',
                'download_id': download_id,
                'title': info.get('title', 'Unknown')
            })
            
            # Download the video
            ydl.download([url])
            
            # Add metadata to MP3
            mp3_path = genre_folder / f"{info.get('title', 'Unknown')}.mp3"
            if mp3_path.exists():
                add_metadata_to_mp3(str(mp3_path), info, genre)
        
        # Move to history
        completed_download = download_queue[download_id]
        download_history.append(completed_download)
        
    except Exception as e:
        logger.error(f"Download error for {url}: {str(e)}")
        download_queue[download_id].status = 'error'
        download_queue[download_id].error = str(e)
        
        await manager.broadcast({
            'type': 'error',
            'download_id': download_id,
            'error': str(e)
        })

def add_metadata_to_mp3(file_path: str, info: dict, genre: str):
    """Add metadata tags to MP3 file"""
    try:
        audio = MP3(file_path, ID3=ID3)
        
        # Add ID3 tag if it doesn't exist
        if audio.tags is None:
            audio.add_tags()
        
        # Add metadata
        audio.tags.add(TIT2(encoding=3, text=info.get('title', '')))
        audio.tags.add(TPE1(encoding=3, text=info.get('uploader', '')))
        audio.tags.add(TALB(encoding=3, text=info.get('uploader', '')))
        audio.tags.add(TCON(encoding=3, text=genre))
        
        audio.save()
        logger.info(f"Added metadata to {file_path}")
        
    except Exception as e:
        logger.error(f"Failed to add metadata to {file_path}: {str(e)}")

@app.get("/")
async def root():
    return {"message": "YT-DLP Download Tool API", "status": "running"}

@app.post("/download")
async def start_download(request: DownloadRequest):
    """Start downloading videos"""
    download_ids = []
    
    for url in request.urls:
        download_id = str(uuid.uuid4())
        download_status = DownloadStatus(
            id=download_id,
            url=str(url),
            status='pending',
            progress=0.0
        )
        
        download_queue[download_id] = download_status
        download_ids.append(download_id)
        
        # Start download task
        asyncio.create_task(download_video(
            download_id, str(url), request.genre, request.quality
        ))
    
    return {"message": "Downloads started", "download_ids": download_ids}

@app.get("/status")
async def get_status():
    """Get current download status"""
    return {
        "queue": list(download_queue.values()),
        "history": download_history[-10:]  # Last 10 completed downloads
    }

@app.get("/genres")
async def get_genres():
    """Get available genres (folders)"""
    genres = []
    if DOWNLOADS_DIR.exists():
        for item in DOWNLOADS_DIR.iterdir():
            if item.is_dir():
                genres.append(item.name.replace("_", " ").title())
    
    # Add some default genres if none exist
    default_genres = ["Hip Hop", "Rock", "Pop", "Electronic", "Jazz", "Classical", "Country", "R&B"]
    for genre in default_genres:
        if genre not in genres:
            genres.append(genre)
    
    return {"genres": sorted(genres)}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle any client messages if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
