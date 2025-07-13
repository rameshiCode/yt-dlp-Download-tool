import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square, Scissors, Download, Upload, Volume2, VolumeX, SkipBack, SkipForward, Music } from 'lucide-react';

const FFmpegEditor = () => {
  const [audioFiles, setAudioFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [previousVolume, setPreviousVolume] = useState(1);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Local state for input fields to allow free editing
  const [startTimeInput, setStartTimeInput] = useState('0.00');
  const [endTimeInput, setEndTimeInput] = useState('0.00');
  
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

  // Update audio volume when volume state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

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
      setEndTimeInput(formatTimeInput(audio.duration));
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
    setStartTimeInput(formatTimeInput(currentTime));
  };

  const setEndMarker = () => {
    setEndTime(currentTime);
    setEndTimeInput(formatTimeInput(currentTime));
  };

  const toggleMute = () => {
    if (volume > 0) {
      setPreviousVolume(volume);
      setVolume(0);
    } else {
      setVolume(previousVolume);
    }
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas with dark gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0f0f23');
    bgGradient.addColorStop(0.5, '#1a1a2e');
    bgGradient.addColorStop(1, '#16213e');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Create flowing sea wave pattern
    const centerY = height / 2;
    const time = Date.now() * 0.001; // For animation

    // Draw multiple wave layers for depth
    const waveColors = [
      { color: '#00d4ff', alpha: 0.8, frequency: 0.02, amplitude: 40, phase: 0 },
      { color: '#0099cc', alpha: 0.6, frequency: 0.015, amplitude: 30, phase: Math.PI / 3 },
      { color: '#0066aa', alpha: 0.4, frequency: 0.025, amplitude: 25, phase: Math.PI / 2 },
      { color: '#004488', alpha: 0.3, frequency: 0.018, amplitude: 35, phase: Math.PI },
    ];

    waveColors.forEach((wave, layerIndex) => {
      ctx.beginPath();
      ctx.moveTo(0, centerY);

      // Create smooth flowing wave
      for (let x = 0; x <= width; x += 2) {
        const progress = x / width;

        // Multiple sine waves for complex pattern
        const wave1 = Math.sin(x * wave.frequency + time + wave.phase) * wave.amplitude;
        const wave2 = Math.sin(x * wave.frequency * 1.5 + time * 0.7 + wave.phase) * wave.amplitude * 0.5;
        const wave3 = Math.sin(x * wave.frequency * 0.8 + time * 1.2 + wave.phase) * wave.amplitude * 0.3;

        // Combine waves with envelope
        const envelope = Math.sin(progress * Math.PI) * 0.8 + 0.2;
        const y = centerY + (wave1 + wave2 + wave3) * envelope;

        ctx.lineTo(x, y);
      }

      // Create gradient for wave
      const waveGradient = ctx.createLinearGradient(0, centerY - wave.amplitude, 0, centerY + wave.amplitude);
      waveGradient.addColorStop(0, wave.color + Math.round(wave.alpha * 255).toString(16).padStart(2, '0'));
      waveGradient.addColorStop(0.5, wave.color + Math.round(wave.alpha * 180).toString(16).padStart(2, '0'));
      waveGradient.addColorStop(1, wave.color + Math.round(wave.alpha * 100).toString(16).padStart(2, '0'));

      ctx.strokeStyle = waveGradient;
      ctx.lineWidth = 3 - layerIndex * 0.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = wave.color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // Draw current time indicator with glow
    const currentX = (currentTime / duration) * width;
    ctx.strokeStyle = '#ff0080';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ff0080';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(currentX, 0);
    ctx.lineTo(currentX, height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw start/end selection area with neon effect
    const startX = (startTime / duration) * width;
    const endX = (endTime / duration) * width;

    // Selection overlay with gradient
    const selectionGradient = ctx.createLinearGradient(startX, 0, endX, 0);
    selectionGradient.addColorStop(0, 'rgba(0, 255, 128, 0.1)');
    selectionGradient.addColorStop(0.5, 'rgba(0, 255, 128, 0.2)');
    selectionGradient.addColorStop(1, 'rgba(0, 255, 128, 0.1)');
    ctx.fillStyle = selectionGradient;
    ctx.fillRect(startX, 0, endX - startX, height);

    // Selection borders with neon glow
    ctx.strokeStyle = '#00ff80';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00ff80';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  useEffect(() => {
    if (duration > 0) {
      drawWaveform();

      // Animate the waveform
      const animationInterval = setInterval(drawWaveform, 50); // 20 FPS
      return () => clearInterval(animationInterval);
    }
  }, [currentTime, startTime, endTime, duration]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Convert MM.SS format to seconds
  const parseTimeInput = (input) => {
    if (!input) return 0;

    // Handle different formats: "1.22", "0.12", "12", "1:22"
    const str = input.toString().replace(':', '.');

    if (str.includes('.')) {
      const parts = str.split('.');
      const minutes = parseInt(parts[0]) || 0;
      const seconds = parseInt(parts[1]) || 0;
      return minutes * 60 + seconds;
    } else {
      // Just seconds
      return parseFloat(str) || 0;
    }
  };

  // Convert seconds to MM.SS format for input display
  const formatTimeInput = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}.${seconds.toString().padStart(2, '0')}`;
  };

  // Handle start time input changes
  const handleStartTimeChange = (value) => {
    setStartTimeInput(value);
    const parsedTime = parseTimeInput(value);
    setStartTime(parsedTime);
  };

  // Handle end time input changes
  const handleEndTimeChange = (value) => {
    setEndTimeInput(value);
    const parsedTime = parseTimeInput(value);
    setEndTime(parsedTime);
  };

  // Handle input blur to format the display
  const handleStartTimeBlur = () => {
    setStartTimeInput(formatTimeInput(startTime));
  };

  const handleEndTimeBlur = () => {
    setEndTimeInput(formatTimeInput(endTime));
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
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-4 rounded-lg">
              <canvas
                ref={canvasRef}
                width={800}
                height={200}
                className="w-full rounded-lg cursor-pointer shadow-inner"
                onClick={handleSeek}
              />
              <div className="mt-2 text-center text-sm text-gray-300">
                🎵 Click anywhere on the waveform to jump to that position
              </div>
            </div>
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

            {/* Volume Control */}
            <div className="flex items-center justify-center space-x-4 bg-gray-50 rounded-lg p-4">
              <button
                onClick={toggleMute}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                title={volume > 0 ? 'Mute' : 'Unmute'}
              >
                {volume > 0 ? (
                  <Volume2 className="h-5 w-5 text-gray-600" />
                ) : (
                  <VolumeX className="h-5 w-5 text-red-500" />
                )}
              </button>

              <div className="flex items-center space-x-3">
                <span className="text-xs text-gray-500">0%</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => {
                    const newVolume = parseFloat(e.target.value);
                    setVolume(newVolume);
                    if (newVolume > 0) {
                      setPreviousVolume(newVolume);
                    }
                  }}
                  className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume * 100}%, #e5e7eb ${volume * 100}%, #e5e7eb 100%)`
                  }}
                />
                <span className="text-xs text-gray-500">100%</span>
              </div>

              <div className="flex items-center space-x-2">
                <Volume2 className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-mono text-gray-700 w-12 text-center">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>

            {/* Cutting Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Start Time <span className="text-xs text-gray-500">(M.SS format)</span>
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={startTimeInput}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    onBlur={handleStartTimeBlur}
                    placeholder="0.00"
                    className="input-field flex-1 font-mono"
                  />
                  <button
                    onClick={setStartMarker}
                    className="btn-secondary whitespace-nowrap"
                  >
                    Set Start
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Examples: 0.12 = 12s, 1.22 = 1m 22s
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  End Time <span className="text-xs text-gray-500">(M.SS format)</span>
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={endTimeInput}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                    onBlur={handleEndTimeBlur}
                    placeholder="1.00"
                    className="input-field flex-1 font-mono"
                  />
                  <button
                    onClick={setEndMarker}
                    className="btn-secondary whitespace-nowrap"
                  >
                    Set End
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Examples: 2.30 = 2m 30s, 0.45 = 45s
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Duration</label>
                <p className="input-field bg-gray-50 text-center font-mono">
                  {formatTime(endTime - startTime)}
                </p>
                <p className="text-xs text-gray-500 text-center">
                  {formatTimeInput(endTime - startTime)} format
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
