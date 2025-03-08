// app/api/interview/question/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

// Hardcoded API keys (for demonstration only)
const OPENAI_API_KEY = "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";
const OPENAI_API_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = "gpt-3.5-turbo";

export async function POST(request: Request) {
  const { jobDescription, history, questionCount } = await request.json();
  const prompt = [
    {
      role: "system",
      content: `You are a professional interviewer conducting a technical interview for a job position.
      
Job Description: ${jobDescription}
      
Generate ONE concise, relevant technical question for the candidate. DO NOT include any simulated candidate responses or additional context. The question should be direct and ready to be read to the interviewee. Just provide the question text by itself.`,
    },
    {
      role: "user",
      content: `This is question #${questionCount}. Generate a relevant technical question based on the job description.`,
    },
  ];
  if (history && history.length > 0) {
    const previousQA = history
      .map((item: any) => `Q: ${item.question}\nA: ${item.answer}`)
      .join("\n\n");
    prompt[0].content += `\n\nPrevious questions and answers:\n${previousQA}`;
  }
  try {
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      baseURL: OPENAI_API_BASE,
    });
    const response = await openai.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: prompt,
      temperature: 0,
    });
    const question = response.choices[0]?.message?.content || "Error: Could not generate question.";
    return NextResponse.json({ question });
  } catch (error) {
    console.error("Error generating question", error);
    return NextResponse.json(
      { error: "Error generating question" },
      { status: 500 }
    );
  }
}

