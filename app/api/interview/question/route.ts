// app/api/interview/question/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

// Hardcoded API keys (for demonstration only)
const OPENAI_API_KEY = "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";
const OPENAI_API_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = "openai/gpt-3.5-turbo";

// CORS headers to allow all headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export function OPTIONS() {
  // Handle preflight requests
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  const { action, jobDescription, history, questionCount } = await request.json();
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    baseURL: OPENAI_API_BASE,
  });
  
  // If action === "evaluate", then run the evaluation prompts.
  if (action === "evaluate") {
    // Candidate evaluation prompt
    const feedbackPrompt = [
      { role: "system", content: "You are an AI interview evaluator." },
      {
        role: "user",
        content: `Analyze the entire interview and provide structured feedback in this format:
        
### Final Evaluation:
- (Summary of candidate's performance)

### Strengths:
- (Candidate's strong points)

### Areas for Improvement:
- (Weaknesses & suggestions for improvement)

### SWOT Analysis:
- **Strengths:** (List)
- **Weaknesses:** (List)
- **Opportunities:** (Ways for growth)
- **Threats:** (Potential challenges)

Job Description: ${jobDescription}

Interview Transcript:
${history
  .map((item: any) => `Q: ${item.question}\nA: ${item.answer}`)
  .join("\n\n")}`,
      },
    ];
    
    // Moderator evaluation prompt (structured JSON)
    const scorePrompt = [
      { role: "system", content: "You are an AI providing structured evaluation." },
      {
        role: "user",
        content: `Analyze the interview and provide a JSON object with these fields:
{
  "score": (integer from 0 to 100),
  "reason": "(brief explanation)",
  "confidence": (integer from 0 to 100),
  "decision": "(PASS or FAIL)"
}
Output only valid JSON. No extra text. DO NOT HALLUCINATE.

Job Description: ${jobDescription}

Interview Transcript:
${history
  .map((item: any) => `Q: ${item.question}\nA: ${item.answer}`)
  .join("\n\n")}`,
      },
    ];

    try {
      // Generate candidate evaluation feedback
      const feedbackResponse = await openai.chat.completions.create({
        model: OPENROUTER_MODEL,
        messages: feedbackPrompt,
        temperature: 0,
      });
      const finalFeedback = feedbackResponse.choices[0]?.message?.content || "No feedback.";

      // Generate moderator evaluation score
      const scoreResponse = await openai.chat.completions.create({
        model: OPENROUTER_MODEL,
        messages: scorePrompt,
        temperature: 0,
      });
      const scoreResponseText = scoreResponse.choices[0]?.message?.content || "{}";
      let scoreData;
      try {
        scoreData = JSON.parse(scoreResponseText);
      } catch (error) {
        scoreData = { error: "Error parsing score" };
      }
      
      return NextResponse.json(
        { candidateFeedback: finalFeedback, moderatorEvaluation: scoreData },
        { headers: corsHeaders }
      );
    } catch (error) {
      console.error("Evaluation error:", error);
      return NextResponse.json(
        { error: "Error during evaluation" },
        { status: 500, headers: corsHeaders }
      );
    }
  }
  
  // Else (if no "evaluate" action is specified) generate a new interview question.
  const prompt = [
    {
      role: "system",
      content: `You are a professional AI interviewer with extensive experience interviewing candidates.
      
Job Description: ${jobDescription}
      
Generate ONE concise, relevant question for the candidate. DO NOT include any simulated candidate responses or additional context. The question should be direct and ready to be read to the interviewee. Just provide the question text by itself. Do not apply any markdown while asking the question.`,
    },
    {
      role: "user",
      content: `This is question #${questionCount}. Generate a relevant technical question based on the job description.`,
    },
  ];
  // Instead of filtering by role, simply join the history items if any.
  if (history && history.length > 0) {
    const previousQA = history
      .map((item: any) => `Q: ${item.question}\nA: ${item.answer}`)
      .join("\n\n");
    prompt[0].content += `\n\nPrevious questions and answers:\n${previousQA}`;
  }
  try {
    const response = await openai.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: prompt,
      temperature: 0.7,
    });
    const question = response.choices[0]?.message?.content || "Error: Could not generate question.";
    console.log("Full response:", response); // Log full response for debugging
    return NextResponse.json({ question }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error generating question", error);
    return NextResponse.json(
      { error: "Error generating question" },
      { status: 500, headers: corsHeaders }
    );
  }
}

