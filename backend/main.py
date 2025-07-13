from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Any, Set
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
import tempfile
import shutil

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="YT-DLP Download Tool", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:9001"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class DownloadRequest(BaseModel):
    urls: List[HttpUrl]
    genre: str
    quality: Optional[str] = "0"  # 0 = best quality

class AudioCutRequest(BaseModel):
    file_path: str
    start_time: float
    end_time: float
    output_name: Optional[str] = None

class DownloadStatus(BaseModel):
    id: str
    url: str
    status: str  # pending, downloading, completed, error
    progress: float = 0.0
    title: Optional[str] = None
    artist: Optional[str] = None
    clean_title: Optional[str] = None
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
downloaded_urls: Set[str] = set()  # Track all downloaded URLs

# Ensure downloads directory exists
DOWNLOADS_DIR = Path("../downloads")
DOWNLOADS_DIR.mkdir(exist_ok=True)

# URL tracking file
URL_HISTORY_FILE = DOWNLOADS_DIR / "url_history.txt"

def load_downloaded_urls():
    """Load previously downloaded URLs from file"""
    try:
        if URL_HISTORY_FILE.exists():
            with open(URL_HISTORY_FILE, 'r', encoding='utf-8') as f:
                for line in f:
                    url = line.strip()
                    if url:
                        downloaded_urls.add(url)
            logger.info(f"Loaded {len(downloaded_urls)} previously downloaded URLs")
    except Exception as e:
        logger.error(f"Error loading URL history: {e}")

def save_downloaded_url(url: str):
    """Save a downloaded URL to the history file"""
    try:
        with open(URL_HISTORY_FILE, 'a', encoding='utf-8') as f:
            f.write(f"{url}\n")
    except Exception as e:
        logger.error(f"Error saving URL to history: {e}")

# Load existing URLs on startup
load_downloaded_urls()

def get_genre_folder(genre: str) -> Path:
    """Create and return genre-specific folder with support for nested folders"""
    # Support nested folders using "/" or "\" as separators
    # Example: "Hip Hop/50 Cent" or "Hip Hop\G-Unit"
    genre_parts = genre.replace("\\", "/").split("/")

    # Clean each part and create nested folder structure
    folder_path = DOWNLOADS_DIR
    for part in genre_parts:
        clean_part = part.strip().replace(" ", "_").lower()
        if clean_part:  # Skip empty parts
            folder_path = folder_path / clean_part

    folder_path.mkdir(parents=True, exist_ok=True)
    return folder_path

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

        # yt-dlp options with better file naming and single video download
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': str(genre_folder / '%(uploader)s - %(title)s.%(ext)s'),
            'writeinfojson': False,  # Disable info json to avoid clutter
            'noplaylist': True,  # Only download single video, not entire playlist
            'progress_hooks': [DownloadProgressHook(download_id)],
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': quality,
            }],
            'extractaudio': True,
            'audioformat': 'mp3',
            'audioquality': quality,
        }
        
        download_queue[download_id].status = 'downloading'
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Extract info first
            info = ydl.extract_info(url, download=False)
            video_title = info.get('title', 'Unknown')
            uploader = info.get('uploader', 'Unknown')

            # Extract artist and clean title
            artist, clean_title = extract_artist_and_title(video_title, uploader)

            # Update download status
            download_queue[download_id].title = video_title
            download_queue[download_id].artist = artist
            download_queue[download_id].clean_title = clean_title

            # Broadcast title and artist update
            await manager.broadcast({
                'type': 'metadata_update',
                'download_id': download_id,
                'title': video_title,
                'artist': artist,
                'clean_title': clean_title
            })
            
            # Download the video
            ydl.download([url])

            # Find the downloaded MP3 file and add metadata
            uploader = info.get('uploader', 'Unknown')
            title = info.get('title', 'Unknown')

            # Try different possible file names
            possible_names = [
                f"{uploader} - {title}.mp3",
                f"{title}.mp3",
                f"{uploader}_{title}.mp3"
            ]

            mp3_path = None
            for name in possible_names:
                potential_path = genre_folder / name
                if potential_path.exists():
                    mp3_path = potential_path
                    break

            # If we still can't find it, look for any .mp3 file in the directory
            if not mp3_path:
                mp3_files = list(genre_folder.glob("*.mp3"))
                if mp3_files:
                    # Get the most recently created MP3 file
                    mp3_path = max(mp3_files, key=lambda p: p.stat().st_mtime)

            if mp3_path and mp3_path.exists():
                add_metadata_to_mp3(str(mp3_path), info, genre)

                # Rename file to a cleaner format: Artist - Title.mp3
                artist, clean_title = extract_artist_and_title(title, uploader)
                clean_filename = f"{artist} - {clean_title}.mp3"
                # Remove invalid characters for filename
                clean_filename = "".join(c for c in clean_filename if c.isalnum() or c in (' ', '-', '_', '.')).rstrip()
                new_path = genre_folder / clean_filename

                if mp3_path != new_path:
                    try:
                        mp3_path.rename(new_path)
                        logger.info(f"Renamed file to: {clean_filename}")
                        # Update the file path in the download queue to the new MP3 path
                        download_queue[download_id].file_path = str(new_path)
                    except Exception as e:
                        logger.warning(f"Could not rename file: {e}")
                else:
                    # File wasn't renamed, but update to MP3 path
                    download_queue[download_id].file_path = str(mp3_path)
            else:
                logger.warning(f"Could not find downloaded MP3 file for {title}")

        # Move to history
        completed_download = download_queue[download_id]
        download_history.append(completed_download)

        # Track the URL as downloaded
        downloaded_urls.add(url)
        save_downloaded_url(url)

        # Remove from active queue
        del download_queue[download_id]
        
    except Exception as e:
        logger.error(f"Download error for {url}: {str(e)}")
        download_queue[download_id].status = 'error'
        download_queue[download_id].error = str(e)

        await manager.broadcast({
            'type': 'error',
            'download_id': download_id,
            'error': str(e)
        })

        # Move failed downloads to history after a delay
        import asyncio
        await asyncio.sleep(5)  # Keep error visible for 5 seconds
        if download_id in download_queue:
            failed_download = download_queue[download_id]
            download_history.append(failed_download)
            del download_queue[download_id]

def normalize_string(s: str) -> str:
    """Normalize string for comparison by removing special chars and converting to lowercase"""
    import re
    # Remove special characters, convert to lowercase, remove extra spaces
    normalized = re.sub(r'[^\w\s]', '', s.lower())
    return ' '.join(normalized.split())

def check_url_duplicate(url: str) -> bool:
    """Check if URL has already been downloaded"""
    return url in downloaded_urls

def find_similar_songs(title: str, artist: str) -> List[Dict]:
    """Find similar songs in download history and existing files"""
    similar_songs = []

    # Normalize the input for comparison
    norm_title = normalize_string(title)
    norm_artist = normalize_string(artist)

    # Check download history
    for item in download_history:
        if hasattr(item, 'title') and hasattr(item, 'artist'):
            hist_title = normalize_string(item.title or '')
            hist_artist = normalize_string(item.artist or '')

            # Check for exact or very similar matches
            if (norm_title == hist_title and norm_artist == hist_artist) or \
               (norm_title in hist_title and norm_artist == hist_artist) or \
               (hist_title in norm_title and norm_artist == hist_artist):
                similar_songs.append({
                    'source': 'history',
                    'title': item.title,
                    'artist': item.artist,
                    'file_path': getattr(item, 'file_path', '')
                })

    # Check existing files
    try:
        files = scan_audio_files(DOWNLOADS_DIR)
        for file_info in files:
            file_title = normalize_string(file_info.get('title', ''))
            file_artist = normalize_string(file_info.get('artist', ''))

            if (norm_title == file_title and norm_artist == file_artist) or \
               (norm_title in file_title and norm_artist == file_artist) or \
               (file_title in norm_title and norm_artist == file_artist):
                similar_songs.append({
                    'source': 'file',
                    'title': file_info.get('title', file_info['name']),
                    'artist': file_info.get('artist', ''),
                    'file_path': str(DOWNLOADS_DIR / file_info['path'])
                })
    except Exception as e:
        logger.error(f"Error scanning files for duplicates: {e}")

    return similar_songs

def extract_artist_and_title(video_title: str, uploader: str):
    """Extract artist and title from video title using common patterns"""
    title = video_title.lower()

    # Common separators for artist - title
    separators = [' - ', ' – ', ' — ', ' | ', ' • ', ': ', ' ft. ', ' feat. ', ' featuring ']

    for sep in separators:
        if sep in title:
            parts = title.split(sep, 1)
            if len(parts) == 2:
                artist = parts[0].strip().title()
                song_title = parts[1].strip().title()
                return artist, song_title

    # If no separator found, try to use uploader as artist
    if uploader and uploader.lower() not in ['youtube', 'vevo', 'official']:
        # Clean up common suffixes from uploader names
        clean_uploader = uploader
        suffixes_to_remove = ['Official', 'VEVO', 'Records', 'Music', 'Channel', 'TV']
        for suffix in suffixes_to_remove:
            clean_uploader = clean_uploader.replace(suffix, '').strip()

        return clean_uploader, video_title

    # Fallback: use video title as both artist and title
    return "Unknown Artist", video_title

def add_metadata_to_mp3(file_path: str, info: dict, genre: str):
    """Add metadata tags to MP3 file with enhanced artist/title extraction"""
    try:
        audio = MP3(file_path, ID3=ID3)

        # Add ID3 tag if it doesn't exist
        if audio.tags is None:
            audio.add_tags()

        # Extract artist and title from video metadata
        video_title = info.get('title', 'Unknown Title')
        uploader = info.get('uploader', 'Unknown Artist')

        # Try to extract artist and title intelligently
        artist, title = extract_artist_and_title(video_title, uploader)

        # Add enhanced metadata
        audio.tags.add(TIT2(encoding=3, text=title))
        audio.tags.add(TPE1(encoding=3, text=artist))
        audio.tags.add(TALB(encoding=3, text=f"{genre} Collection"))
        audio.tags.add(TCON(encoding=3, text=genre))

        # Add additional metadata if available
        if info.get('upload_date'):
            try:
                year = info['upload_date'][:4]
                from mutagen.id3 import TDRC
                audio.tags.add(TDRC(encoding=3, text=year))
            except:
                pass

        if info.get('duration'):
            try:
                from mutagen.id3 import TLEN
                audio.tags.add(TLEN(encoding=3, text=str(int(info['duration'] * 1000))))
            except:
                pass

        audio.save()
        logger.info(f"Added enhanced metadata to {file_path}: Artist='{artist}', Title='{title}', Genre='{genre}'")

    except Exception as e:
        logger.error(f"Failed to add metadata to {file_path}: {str(e)}")

@app.get("/")
async def root():
    return {"message": "YT-DLP Download Tool API", "status": "running"}

@app.post("/check-duplicates")
async def check_duplicates(request: DownloadRequest):
    """Check for duplicate URLs and similar songs before downloading"""
    try:
        duplicates = {
            'url_duplicate': False,
            'similar_songs': [],
            'warnings': []
        }

        # Check each URL for duplicates
        for url in request.urls:
            url_str = str(url)

            # Check if URL was already downloaded
            if check_url_duplicate(url_str):
                duplicates['url_duplicate'] = True
                duplicates['warnings'].append(f"URL already downloaded: {url_str}")
                continue

            # Extract video info to check for similar songs
            try:
                with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
                    info = ydl.extract_info(url_str, download=False)
                    video_title = info.get('title', 'Unknown')
                    uploader = info.get('uploader', 'Unknown')

                    # Extract artist and title
                    artist, clean_title = extract_artist_and_title(video_title, uploader)

                    # Find similar songs
                    similar = find_similar_songs(clean_title, artist)
                    if similar:
                        duplicates['similar_songs'].extend([{
                            'url': url_str,
                            'new_title': clean_title,
                            'new_artist': artist,
                            'similar_files': similar
                        }])
                        duplicates['warnings'].append(f"Similar song found for: {artist} - {clean_title}")

            except Exception as e:
                logger.warning(f"Could not check duplicates for {url_str}: {e}")

        return duplicates

    except Exception as e:
        logger.error(f"Error checking duplicates: {e}")
        raise HTTPException(status_code=500, detail=f"Error checking duplicates: {str(e)}")

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
    # Get persistent history from file system (like audio editor does)
    persistent_history = []
    try:
        files = scan_audio_files(DOWNLOADS_DIR)
        # Convert file info to download history format
        for file_info in files:  # All files, just like audio editor
            # Create a download-like object from file info
            download_item = {
                "id": f"file_{hash(file_info['path'])}",  # Generate consistent ID from path
                "url": "",  # Not available from file system
                "status": "completed",
                "progress": 100.0,
                "title": file_info.get('title', file_info['name']),
                "artist": file_info.get('artist', ''),
                "clean_title": file_info.get('title', ''),
                "file_path": str(DOWNLOADS_DIR / file_info['path']),
                "genre": file_info.get('genre', ''),
                "error": None
            }
            persistent_history.append(download_item)
    except Exception as e:
        logger.error(f"Error getting persistent history: {e}")

    # Combine in-memory history with persistent history, avoiding duplicates
    combined_history = list(download_history)

    # Add persistent files that aren't already in memory
    for persistent_item in persistent_history:
        # Check if this file is already in memory history
        already_exists = any(
            item.file_path == persistent_item["file_path"]
            for item in download_history
            if hasattr(item, 'file_path') and item.file_path
        )
        if not already_exists:
            combined_history.append(persistent_item)

    return {
        "queue": list(download_queue.values()),
        "history": combined_history  # All completed downloads, just like audio editor
    }

def scan_folder_structure(path: Path, prefix: str = "") -> List[str]:
    """Recursively scan folder structure to get all possible genre paths"""
    genres = []
    if not path.exists():
        return genres

    for item in path.iterdir():
        if item.is_dir():
            # Convert folder name back to display format
            display_name = item.name.replace("_", " ").title()
            full_path = f"{prefix}/{display_name}" if prefix else display_name
            genres.append(full_path)

            # Recursively scan subfolders (limit depth to avoid infinite recursion)
            if len(prefix.split("/")) < 3:  # Max 3 levels deep
                subgenres = scan_folder_structure(item, full_path)
                genres.extend(subgenres)

    return genres

@app.get("/genres")
async def get_genres():
    """Get available genres (folders) including nested structures"""
    genres = []

    # Scan existing folder structure
    if DOWNLOADS_DIR.exists():
        genres = scan_folder_structure(DOWNLOADS_DIR)

    # Add some default genres with examples of nested structure
    default_genres = [
        "Hip Hop",
        "Hip Hop/50 Cent",
        "Hip Hop/G-Unit",
        "Hip Hop/Eminem",
        "Hip Hop/Dr. Dre",
        "Rock",
        "Rock/Classic Rock",
        "Rock/Alternative",
        "Pop",
        "Pop/80s",
        "Pop/90s",
        "Electronic",
        "Electronic/House",
        "Electronic/Techno",
        "Jazz",
        "Classical",
        "Country",
        "R&B",
        "R&B/90s R&B",
        "R&B/Neo Soul"
    ]

    for genre in default_genres:
        if genre not in genres:
            genres.append(genre)

    return {"genres": sorted(genres)}

def scan_audio_files(directory: Path, files: List[Dict] = None) -> List[Dict]:
    """Recursively scan for audio files"""
    if files is None:
        files = []

    if not directory.exists():
        return files

    for item in directory.iterdir():
        if item.is_file() and item.suffix.lower() in ['.mp3', '.wav', '.m4a', '.flac']:
            files.append({
                'name': item.stem,
                'path': str(item.relative_to(DOWNLOADS_DIR)),
                'full_path': str(item),
                'size': item.stat().st_size,
                'modified': item.stat().st_mtime
            })
        elif item.is_dir():
            scan_audio_files(item, files)

    return files

@app.get("/audio-files")
async def get_audio_files():
    """Get list of all downloaded audio files"""
    try:
        files = scan_audio_files(DOWNLOADS_DIR)
        return {"files": sorted(files, key=lambda x: x['modified'], reverse=True)}
    except Exception as e:
        logger.error(f"Error scanning audio files: {e}")
        return {"files": []}

@app.get("/audio/{file_path:path}")
async def serve_audio_file(file_path: str):
    """Serve audio file for playback"""
    try:
        full_path = DOWNLOADS_DIR / file_path
        if not full_path.exists() or not full_path.is_file():
            raise HTTPException(status_code=404, detail="Audio file not found")

        return FileResponse(
            path=str(full_path),
            media_type="audio/mpeg",
            headers={"Accept-Ranges": "bytes"}
        )
    except Exception as e:
        logger.error(f"Error serving audio file: {e}")
        raise HTTPException(status_code=500, detail="Error serving audio file")

@app.post("/cut-audio")
async def cut_audio(request: AudioCutRequest):
    """Cut audio file using FFmpeg"""
    try:
        input_path = DOWNLOADS_DIR / request.file_path
        if not input_path.exists():
            raise HTTPException(status_code=404, detail="Audio file not found")

        # Create temporary output file
        output_name = request.output_name or f"cut_{uuid.uuid4().hex[:8]}.mp3"
        temp_dir = Path(tempfile.gettempdir())
        output_path = temp_dir / output_name

        # Build FFmpeg command
        duration = request.end_time - request.start_time
        cmd = [
            'ffmpeg',
            '-i', str(input_path),
            '-ss', str(request.start_time),
            '-t', str(duration),
            '-c', 'copy',  # Copy without re-encoding for speed
            '-avoid_negative_ts', 'make_zero',
            '-y',  # Overwrite output file
            str(output_path)
        ]

        # Execute FFmpeg command
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            logger.error(f"FFmpeg error: {result.stderr}")
            raise HTTPException(status_code=500, detail=f"FFmpeg error: {result.stderr}")

        if not output_path.exists():
            raise HTTPException(status_code=500, detail="Failed to create output file")

        # Return the file as a download
        def file_generator():
            with open(output_path, 'rb') as f:
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    yield chunk
            # Clean up temp file after sending
            try:
                output_path.unlink()
            except:
                pass

        return StreamingResponse(
            file_generator(),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f"attachment; filename={output_name}",
                "Content-Length": str(output_path.stat().st_size)
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cutting audio: {e}")
        raise HTTPException(status_code=500, detail=f"Error cutting audio: {str(e)}")

@app.get("/api/download-file/{file_path:path}")
async def download_file_to_pc(file_path: str):
    """Download a file to user's PC by file path"""
    try:
        logger.info(f"Download request for file: {file_path}")

        # Construct full path
        full_path = Path(file_path)
        if not full_path.is_absolute():
            full_path = DOWNLOADS_DIR / file_path

        # Check if file exists
        if not full_path.exists() or not full_path.is_file():
            logger.error(f"File not found: {full_path}")
            raise HTTPException(status_code=404, detail="File not found")

        # Extract filename for download
        filename = full_path.name

        # Try to get metadata for a better filename
        try:
            from mutagen.mp3 import MP3
            from mutagen.id3 import ID3NoHeaderError

            audio = MP3(str(full_path))
            artist = str(audio.get('TPE1', [''])[0]) if audio.get('TPE1') else ''
            title = str(audio.get('TIT2', [''])[0]) if audio.get('TIT2') else ''

            if artist and title:
                filename = f"{artist} - {title}.mp3"
                # Clean filename
                filename = "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_', '.')).rstrip()
        except Exception as e:
            logger.warning(f"Could not read metadata: {e}")
            # Use original filename
            pass

        logger.info(f"Serving file: {full_path} as {filename}")

        return FileResponse(
            path=str(full_path),
            media_type="audio/mpeg",
            filename=filename,
            headers={
                "Content-Disposition": f"attachment; filename=\"{filename}\"",
                "Accept-Ranges": "bytes"
            }
        )

    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        raise HTTPException(status_code=500, detail="Error downloading file")

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
    uvicorn.run(app, host="0.0.0.0", port=9000)
