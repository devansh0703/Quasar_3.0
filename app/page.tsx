"use client";
import { ParticleButton } from "@/components/ui/particle-button";
import { useState } from "react";
import Interview from "./interview";
import ExpressionAnalysis from "./expression";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
      setAnalysisData(null);
      setError(null);
      setImageUrls([]); // Reset images
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

      // Use images from the response. If a results_dir is provided, you could build image URLs from it.
      if (data.results_dir) {
        const baseUrl = `http://localhost:8000/static/${data.results_dir}/`;
        setImageUrls([
          `${baseUrl}emotion_plot.png`,
          `${baseUrl}cheating_score.png`,
        ]);
      } else if (data.images && Array.isArray(data.images)) {
        setImageUrls(data.images);
      }
    } catch (err) {
      setError("Error analyzing resume. Please try again.");
    }
  };

  const renderAnalysisData = (data: any) => {
    if (!data) return null;
    return (
      <div className="mt-4">
        <h2 className="text-2xl font-semibold mb-4">Analysis Results</h2>
        <div className="bg-gray-800 shadow-md rounded-lg p-6">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="mb-4">
              <h3 className="text-lg font-bold text-gray-300">{key.replace(/_/g, ' ')}:</h3>
              {Array.isArray(value) ? (
                value.map((item, index) => (
                  <div key={index} className="ml-4 text-gray-400">
                    {typeof item === "object" ? (
                      Object.entries(item).map(([subKey, subValue]) => (
                        <div key={subKey} className="ml-2">
                          <strong>{subKey.replace(/_/g, ' ')}:</strong> {subValue}
                        </div>
                      ))
                    ) : (
                      <span>{item}</span>
                    )}
                  </div>
                ))
              ) : typeof value === "object" ? (
                Object.entries(value).map(([subKey, subValue]) => (
                  <div key={subKey} className="ml-4 text-gray-400">
                    <strong>{subKey.replace(/_/g, ' ')}:</strong> {subValue}
                  </div>
                ))
              ) : (
                <span className="text-gray-400">{value}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-8">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold text-center text-gray-100 mb-8">Resume Analyzer</h1>
        <div className="bg-gray-800 shadow-md rounded-lg p-6 mb-8">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileChange}
            className="mb-4 w-full p-2 border border-gray-700 rounded bg-gray-700 text-gray-300"
          />
          <button
            onClick={handleUpload}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
          >
            Upload & Analyze
          </button>
          {error && <p className="text-red-500 mt-4">{error}</p>}
        </div>
        {renderAnalysisData(analysisData)}
        {imageUrls.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-100">Generated Analysis Images</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {imageUrls.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Analysis Image ${index + 1}`}
                  className="rounded shadow-md"
                />
              ))}
            </div>
          </div>
        )}
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-100">Expression Analysis</h2>
          <ExpressionAnalysis />
        </div>
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-100">Interview</h2>
          <Interview />
        </div>
      </div>
    </main>
  );
}
