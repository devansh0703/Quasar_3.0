import streamlit as st
import os
import json
import time
import openai
import sounddevice as sd
import numpy as np
import wave
import threading
import assemblyai as aai
from dotenv import load_dotenv
import fitz  # PyMuPDF for PDF resume analysis
import cv2
import torch
import matplotlib.pyplot as plt
import datetime
from transformers import AutoFeatureExtractor, AutoModelForImageClassification

# ----------------------------------------
# Environment Setup & API Keys
# ----------------------------------------
load_dotenv()
GEMINI_API_KEY=AIzaSyDNsSei1w6Q4Oa6iSz2ZWskDcXkf9GvErI

openai.api_key = "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"
openai.api_base =  "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "OPENROUTER_MODEL", "gpt-3.5-turbo"
aai.settings.api_key = "77cc5497e0114e1ab5fa000efe06f170"

# ----------------------------------------
# Helper Functions for Interview Session
# ----------------------------------------
def ask_llm(messages, model=DEFAULT_MODEL, temperature=0, max_retries=3):
    """Send a request to the LLM with retries."""
    for attempt in range(max_retries):
        try:
            response = openai.ChatCompletion.create(
                model=model,
                messages=messages,
                temperature=temperature
            )
            if "choices" in response:
                return response.choices[0].message["content"]
            else:
                st.error("Error: 'choices' not found in response.")
                return "Error: No valid response from LLM."
        except openai.error.OpenAIError as e:
            st.error(f"API Error (Attempt {attempt+1}/{max_retries}): {e}")
            time.sleep(2)
    return "Error: LLM request failed."

def load_parsed_resume(file_path="parsed_resume.json"):
    """Loads a parsed resume JSON file."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        st.error("Error: Failed to load parsed resume.")
        return None

def transcribe_audio(audio_file_path):
    """Transcribes a WAV file using AssemblyAI."""
    transcriber = aai.Transcriber()
    transcript = transcriber.transcribe(audio_file_path)
    if transcript.status == aai.TranscriptStatus.error:
        return "Error transcribing audio."
    return transcript.text

# ----------------------------------------
# Interview Session (Adapted for Streamlit)
# ----------------------------------------
def run_interview_session(job_description, parsed_resume, duration_minutes):
    if not parsed_resume:
        st.error("No parsed resume found. Please upload a valid parsed resume JSON.")
        return
    
    # Initialize session state if not already
    if "history" not in st.session_state:
        st.session_state.history = []
        st.session_state.start_time = time.time()
        st.session_state.end_time = st.session_state.start_time + (duration_minutes * 60)
        st.session_state.question_count = 1

    time_remaining = st.session_state.end_time - time.time()
    if time_remaining < 10:
        st.info("Interview time almost over. No new questions will be asked.")
        # Generate final evaluation feedback
        final_feedback_prompt = [
            {"role": "system", "content": "You are an expert interview evaluator."},
            {"role": "user", "content": (
                "Analyze the entire interview and provide a structured final evaluation without including a score. "
                "Format the response exactly as follows:\n"
                "### Final Evaluation:\n"
                "- (Summary of candidate's overall performance)\n\n"
                "### Strengths:\n"
                "- (Key positive aspects)\n\n"
                "### Areas for Improvement:\n"
                "- (Specific areas for improvement)\n\n"
                "### SWOT Analysis:\n"
                "- **Strengths:** (List strong points)\n"
                "- **Weaknesses:** (List weak points)\n"
                "- **Opportunities:** (Ways for growth)\n"
                "- **Threats:** (Potential risks or challenges)\n\n"
                "Interview Transcript:\n"
                f"{json.dumps(st.session_state.history, indent=2)}"
            )}
        ]
        final_feedback = ask_llm(final_feedback_prompt)
        st.write("### Candidate Feedback:")
        st.write(final_feedback)
        
        score_prompt = [
            {"role": "system", "content": "You are an AI evaluator providing structured evaluation data without any bias."},
            {"role": "user", "content": (
                "Analyze the interview transcript and provide a JSON object with exactly these fields:\n"
                "{\n"
                "  \"score\": (integer from 0 to 100),\n"
                "  \"reason\": \"(brief explanation of the score)\",\n"
                "  \"confidence\": (integer from 0 to 100),\n"
                "  \"decision\": (PASS or FAIL)\n"
                "}\n\n"
                "Output only valid JSON and no additional text.\n\n"
                "Interview Transcript:\n"
                f"{json.dumps(st.session_state.history, indent=2)}"
            )}
        ]
        score_response_text = ask_llm(score_prompt)
        try:
            score_data = json.loads(score_response_text)
        except json.JSONDecodeError:
            score_data = {"score": "unknown", "reason": "Could not extract score", "confidence": "unknown"}
        st.write("### Dashboard Data (For Company):")
        st.json(score_data)
        return
    
    st.write(f"**Time remaining:** {int(time_remaining)} seconds")
    
    # Generate next question using the LLM
    prompt = [
        {"role": "system", "content": "You are a skilled AI interviewer who evaluates and analyzes both the approach and final solution."},
        {"role": "user", "content": (
            f"Based on the job description and candidate's resume, generate the next question for the candidate. "
            "Make sure to not repeat any questions, only generate questions.\n\n"
            f"Interview Transcript:\n{json.dumps(st.session_state.history, indent=2)}"
        )}
    ]
    question = ask_llm(prompt)
    st.write(f"### Question {st.session_state.question_count}:")
    st.write(question)
    
    # Upload the candidate's answer as a WAV file
    audio_file = st.file_uploader("Upload your answer (WAV format)", type=["wav"], key=f"audio_{st.session_state.question_count}")
    if audio_file is not None:
        # Save temporarily for transcription
        temp_audio_path = "temp_response.wav"
        with open(temp_audio_path, "wb") as f:
            f.write(audio_file.read())
        answer = transcribe_audio(temp_audio_path)
        st.write("**Transcribed Answer:**")
        st.write(answer)
        # Append Q&A pair to interview history
        st.session_state.history.append({"question": question, "answer": answer})
        st.session_state.question_count += 1
        st.success("Answer recorded. Click 'Start/Continue Interview' again for the next question.")
        st.experimental_rerun()

# ----------------------------------------
# Resume Analysis (PDF Extraction)
# ----------------------------------------
def analyze_resume_pdf(pdf_bytes):
    pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page_num in range(pdf_document.page_count):
        page = pdf_document.load_page(page_num)
        text += page.get_text()
    # For demonstration, we return the extracted text.
    # In a real system, you would pass this text into an LLM chain (as in your original code).
    return {"extracted_text": text}

# ----------------------------------------
# Facial Analysis System (Webcam Capture)
# ----------------------------------------
class InterviewAnalysisSystem:
    def __init__(self, duration_minutes):
        self.duration_minutes = duration_minutes
        self.expression_extractor = AutoFeatureExtractor.from_pretrained("Rajaram1996/FacialEmoRecog")
        self.expression_model = AutoModelForImageClassification.from_pretrained("Rajaram1996/FacialEmoRecog")
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.timestamps = []
        self.emotion_data = {"confidence": [], "nervousness": [], "comfortable": []}
        self.cheating_scores = []
        self.multi_face_timestamps = []
        self.results_dir = f"results_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        os.makedirs(self.results_dir, exist_ok=True)
        self.video_path = os.path.join(self.results_dir, "recording.mp4")
    
    def detect_face(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)
        if len(faces) > 1:
            self.multi_face_timestamps.append(time.time())
        return faces
    
    def analyze_facial_expression(self, face_img):
        face_img_resized = cv2.resize(face_img, (224, 224))
        face_img_rgb = cv2.cvtColor(face_img_resized, cv2.COLOR_BGR2RGB)
        inputs = self.expression_extractor(face_img_rgb, return_tensors="pt")
        with torch.no_grad():
            outputs = self.expression_model(**inputs)
        logits = outputs.logits
        probs = torch.nn.functional.softmax(logits, dim=-1)
        confidence = float(probs[0][3]) * 3
        nervousness = float(probs[0][2]) * 3
        comfortable = float(probs[0][4]) * 3
        return min(confidence, 1.0), min(nervousness, 1.0), min(comfortable, 1.0)
    
    def detect_cheating(self, expressions):
        nervousness, confidence = expressions[1], expressions[0]
        cheating_score = max(0, nervousness - confidence)
        return cheating_score
    
    def process_frame(self, frame):
        faces = self.detect_face(frame)
        if len(faces) == 0:
            return frame
        for (x, y, w, h) in faces:
            face_img = frame[y:y + h, x:x + w]
            if face_img.size == 0:
                continue
            expressions = self.analyze_facial_expression(face_img)
            cheating_score = self.detect_cheating(expressions)
            self.timestamps.append(time.time())
            self.emotion_data["confidence"].append(expressions[0])
            self.emotion_data["nervousness"].append(expressions[1])
            self.emotion_data["comfortable"].append(expressions[2])
            self.cheating_scores.append(cheating_score)
        return frame
    
    def plot_results(self):
        if not self.timestamps:
            st.warning("No facial data recorded.")
            return None, None
        times = np.array(self.timestamps) - self.timestamps[0]
        plt.figure(figsize=(10, 5))
        plt.plot(times, self.emotion_data["confidence"], label="Confidence", color="green")
        plt.plot(times, self.emotion_data["nervousness"], label="Nervousness", color="red")
        plt.plot(times, self.emotion_data["comfortable"], label="Comfortable", color="blue")
        plt.xlabel("Time (seconds)")
        plt.ylabel("Emotion Score")
        plt.legend()
        plt.title("Emotional Trends During Interview")
        emotion_plot_path = os.path.join(self.results_dir, "emotion_trends.png")
        plt.savefig(emotion_plot_path)
        plt.close()
        
        plt.figure(figsize=(10, 3))
        plt.plot(times, self.cheating_scores, label="Cheating Score", color="purple")
        plt.xlabel("Time (seconds)")
        plt.ylabel("Cheating Confidence")
        plt.title("Cheating Detection Over Time")
        cheating_plot_path = os.path.join(self.results_dir, "cheating_trends.png")
        plt.savefig(cheating_plot_path)
        plt.close()
        return emotion_plot_path, cheating_plot_path
    
    def run_video_capture(self):
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            st.error("Error: Could not open video source.")
            return None
        start_time = time.time()
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(self.video_path, fourcc, 20.0, (640, 480))
        while time.time() - start_time < self.duration_minutes * 60:
            ret, frame = cap.read()
            if not ret:
                break
            _ = self.process_frame(frame)
            out.write(frame)
        cap.release()
        out.release()
        return self.plot_results()

# ----------------------------------------
# Streamlit App Layout
# ----------------------------------------
st.title("Unified Interview & Analysis System")
menu = st.sidebar.radio("Select Functionality", ["Interview Session", "Resume Analysis", "Facial Analysis"])

if menu == "Interview Session":
    st.header("Interview Session")
    job_description = st.text_area("Job Description", "Looking for cyber security analyst")
    duration_minutes = st.number_input("Interview Duration (minutes)", min_value=1.0, value=5.0)
    parsed_resume_json = st.file_uploader("Upload Parsed Resume JSON", type=["json"])
    if parsed_resume_json is not None:
        try:
            parsed_resume = json.load(parsed_resume_json)
        except Exception as e:
            st.error("Invalid JSON file.")
            parsed_resume = None
    else:
        parsed_resume = load_parsed_resume("parsed_resume.json")
    
    if st.button("Start/Continue Interview"):
        run_interview_session(job_description, parsed_resume, duration_minutes)

elif menu == "Resume Analysis":
    st.header("Resume Analysis")
    resume_pdf = st.file_uploader("Upload Resume PDF", type=["pdf"])
    if resume_pdf is not None:
        pdf_bytes = resume_pdf.read()
        resume_data = analyze_resume_pdf(pdf_bytes)
        st.json(resume_data)

elif menu == "Facial Analysis":
    st.header("Facial Analysis")
    duration_minutes = st.number_input("Analysis Duration (minutes)", min_value=1.0, value=1.0)
    if st.button("Start Facial Analysis"):
        system = InterviewAnalysisSystem(duration_minutes)
        result = system.run_video_capture()
        if result is not None:
            emotion_plot_path, cheating_plot_path = result
            st.image(emotion_plot_path, caption="Emotion Trends")
            st.image(cheating_plot_path, caption="Cheating Detection Trends")

