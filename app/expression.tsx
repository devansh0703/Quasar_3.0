"use client";

import React, { useRef, useState } from "react";

const ExpressionAnalysis: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [recording, setRecording] = useState<boolean>(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

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
        // Upload video to backend for emotion/expression analysis
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
      setAnalysisResult(data);
    } catch (error) {
      console.error("Error uploading video:", error);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Expression Analysis</h1>
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
          <button onClick={stopRecording}>Stop Recording</button>
        ) : (
          <button onClick={startRecording}>Start Recording</button>
        )}
      </div>
      {videoURL && (
        <div style={{ marginTop: "20px" }}>
          <h3>Recorded Video:</h3>
          <video src={videoURL} controls width={640} height={480} />
        </div>
      )}
      {analysisResult && (
        <div style={{ marginTop: "20px" }}>
          <h3>Analysis Result:</h3>
          <pre style={{ background: "#f0f0f0", padding: "10px" }}>
            {JSON.stringify(analysisResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ExpressionAnalysis;
