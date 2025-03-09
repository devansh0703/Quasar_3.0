"use client";

import { useState } from "react";
import Interview from "./interview"
import ExpressionAnalysis from "./expression";
export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
      setAnalysisData(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    try {
      const response = await fetch("http://localhost:8000/api/py/analyze-resume", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to analyze resume.");
      }

      const data = await response.json();
      setAnalysisData(data);
    } catch (err) {
      setError("Error analyzing resume. Please try again.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md">
        <ExpressionAnalysis />
      <Interview />
        <h1 className="text-2xl font-bold mb-4">Resume Analyzer</h1>
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileChange}
          className="mb-4"
        />
        <button
          onClick={handleUpload}
          className="bg-blue-500 text-white py-2 px-4 rounded"
        >
          Upload & Analyze
        </button>
        {error && <p className="text-red-500 mt-4">{error}</p>}
        {analysisData && (
          <div className="mt-4">
            <h2 className="text-xl font-semibold">Analysis Results</h2>
            <pre className="bg-gray-100 p-4 rounded mt-2">
              {JSON.stringify(analysisData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}

