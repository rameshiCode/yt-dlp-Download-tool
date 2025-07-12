import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square, Scissors, Download, Upload, Volume2, SkipBack, SkipForward, Music } from 'lucide-react';

const FFmpegEditor = () => {
  const [audioFiles, setAudioFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const audioRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    loadAudioFiles();
  }, []);

  useEffect(() => {
    if (selectedFile && audioRef.current) {
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('ended', handleEnded);
      
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
          audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
          audioRef.current.removeEventListener('ended', handleEnded);
        }
      };
    }
  }, [selectedFile]);

  const loadAudioFiles = async () => {
    try {
      const response = await fetch('http://localhost:9000/audio-files');
      const data = await response.json();
      setAudioFiles(data.files || []);
    } catch (error) {
      console.error('Failed to load audio files:', error);
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) {
      setDuration(audio.duration);
      setEndTime(audio.duration);
      drawWaveform();
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (audio && canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / canvas.width;
      const newTime = percentage * duration;
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const setStartMarker = () => {
    setStartTime(currentTime);
  };

  const setEndMarker = () => {
    setEndTime(currentTime);
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);

    // Draw waveform placeholder (simplified visualization)
    ctx.fillStyle = '#3b82f6';
    for (let i = 0; i < width; i += 4) {
      const amplitude = Math.random() * height * 0.8;
      ctx.fillRect(i, (height - amplitude) / 2, 2, amplitude);
    }

    // Draw current time indicator
    const currentX = (currentTime / duration) * width;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentX, 0);
    ctx.lineTo(currentX, height);
    ctx.stroke();

    // Draw start/end markers
    const startX = (startTime / duration) * width;
    const endX = (endTime / duration) * width;
    
    ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
    ctx.fillRect(startX, 0, endX - startX, height);
    
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();
  };

  useEffect(() => {
    if (duration > 0) {
      drawWaveform();
    }
  }, [currentTime, startTime, endTime, duration]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCutAudio = async () => {
    if (!selectedFile || startTime >= endTime) {
      alert('Please select a valid time range');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('http://localhost:9000/cut-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_path: selectedFile.path,
          start_time: startTime,
          end_time: endTime,
          output_name: `${selectedFile.name}_cut_${Date.now()}.mp3`
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedFile.name}_cut.mp3`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        alert('Audio cut successfully!');
      } else {
        throw new Error('Failed to cut audio');
      }
    } catch (error) {
      console.error('Error cutting audio:', error);
      alert('Failed to cut audio: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex p-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl shadow-lg mb-6">
          <Scissors className="h-12 w-12 text-white" />
        </div>
        <h2 className="text-4xl font-bold gradient-text mb-4">Audio Editor & Cutter</h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Edit your downloaded music to create ringtones, soundboards, and custom clips
        </p>
      </div>

      {/* File Selection */}
      <div className="card max-w-4xl mx-auto">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">📁 Select Audio File</h3>
        
        {audioFiles.length === 0 ? (
          <div className="text-center py-8">
            <Music className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600">No audio files found. Download some music first!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {audioFiles.map((file, index) => (
              <div
                key={index}
                onClick={() => setSelectedFile(file)}
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                  selectedFile?.path === file.path
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Music className="h-8 w-8 text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-sm text-gray-500 truncate">{file.path}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audio Player & Editor */}
      {selectedFile && (
        <div className="card max-w-6xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">🎵 Audio Player & Editor</h3>
          
          {/* Audio Element */}
          <audio
            ref={audioRef}
            src={`http://localhost:9000/audio/${encodeURIComponent(selectedFile.path)}`}
            onVolumeChange={(e) => setVolume(e.target.volume)}
          />

          {/* Waveform Display */}
          <div className="mb-6">
            <canvas
              ref={canvasRef}
              width={800}
              height={200}
              className="w-full border border-gray-300 rounded-lg cursor-pointer"
              onClick={handleSeek}
            />
          </div>

          {/* Controls */}
          <div className="space-y-6">
            {/* Playback Controls */}
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Math.max(0, currentTime - 10);
                  }
                }}
                className="p-3 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors"
              >
                <SkipBack className="h-5 w-5" />
              </button>
              
              <button
                onClick={togglePlayPause}
                className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>
              
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Math.min(duration, currentTime + 10);
                  }
                }}
                className="p-3 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors"
              >
                <SkipForward className="h-5 w-5" />
              </button>
            </div>

            {/* Time Display */}
            <div className="text-center">
              <p className="text-lg font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </p>
            </div>

            {/* Cutting Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Start Time</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={startTime.toFixed(1)}
                    onChange={(e) => setStartTime(parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0"
                    max={duration}
                    className="input-field flex-1"
                  />
                  <button
                    onClick={setStartMarker}
                    className="btn-secondary whitespace-nowrap"
                  >
                    Set Start
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">End Time</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={endTime.toFixed(1)}
                    onChange={(e) => setEndTime(parseFloat(e.target.value) || duration)}
                    step="0.1"
                    min="0"
                    max={duration}
                    className="input-field flex-1"
                  />
                  <button
                    onClick={setEndMarker}
                    className="btn-secondary whitespace-nowrap"
                  >
                    Set End
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Duration</label>
                <p className="input-field bg-gray-50 text-center">
                  {formatTime(endTime - startTime)}
                </p>
              </div>
            </div>

            {/* Cut Button */}
            <div className="text-center">
              <button
                onClick={handleCutAudio}
                disabled={isProcessing || startTime >= endTime}
                className={`btn-primary text-xl py-4 px-8 ${
                  isProcessing || startTime >= endTime ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Scissors className="h-6 w-6 mr-2" />
                {isProcessing ? '✂️ Cutting Audio...' : '✂️ Cut & Download'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FFmpegEditor;
