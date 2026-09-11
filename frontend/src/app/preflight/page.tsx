"use client";

import { useState } from "react";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const res = await fetch("http://localhost:8000/api/preflight", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload files");
      }

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-center pb-4 border-b">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            ESSR PA
          </h1>
          <div className="text-sm text-gray-500">MVP Preflight Center</div>
        </header>

        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Upload PDFs for Preflight</h2>
          <div className="flex flex-col space-y-4">
            <input
              type="file"
              multiple
              accept="application/pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || loading}
              className="self-start px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "Analyzing..." : "Analyze PDFs"}
            </button>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Preflight Results</h3>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md overflow-auto border">
                <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
