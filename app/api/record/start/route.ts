// app/api/record/start/route.ts
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// Declare a global variable to hold the SoX process
declare global {
  var soxProcess: any;
}
if (!global.soxProcess) {
  global.soxProcess = null;
}

export async function POST() {
  if (global.soxProcess) {
    return NextResponse.json(
      { error: "Recording already in progress" },
      { status: 400 }
    );
  }
  const recordingsDir = path.join(process.cwd(), "recordings");
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir);
  }
  const filePath = path.join(recordingsDir, "response.wav");
  
  // Prepend SoX directory to PATH if needed (e.g., on Windows)
  process.env.PATH = "C:\\Program Files (x86)\\sox-14-4-2;" + process.env.PATH;
  
  global.soxProcess = spawn("sox", ["-d", "-r", "16000", "-c", "1", filePath]);
  global.soxProcess.on("error", (err: any) => {
    console.error("SoX error", err);
  });
  return NextResponse.json({ message: "Recording started" });
}

