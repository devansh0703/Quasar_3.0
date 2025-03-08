// app/api/record/stop/route.ts
import { NextResponse } from "next/server";
import path from "path";

export async function POST() {
  if (!global.soxProcess) {
    return NextResponse.json(
      { error: "No recording in progress" },
      { status: 400 }
    );
  }
  global.soxProcess.kill("SIGINT");
  global.soxProcess = null;
  const filePath = path.join(process.cwd(), "recordings", "response.wav");
  return NextResponse.json({ message: "Recording stopped", filePath });
}

