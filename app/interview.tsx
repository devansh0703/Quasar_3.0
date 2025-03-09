"use client";

import { useState, useEffect } from "react";

export default function Interview() {
  const [duration, setDuration] = useState<number>(0);
  const [question, setQuestion] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [history, setHistory] = useState<Array<{ question: string; answer: string }>>([]);
  const [questionCount, setQuestionCount] = useState<number>(1);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isInterviewStarted, setIsInterviewStarted] = useState<boolean>(false);
  const [interviewEndTime, setInterviewEndTime] = useState<number>(0);

  // New states for final evaluation
  const [candidateFeedback, setCandidateFeedback] = useState<string>("");
  const [moderatorEvaluation, setModeratorEvaluation] = useState<any>(null);

  // Update timer every second; stop when timeRemaining hits 0
  useEffect(() => {
    let timer: NodeJS.Timer;
    if (isInterviewStarted && duration > 0) {
      timer = setInterval(() => {
        const remaining = interviewEndTime - Date.now();
        const seconds = Math.max(0, Math.floor(remaining / 1000));
        setTimeRemaining(seconds);
        if (seconds <= 0) {
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
          jobDescription: "Looking for a Full stack with strong problem-solving skills and experience",
          history,
          questionCount,
        }),
      });
      const data = await res.json();
      if (data.question) {
        setQuestion(data.question);
      } else {
        console.error("No question returned or error:", data);
      }
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

      // Add Q&A to history
      setHistory((prev) => [...prev, { question, answer: transData.transcript }]);
      setQuestionCount((prev) => prev + 1);

      // If time remains (more than 10 sec left), generate the next question
      if (Date.now() < interviewEndTime - 10000) {
        await generateNextQuestion();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function finalizeInterview() {
    try {
      const res = await fetch("/api/interview/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate", // triggers the evaluation logic on the server
          jobDescription: "Looking for a Full stack with strong problem-solving skills and experience",
          history, // entire interview Q&A
          questionCount, // can be ignored by evaluation
        }),
      });
      const data = await res.json();

      // Store final results in state
      setCandidateFeedback(data.candidateFeedback || "");
      setModeratorEvaluation(data.moderatorEvaluation || null);

      console.log("Candidate Feedback:", data.candidateFeedback);
      console.log("Moderator Evaluation:", data.moderatorEvaluation);
    } catch (error) {
      console.error("Error during final evaluation", error);
    }
  }

  async function endInterview() {
    alert("Interview ended. Finalizing evaluation...");
    console.log("Interview History:", history);
    await finalizeInterview();
    // Mark interview as ended
    setIsInterviewStarted(false);
    setQuestion("Interview Complete");
    setTranscript("");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-gray-100">
      {!isInterviewStarted ? (
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-white">Interview Setup</h1>
          <label className="block mb-4">
            Interview Duration (minutes):
            <input
              type="number"
              className="border p-2 mt-2 w-full bg-gray-800 border-gray-700 text-gray-300"
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value))}
            />
          </label>
          <button 
            onClick={startInterview}
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
          >
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
            <button
              onClick={handleStartRecording}
              className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition"
            >
              Start Recording
            </button>
            <button
              onClick={handleStopRecording}
              className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition"
            >
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
              <div key={idx} className="border p-2 my-2 border-gray-700 rounded bg-gray-800">
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

      {/* AFTER the interview ends, we can show the final results if they exist */}
      {!isInterviewStarted && candidateFeedback && (
        <div className="w-full max-w-md mt-6 p-4 border border-gray-700 rounded bg-gray-800">
          <h2 className="text-xl font-bold mb-2">Final Candidate Feedback</h2>
          <p className="mb-4 whitespace-pre-line">{candidateFeedback}</p>
          {moderatorEvaluation && (
            <div>
              <h2 className="text-xl font-bold mb-2">Moderator Evaluation</h2>
              <pre className="bg-gray-700 p-2 rounded text-gray-300">
                {JSON.stringify(moderatorEvaluation, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

