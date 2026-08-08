"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============================================================
// 📸 SMILE FACE CAPTURE - REACT TSX COMPONENT
// ============================================================

interface SessionData {
  success: boolean;
  status?: string;
  createdAt?: string;
  message?: string;
}

interface SendPhotoResponse {
  success: boolean;
  message: string;
}

const SmileCapture: React.FC = () => {
  // ============================================================
  // 🔧 KONFIGURASI
  // ============================================================
  const API_BASE = 'https://smile-capture.workers.dev';

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
  // 🛠️ UTILITY & HELPER FUNCTIONS
  // ============================================================
  const showStatus = useCallback((message: string, type: 'info' | 'success' | 'error') => {
    setStatus({ message, type });
  }, []);

  const updateBadge = useCallback((type: 'waiting' | 'done', label: string) => {
    setBadge({ type, label });
  }, []);

  const disableAllButtons = useCallback(() => {
    setIsCameraReady(false);
  }, []);

  // ============================================================
  // 🔍 CEK SESSION KE SERVER
  // ============================================================
  const checkSession = useCallback(
    async (id: string) => {
      if (!id || id.length !== 8) return;

      try {
        const res = await fetch(`${API_BASE}/check/${id}`);
        const data: SessionData = await res.json();

        if (data.success) {
          if (data.status === 'completed') {
            updateBadge('done', '✅ Selesai');
            showStatus('Session ini sudah selesai. Foto sudah terkirim.', 'info');
            disableAllButtons();
          } else {
            updateBadge('waiting', '⏳ Menunggu');
          }
        } else {
          showStatus('Session tidak ditemukan atau expired.', 'error');
          disableAllButtons();
        }
      } catch (err) {
        console.error('Check session error:', err);
      }
    },
    [disableAllButtons, showStatus, updateBadge]
  );

  // ============================================================
  // 🚀 EFFECTS
  // ============================================================
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathSegments = window.location.pathname.split('/');
      const id = pathSegments[pathSegments.length - 1] || '';

      if (!id || id.length !== 8) {
        setSessionId('❌ Invalid');
        showStatus('Session ID tidak valid!', 'error');
      } else {
        setSessionId(id);
        checkSession(id);
      }
    }
  }, [checkSession, showStatus]);

  // Cleanup camera on unmount
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

      const overlay = document.getElementById('overlay');
      if (overlay) overlay.classList.add('active');

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

    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.remove('active');

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

    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.add('active');

    setCapturedPhoto(null);
    showStatus('Ambil ulang foto. Posisikan wajah di dalam bingkai.', 'info');
    setTimeout(() => setStatus({ message: '', type: '' }), 3000);
  };

  // ============================================================
  // 📤 SEND PHOTO
  // ============================================================
  const sendPhoto = async () => {
    if (!capturedPhoto || isSending || !sessionId) return;

    setIsSending(true);
    showStatus('Mengirim foto...', 'info');

    try {
      const blob = dataURLToBlob(capturedPhoto);
      const formData = new FormData();
      formData.append('photo', blob, 'face.jpg');

      const res = await fetch(`${API_BASE}/capture/${sessionId}`, {
        method: 'POST',
        body: formData,
      });

      const result: SendPhotoResponse = await res.json();

      if (result.success) {
        showStatus('✅ Foto berhasil terkirim! Terima kasih.', 'success');
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

  const dataURLToBlob = (dataURL: string): Blob => {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(parts[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
  };

  // ============================================================
  // 🎨 RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-linear-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] flex justify-center items-center p-4 font-sans">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 max-w-120 w-full shadow-2xl">
        {/* Header */}
        <div className="text-center mb-7">
          <span className="text-6xl block mb-1">📸</span>
          <h1 className="text-white text-3xl font-bold tracking-tight">SMILE</h1>
          <p className="text-white/60 text-sm mt-1">Face Capture &amp; Verification</p>
        </div>

        {/* Session Info */}
        <div className="bg-white/10 rounded-xl p-3 px-4 mb-5 flex flex-wrap justify-between items-center gap-2 border border-white/10">
          <span className="text-white/50 text-xs uppercase tracking-wide">Session ID</span>
          <span className="text-white font-mono text-sm bg-white/10 px-3 py-1 rounded-lg">
            {sessionId || '-'}
          </span>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              badge.type === 'waiting'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-green-500/20 text-green-400'
            }`}
          >
            {badge.label}
          </span>
        </div>

        {/* Camera Wrapper */}
        <div className="relative bg-black/40 rounded-2xl overflow-hidden aspect-4/3 mb-5 border-2 border-white/10">
          <video
            ref={videoRef}
            className="w-full h-full object-cover hidden scale-x-[-1]"
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
            className="flex flex-col items-center justify-center h-full text-white/30 gap-3 p-5"
          >
            <span className="text-7xl">🤳</span>
            <p className="text-sm text-center leading-relaxed">
              Klik tombol di bawah<br />untuk mulai kamera
            </p>
            <span className="text-xs text-white/20">Pastikan izinkan akses kamera</span>
          </div>

          <div
            id="overlay"
            className="absolute inset-0 hidden items-center justify-center pointer-events-none"
          >
            <div className="w-[70%] h-[70%] border-2 border-white/20 rounded-2xl shadow-[0_0_0_4000px_rgba(0,0,0,0.3)] animate-pulse" />
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={startCamera}
            disabled={isCameraReady}
            className="flex-1 py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-linear-to-r from-[#667eea] to-[#764ba2] text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:-translate-y-0.5 min-w-20"
          >
            {isCameraReady ? '✅ Aktif' : '📷 Mulai'}
          </button>

          <button
            onClick={capturePhoto}
            disabled={!isCameraReady || !!capturedPhoto}
            className="flex-1 py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-linear-to-r from-[#34d399] to-[#10b981] text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-0.5 min-w-20"
          >
            📸 Ambil
          </button>

          <button
            onClick={retakePhoto}
            style={{ display: capturedPhoto ? 'flex' : 'none' }}
            className="flex-1 py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-white/10 text-white border border-white/20 hover:bg-white/20 min-w-20"
          >
            🔄 Ulangi
          </button>

          <button
            onClick={sendPhoto}
            disabled={!capturedPhoto || isSending}
            style={{ display: capturedPhoto ? 'flex' : 'none' }}
            className="flex-1 py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-linear-to-r from-[#f87171] to-[#ef4444] text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50 hover:-translate-y-0.5 min-w-20"
          >
            📤 Kirim
          </button>
        </div>

        {/* Status Message */}
        {status.message && (
          <div
            className={`mt-4 py-3 px-4 rounded-xl text-sm text-center animate-fadeIn ${
              status.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : status.type === 'error'
                ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
            }`}
          >
            {status.message}
          </div>
        )}

        {/* Loader */}
        {isSending && (
          <div className="text-center mt-4 py-4">
            <div className="w-10 h-10 border-2 border-white/10 border-t-[#667eea] rounded-full animate-spin mx-auto mb-2" />
            <p className="text-white/40 text-sm">Mengirim foto ke server...</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6 text-white/20 text-[11px] tracking-wide">
          SMILE Face Capture v2.0 • 🔐 Secure
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease;
        }
        .animate-pulse {
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { border-color: rgba(255, 255, 255, 0.2); }
          50% { border-color: rgba(255, 255, 255, 0.6); }
        }
      `}</style>
    </div>
  );
};

export default SmileCapture;