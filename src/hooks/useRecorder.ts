import { useEffect, useRef, useState } from 'react';

interface UseRecorderOptions {
  onStop: (blob: Blob, duration: number) => void;
}

export function useRecorder({ onStop }: UseRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(40).fill(0));
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const startRecording = async () => {
    setError(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyserRef.current = analyser;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const dur = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
      onStop(blob, dur);
      cleanup();
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;
    startTimeRef.current = Date.now();
    setIsRecording(true);
    setDuration(0);

    intervalRef.current = setInterval(() => {
      setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    const bars = 40;
    const updateWaveform = () => {
      if (!analyserRef.current) return;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);
      const step = Math.floor(bufferLength / bars);
      const barData = Array.from({ length: bars }, (_, i) => {
        const slice = dataArray.slice(i * step, (i + 1) * step);
        const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
        return avg / 255;
      });
      setWaveformData(barData);
      animFrameRef.current = requestAnimationFrame(updateWaveform);
    };
    updateWaveform();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    setIsRecording(false);
  };

  const cleanup = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => null);
    analyserRef.current = null;
    setWaveformData(new Array(40).fill(0));
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop();
      }
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { startRecording, stopRecording, isRecording, duration, waveformData, error, setError };
}
