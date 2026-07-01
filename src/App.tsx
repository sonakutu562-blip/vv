import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Check, X, AlertCircle } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useRecorder } from './hooks/useRecorder';
import WaveformCanvas from './components/WaveformCanvas';
import RecordingCard from './components/RecordingCard';
import { Recording } from './types';

type RecorderPhase = 'idle' | 'requesting' | 'recording' | 'naming' | 'saving';

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export default function App() {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(true);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingDuration, setPendingDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [appError, setAppError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const { startRecording, stopRecording, isRecording, duration, waveformData, error: recorderError, setError: setRecorderError } = useRecorder({
    onStop: (blob, dur) => {
      setPendingBlob(blob);
      setPendingDuration(dur);
      const now = new Date();
      setTitle(
        `Recording ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
      );
      setPhase('naming');
    },
  });

  useEffect(() => {
    fetchRecordings();
  }, []);

  useEffect(() => {
    if (phase === 'naming') {
      setTimeout(() => titleInputRef.current?.select(), 50);
    }
  }, [phase]);

  const fetchRecordings = async () => {
    setLoadingRecordings(true);
    const { data, error } = await supabase
      .from('recordings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setAppError(error.message);
    } else {
      setRecordings(data ?? []);
    }
    setLoadingRecordings(false);
  };

  const handleStartRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setAppError('Your browser does not support audio recording.');
      return;
    }
    setPhase('requesting');
    setAppError(null);
    try {
      await startRecording();
      setPhase('recording');
    } catch {
      setPhase('idle');
      setAppError('Microphone access was denied. Please allow microphone access and try again.');
    }
  };

  const handleStopRecording = () => {
    stopRecording();
    // phase transitions to 'naming' via the onStop callback
  };

  const handleSaveRecording = async () => {
    if (!pendingBlob) return;
    setPhase('saving');

    const filename = `${Date.now()}.webm`;

    const { error: uploadError } = await supabase.storage
      .from('voice-recordings')
      .upload(filename, pendingBlob, { contentType: 'audio/webm' });

    if (uploadError) {
      setAppError(uploadError.message);
      setPhase('naming');
      return;
    }

    const { data: inserted, error: dbError } = await supabase
      .from('recordings')
      .insert({
        title: title.trim() || 'Untitled Recording',
        duration_seconds: pendingDuration,
        storage_path: filename,
      })
      .select()
      .single();

    if (dbError) {
      setAppError(dbError.message);
      setPhase('naming');
      return;
    }

    setRecordings((prev) => [inserted, ...prev]);
    setPendingBlob(null);
    setTitle('');
    setPhase('idle');
  };

  const handleDiscard = () => {
    setPendingBlob(null);
    setTitle('');
    setPhase('idle');
  };

  const handleDelete = async (id: string, storagePath: string) => {
    await supabase.storage.from('voice-recordings').remove([storagePath]);
    const { error } = await supabase.from('recordings').delete().eq('id', id);
    if (!error) {
      setRecordings((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const getAudioUrl = (path: string) => {
    const { data } = supabase.storage.from('voice-recordings').getPublicUrl(path);
    return data.publicUrl;
  };

  const displayError = appError || recorderError;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[#181818] px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#22c55e] to-[#16a34a] flex items-center justify-center shadow-lg shadow-green-900/30">
            <Mic size={15} className="text-black" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-base tracking-tight leading-none">
              VocalVoice
            </h1>
            <p className="text-[#444] text-xs mt-0.5">Voice memos</p>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10">
        {/* Error banner */}
        {displayError && (
          <div className="mb-6 flex items-start gap-3 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm flex-1">{displayError}</p>
            <button
              onClick={() => {
                setAppError(null);
                setRecorderError(null);
              }}
              className="text-red-500 hover:text-red-300 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Recorder section */}
        <div className="flex flex-col items-center mb-12">
          {/* Idle / Requesting */}
          {(phase === 'idle' || phase === 'requesting') && (
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                <button
                  onClick={handleStartRecording}
                  disabled={phase === 'requesting'}
                  className="relative w-24 h-24 rounded-full bg-[#141414] border-2 border-[#252525] hover:border-[#22c55e] hover:bg-[#1a1a1a] active:scale-95 transition-all duration-200 flex items-center justify-center group disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label="Start recording"
                >
                  <Mic
                    size={32}
                    className="text-[#444] group-hover:text-[#22c55e] transition-colors"
                  />
                </button>
              </div>
              <p className="text-[#555] text-sm">
                {phase === 'requesting' ? 'Requesting microphone...' : 'Tap to record'}
              </p>
            </div>
          )}

          {/* Recording */}
          {phase === 'recording' && isRecording && (
            <div className="flex flex-col items-center gap-6 w-full max-w-sm">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-red-500/20 pulse-ring" />
                <button
                  onClick={handleStopRecording}
                  className="relative w-24 h-24 rounded-full bg-[#1a0a0a] border-2 border-red-500/60 hover:border-red-500 active:scale-95 transition-all duration-200 flex items-center justify-center"
                  aria-label="Stop recording"
                >
                  <Square size={26} className="text-red-500 fill-red-500" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 font-mono text-lg tabular-nums">
                  {formatDuration(duration)}
                </span>
              </div>

              <div className="w-full bg-[#141414] rounded-xl p-4">
                <WaveformCanvas data={waveformData} color="#22c55e" height={64} />
              </div>
            </div>
          )}

          {/* Naming */}
          {(phase === 'naming' || phase === 'saving') && (
            <div className="fade-in w-full max-w-sm">
              <div className="bg-[#141414] border border-[#252525] rounded-2xl p-6">
                <h2 className="text-white font-semibold text-base mb-1">Save recording</h2>
                <p className="text-[#555] text-xs mb-4">
                  {formatDuration(pendingDuration)} recorded
                </p>

                <label className="block text-[#888] text-xs font-medium mb-1.5">
                  Recording name
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRecording();
                    if (e.key === 'Escape') handleDiscard();
                  }}
                  disabled={phase === 'saving'}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e] transition-colors disabled:opacity-50"
                  placeholder="Untitled Recording"
                />

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleDiscard}
                    disabled={phase === 'saving'}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#2a2a2a] text-[#888] text-sm hover:text-white hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
                  >
                    <X size={14} />
                    Discard
                  </button>
                  <button
                    onClick={handleSaveRecording}
                    disabled={phase === 'saving'}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black text-sm font-medium active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {phase === 'saving' ? (
                      <>
                        <span className="w-3 h-3 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recordings list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#666] text-xs font-semibold uppercase tracking-widest">
              Recordings
            </h2>
            {recordings.length > 0 && (
              <span className="text-[#444] text-xs">{recordings.length}</span>
            )}
          </div>

          {loadingRecordings ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 rounded-full border-2 border-[#252525] border-t-[#22c55e] animate-spin" />
            </div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-[#141414] border border-[#1e1e1e] flex items-center justify-center mx-auto mb-4">
                <Mic size={24} className="text-[#333]" />
              </div>
              <p className="text-[#444] text-sm">No recordings yet</p>
              <p className="text-[#333] text-xs mt-1">Tap the button above to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recordings.map((r) => (
                <RecordingCard
                  key={r.id}
                  recording={r}
                  audioUrl={getAudioUrl(r.storage_path)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
