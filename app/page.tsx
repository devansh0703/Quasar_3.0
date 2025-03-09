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
        <h2 className="text-xl font-semibold">Analysis Results</h2>
        <div className="bg-gray-100 p-8 rounded mt-2">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} style={{ marginBottom: "10px" }}>
              <strong>{key.replace(/_/g, ' ')}:</strong>
              {Array.isArray(value) ? (
                value.map((item, index) => (
                  <div key={index} style={{ marginLeft: "20px" }}>
                    {typeof item === "object" ? (
                      Object.entries(item).map(([subKey, subValue]) => (
                        <div key={subKey}>
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
                  <div key={subKey} style={{ marginLeft: "20px" }}>
                    <strong>{subKey.replace(/_/g, ' ')}:</strong> {subValue}
                  </div>
                ))
              ) : (
                <span>{value}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
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
        {renderAnalysisData(analysisData)}

        {/* Display Images */}
        {imageUrls.length > 0 && (
          <div className="mt-4">
            <h2 className="text-xl font-semibold">Generated Analysis Images</h2>
            {imageUrls.map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`Analysis Image ${index + 1}`}
                className="mt-2 rounded shadow-md"
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
