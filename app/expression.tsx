"use client";

import { ParticleButton } from "@/components/ui/particle-button";
import React, { useRef, useState } from "react";
import { MicrophoneIcon } from '@heroicons/react/solid';

const ExpressionAnalysis: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [recording, setRecording] = useState<boolean>(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [report, setReport] = useState<string | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setVideoURL(url);
        // Upload video to backend for emotion analysis
        uploadVideo(blob);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  const uploadVideo = async (videoBlob: Blob) => {
    const formData = new FormData();
    formData.append("video", videoBlob, "recording.webm");
    try {
      const res = await fetch("http://localhost:8000/api/py/expression", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.results_dir) {
        const baseUrl = `http://localhost:8000/static/${data.results_dir}/`;
        setImageUrls([
          `${baseUrl}emotion_trends.png`,
          `${baseUrl}cheating_trends.png`,
        ]);
        setReport(data.report);
      }
    } catch (error) {
      console.error("Error uploading video:", error);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1 className="flex justify-center text-xl">Expression Analysis</h1>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        width={640}
        height={480}
        style={{ background: "#000" }}
      ></video>
      <div style={{ marginTop: "10px" }}>
        {recording ? (
          <button 
            className="bg-gradient-to-r from-red-500 via-purple-500 to-pink-500 p-4 rounded-lg text-white flex justify-center items-center space-x-2"
            onClick={stopRecording}
          >
            <span>Stop Recording</span>
            <MicrophoneIcon className="w-6 h-6" />
          </button>
        ) : (
          <button 
            className="bg-gradient-to-r from-green-500 via-teal-500 to-blue-500 p-4 rounded-lg text-white flex justify-center items-center space-x-2"
            onClick={startRecording}
          >
            <span>Start Recording</span>
            <MicrophoneIcon className="w-6 h-6" />
          </button>
        )}
      </div>
      {videoURL && (
        <div style={{ marginTop: "20px" }}>
          <h3>Recorded Video:</h3>
          <video src={videoURL} controls width={640} height={480} />
        </div>
      )}
      {imageUrls.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3>Generated Analysis Images:</h3>
          {imageUrls.map((url, index) => (
            <img
              key={index}
              src={url}
              alt={`Analysis Image ${index + 1}`}
              className="mt-2 rounded shadow-md"
              style={{ maxWidth: "100%" }}
            />
          ))}
        </div>
      )}
      {report && (
        <div style={{ marginTop: "20px" }}>
          <h3>Analysis Report:</h3>
          <pre className="bg-gray-100 p-10 rounded mt-2">{report}</pre>
        </div>
      )}
    </div>
  );
};

export default ExpressionAnalysis;
