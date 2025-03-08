// int.tsx
"use client";
import React, { useState, useEffect, useRef } from "react";

const Interview: React.FC = () => {
  // Environment variables (ensure these are defined in your .env file with NEXT_PUBLIC_ prefix)
  const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  const openaiBaseURL = process.env.NEXT_PUBLIC_OPENAI_API_BASE || "https://openrouter.ai/api/v1";
  const openaiModel = process.env.NEXT_PUBLIC_OPENROUTER_MODEL || "gpt-3.5-turbo";
  const assemblyApiKey = process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY;

  // Static Job Description & Resume
  const jobDescription =
    "Looking for a Cyber Security Analyst with strong problem-solving skills and experience in threat detection and incident response.";
  const parsedResume = {
    name: "Sample Candidate",
    skills: ["Cyber Security", "Threat Detection", "Incident Response", "Python", "SQL"],
  };

  // State variables
  const [duration, setDuration] = useState<number>(0);
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [currentAnswer, setCurrentAnswer] = useState<string>("");
  const [history, setHistory] = useState<Array<{ question: string; answer: string }>>([]);
  const [questionCount, setQuestionCount] = useState<number>(1);
  const [feedback, setFeedback] = useState<string>("");
  const [score, setScore] = useState<string>("");

  // For audio recording using MediaRecorder
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Timer variables
  const interviewEndTimeRef = useRef<number>(0);

  // Function to call OpenRouter (OpenAI) API with added error handling
  async function askLLM(messages: { role: string; content: string }[]): Promise<string> {
    try {
      const res = await fetch(`${openaiBaseURL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: openaiModel,
          messages: messages,
          temperature: 0,
        }),
      });
      const data = await res.json();
      if (!data.choices) {
        console.error("No choices returned from API:", data);
        return "Error: Could not generate question.";
      }
      return data.choices[0]?.message?.content || "Error: Could not generate question.";
    } catch (error) {
      console.error("❌ OpenAI API Error:", error);
      return "Error: Could not generate question.";
    }
  }

  // Function to transcribe audio using AssemblyAI
  async function transcribeAudio(blob: Blob): Promise<string> {
    // Upload audio file to AssemblyAI
    const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        authorization: assemblyApiKey || "",
      },
      body: blob,
    });
    const uploadData = await uploadResponse.json();
    const audioUrl = uploadData.upload_url;

    // Request transcription
    const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        authorization: assemblyApiKey || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: audioUrl,
      }),
    });
    const transcriptData = await transcriptResponse.json();
    const transcriptId = transcriptData.id;

    // Poll for transcription result
    let transcriptResult = transcriptData;
    while (transcriptResult.status !== "completed" && transcriptResult.status !== "error") {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const pollingResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          method: "GET",
          headers: {
            authorization: assemblyApiKey || "",
          },
        }
      );
      transcriptResult = await pollingResponse.json();
    }

    if (transcriptResult.status === "completed") {
      return transcriptResult.text;
    } else {
      return "Error transcribing audio.";
    }
  }

  // Function to generate a new interview question
  async function generateNextQuestion() {
    // Build the prompt exactly as in your original JS
    let prompt = [
      {
        role: "system",
        content: `You are a professional interviewer conducting a technical interview for a job position.
        
Job Description: ${jobDescription}
        
Generate ONE concise, relevant technical question for the candidate. DO NOT include any simulated 
candidate responses or additional context. The question should be direct and ready to be read to 
the interviewee. Just provide the question text by itself.`,
      },
      {
        role: "user",
        content: `This is question #${questionCount}. Generate a relevant technical question based on the job description.`,
      },
    ];

    if (history.length > 0) {
      const previousQA = history
        .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
        .join("\n\n");
      prompt[0].content += `\n\nPrevious questions and answers:\n${previousQA}`;
    }

    const question = await askLLM(prompt);
    setCurrentQuestion(question);
  }

  // Function to start audio recording using MediaRecorder
  async function recordAnswer() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
    }
  }

  // Function to stop recording and process the audio
  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(recordedChunksRef.current, { type: "audio/wav" });
      processAudio(blob);
    }
  }

  // Process the recorded audio: transcribe and store Q&A
  async function processAudio(blob: Blob) {
    const transcript = await transcribeAudio(blob);
    setCurrentAnswer(transcript);
    setHistory((prev) => [...prev, { question: currentQuestion, answer: transcript }]);
    setQuestionCount((prev) => prev + 1);

    // If there is still sufficient time, generate the next question
    if (Date.now() < interviewEndTimeRef.current - 10000) {
      generateNextQuestion();
    }
  }

  // Function to end the interview and generate final evaluation and score
  async function endInterview() {
    // Final evaluation feedback prompt (DO NOT CHANGE)
    const feedbackPrompt = [
      { role: "system", content: "You are an AI interview evaluator." },
      {
        role: "user",
        content: `Analyze the entire interview and provide structured feedback in this format:\n
          ### Final Evaluation:
          - (Summary of candidate's performance)\n
          ### Strengths:
          - (Candidate's strong points)\n
          ### Areas for Improvement:
          - (Weaknesses & suggestions for improvement)\n
          ### SWOT Analysis:
          - **Strengths:** (List)\n
          - **Weaknesses:** (List)\n
          - **Opportunities:** (Ways for growth)\n
          - **Threats:** (Potential challenges)\n
          
          Job Description: ${jobDescription}
          
          Interview Transcript:\n${history
            .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
            .join("\n\n")}`,
      },
    ];
    const feedbackText = await askLLM(feedbackPrompt);
    setFeedback(feedbackText);

    // Final interview score prompt (DO NOT CHANGE)
    const scorePrompt = [
      { role: "system", content: "You are an AI providing structured evaluation." },
      {
        role: "user",
        content: `Analyze the interview and provide a JSON object with these fields:\n
          {
            "score": (integer from 0 to 100),
            "reason": "(brief explanation)",
            "confidence": (integer from 0 to 100),
            "decision": "(PASS or FAIL)"
          }
          Output only valid JSON. No extra text.\n
          
          Job Description: ${jobDescription}
          
          Interview Transcript:\n${history
            .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
            .join("\n\n")}`,
      },
    ];
    const scoreText = await askLLM(scorePrompt);
    setScore(scoreText);
  }

  // Start the interview process
  function startInterview() {
    if (duration > 0) {
      setIsInterviewStarted(true);
      interviewEndTimeRef.current = Date.now() + duration * 60000;
      // Immediately generate the first question
      generateNextQuestion();
    }
  }

  // Update timer every second and end interview if time is almost over
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isInterviewStarted && duration > 0) {
      timer = setInterval(() => {
        const remaining = interviewEndTimeRef.current - Date.now();
        setTimeRemaining(remaining);
        if (remaining <= 10000) {
          clearInterval(timer);
          endInterview();
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isInterviewStarted, duration]);

  return (
    <div style={{ padding: "1rem" }}>
      {!isInterviewStarted ? (
        <div>
          <h2>🚀 AI Interview System</h2>
          <label>
            Interview Duration (minutes):
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value))}
              style={{ marginLeft: "0.5rem" }}
            />
          </label>
          <button onClick={startInterview} style={{ marginLeft: "1rem" }}>
            Start Interview
          </button>
        </div>
      ) : (
        <div>
          <h2>Interview in Progress</h2>
          <p>
            Time Remaining: {Math.max(0, Math.floor(timeRemaining / 1000))} seconds
          </p>
          <div style={{ marginTop: "1rem", marginBottom: "1rem" }}>
            <h3>
              Question {questionCount}: {currentQuestion}
            </h3>
            <div>
              <button onClick={recordAnswer} disabled={recording}>
                Start Recording
              </button>
              <button onClick={stopRecording} disabled={!recording} style={{ marginLeft: "1rem" }}>
                Stop Recording
              </button>
            </div>
          </div>
          {currentAnswer && (
            <div>
              <h4>Transcribed Answer:</h4>
              <p>{currentAnswer}</p>
            </div>
          )}
          <div style={{ marginTop: "2rem" }}>
            <h4>Interview History</h4>
            {history.map((item, index) => (
              <div key={index} style={{ marginBottom: "1rem" }}>
                <p>
                  <strong>Q:</strong> {item.question}
                </p>
                <p>
                  <strong>A:</strong> {item.answer}
                </p>
              </div>
            ))}
          </div>
          {feedback && (
            <div style={{ marginTop: "2rem" }}>
              <h3>Final Feedback</h3>
              <pre>{feedback}</pre>
            </div>
          )}
          {score && (
            <div style={{ marginTop: "2rem" }}>
              <h3>Dashboard Data (For Company)</h3>
              <pre>{score}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Interview;

