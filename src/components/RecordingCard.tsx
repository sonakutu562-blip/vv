import { useRef, useState } from 'react';
import { Pause, Play, Trash2 } from 'lucide-react';
import { Recording } from '../types';

interface RecordingCardProps {
  recording: Recording;
  audioUrl: string;
  onDelete: (id: string, storagePath: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RecordingCard({ recording, audioUrl, onDelete }: RecordingCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(isNaN(pct) ? 0 : pct);
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * audioRef.current.duration;
  };

  const handleDelete = async () => {
    setDeleting(true);
    onDelete(recording.id, recording.storage_path);
  };

  return (
    <div className="fade-in bg-[#141414] border border-[#252525] rounded-2xl p-4 hover:border-[#353535] transition-colors">
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          setCurrentTime(0);
        }}
        onTimeUpdate={handleTimeUpdate}
      />

      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1 mr-3">
          <h3 className="text-white font-medium text-sm truncate">{recording.title}</h3>
          <p className="text-[#555] text-xs mt-0.5">{formatDate(recording.created_at)}</p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-[#3a3a3a] hover:text-red-500 transition-colors p-1 flex-shrink-0 disabled:opacity-40"
          aria-label="Delete recording"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-[#22c55e] hover:bg-[#16a34a] active:scale-95 flex items-center justify-center transition-all flex-shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={14} className="text-black" />
          ) : (
            <Play size={14} className="text-black ml-0.5" />
          )}
        </button>

        <div className="flex-1">
          <div
            className="h-1.5 bg-[#252525] rounded-full cursor-pointer overflow-hidden"
            onClick={handleProgressClick}
            role="slider"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-[#22c55e] rounded-full"
              style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
            />
          </div>
        </div>

        <span className="text-[#555] text-xs font-mono flex-shrink-0 tabular-nums">
          {isPlaying ? formatTime(currentTime) : formatTime(recording.duration_seconds)}
        </span>
      </div>
    </div>
  );
}
