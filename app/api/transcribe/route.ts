// app/api/transcribe/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { AssemblyAI } from "assemblyai";

// Hardcoded AssemblyAI API key (for demonstration only)
const ASSEMBLYAI_API_KEY = "77cc5497e0114e1ab5fa000efe06f170";

export async function POST(request: Request) {
  const { filePath } = await request.json();
  if (!filePath) {
    return NextResponse.json(
      { error: "File path not provided" },
      { status: 400 }
    );
  }
  try {
    const audioFile = fs.readFileSync(filePath);
    const assemblyClient = new AssemblyAI({ apiKey: ASSEMBLYAI_API_KEY });
    const transcript = await assemblyClient.transcripts.transcribe({ audio: audioFile });
    return NextResponse.json({ transcript: transcript.text || "Error: No transcription available." });
  } catch (error) {
    console.error("AssemblyAI error", error);
    return NextResponse.json(
      { error: "Error transcribing audio" },
      { status: 500 }
    );
  }
}

