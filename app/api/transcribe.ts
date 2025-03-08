// pages/api/transcribe.ts
import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { AssemblyAI } from "assemblyai";
import dotenv from "dotenv";
dotenv.config();

const assemblyClient = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ error: "File path not provided" });
  }
  try {
    const audioFile = fs.readFileSync(filePath);
    const transcript = await assemblyClient.transcripts.transcribe({
      audio: audioFile,
    });
    res.status(200).json({ transcript: transcript.text || "Error: No transcription available." });
  } catch (error) {
    console.error("AssemblyAI error", error);
    res.status(500).json({ error: "Error transcribing audio" });
  }
}
