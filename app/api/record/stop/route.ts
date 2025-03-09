// app/api/record/stop/route.ts
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function POST() {
  // Check if a global soxProcess exists
  if (global.soxProcess) {
    try {
      global.soxProcess.kill("SIGINT");
    } catch (error) {
      console.error("Error stopping sox process:", error);
      return NextResponse.json({ error: "Failed to stop recording" }, { status: 500 });
    }
    global.soxProcess = null;
  }
  // Ensure recordings folder exists
  const recordingsDir = path.join(process.cwd(), "recordings");
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }
  const filePath = path.join(recordingsDir, "response.wav");
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Recording file not found" }, { status: 404 });
  }
  return NextResponse.json({ message: "Recording stopped", filePath });
}
