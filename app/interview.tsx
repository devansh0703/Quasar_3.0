"use client";

import { useState, useEffect } from "react";

/**
 * Note: This Interview component expects that you have created the following API endpoints:
 * 
 * POST /api/record/start 
 *   - Starts recording using SoX and returns { message: "Recording started" }.
 * 
 * POST /api/record/stop 
 *   - Stops recording and returns { message: "Recording stopped", filePath: string }.
 * 
 * POST /api/transcribe 
 *   - Expects { filePath } in the JSON body and returns { transcript: string }.
 * 
 * POST /api/interview/question 
 *   - Expects { jobDescription, history, questionCount } in the JSON body and returns { question: string }.
 * 
 * The server endpoints must handle CORS and use your hardcoded API keys for OpenRouter and AssemblyAI.
 */

export default function Interview() {
  const [duration, setDuration] = useState<number>(0);
  const [question, setQuestion] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [history, setHistory] = useState<Array<{ question: string; answer: string }>>([]);
  const [questionCount, setQuestionCount] = useState<number>(1);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isInterviewStarted, setIsInterviewStarted] = useState<boolean>(false);
  const [interviewEndTime, setInterviewEndTime] = useState<number>(0);

  // Update timer every second
  useEffect(() => {
    let timer: NodeJS.Timer;
    if (isInterviewStarted && duration > 0) {
      timer = setInterval(() => {
        const remaining = interviewEndTime - Date.now();
        setTimeRemaining(Math.max(0, Math.floor(remaining / 1000)));
        if (remaining <= 10000) {
          clearInterval(timer);
          endInterview();
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isInterviewStarted, interviewEndTime, duration]);

  async function startInterview() {
    if (duration <= 0) return;
    setIsInterviewStarted(true);
    const endTime = Date.now() + duration * 60000;
    setInterviewEndTime(endTime);
    await generateNextQuestion();
  }

  async function generateNextQuestion() {
    try {
      const res = await fetch("/api/interview/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription:
            "Looking for a Full stack with strong problem-solving skills and experience",
          history,
          questionCount,
        }),
      });
      const data = await res.json();
      setQuestion(data.question);
    } catch (error) {
      console.error("Error generating question", error);
    }
  }

  async function handleStartRecording() {
    try {
      await fetch("/api/record/start", { method: "POST" });
      console.log("Recording started");
    } catch (err) {
      console.error(err);
    }
  }

  async function handleStopRecording() {
    try {
      const res = await fetch("/api/record/stop", { method: "POST" });
      const data = await res.json();
      const filePath = data.filePath;
      const transRes = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });
      const transData = await transRes.json();
      setTranscript(transData.transcript);
      setHistory((prev) => [...prev, { question, answer: transData.transcript }]);
      setQuestionCount((prev) => prev + 1);
      if (Date.now() < interviewEndTime - 10000) {
        await generateNextQuestion();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function endInterview() {
    alert("Interview ended. Check the console for history.");
    console.log("Interview History:", history);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      {!isInterviewStarted ? (
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold mb-4">Interview Setup</h1>
          <label className="block mb-4">
            Interview Duration (minutes):
            <input
              type="number"
              className="border p-2 mt-2 w-full"
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value))}
            />
          </label>
          <button onClick={startInterview} className="bg-blue-500 text-white py-2 px-4 rounded">
            Start Interview
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold mb-4">Interview in Progress</h1>
          <p>Time Remaining: {timeRemaining} seconds</p>
          <div className="my-4">
            <h2 className="text-xl">
              Question {questionCount}: {question}
            </h2>
          </div>
          <div className="flex space-x-4">
            <button onClick={handleStartRecording} className="bg-green-500 text-white py-2 px-4 rounded">
              Start Recording
            </button>
            <button onClick={handleStopRecording} className="bg-red-500 text-white py-2 px-4 rounded">
              Stop Recording
            </button>
          </div>
          {transcript && (
            <div className="mt-4">
              <h3 className="text-lg">Transcribed Answer:</h3>
              <p>{transcript}</p>
            </div>
          )}
          <div className="mt-4">
            <h3 className="text-lg font-semibold">Interview History</h3>
            {history.map((qa, idx) => (
              <div key={idx} className="border p-2 my-2">
                <p>
                  <strong>Q:</strong> {qa.question}
                </p>
                <p>
                  <strong>A:</strong> {qa.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

