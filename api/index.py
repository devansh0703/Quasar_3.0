from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
import fitz  # PyMuPDF

# ----------------- Resume Analysis Setup -----------------
app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0,
    groq_api_key="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"
)
# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/py/helloFastApi")
def hello_fast_api():
    return {"message": "Hello from FastAPI"}

@app.post("/api/py/analyze-resume")
async def analyze_resume(resume: UploadFile = File(...)):
    if resume.content_type not in ["application/pdf"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF files are supported.")
    contents = await resume.read()
    pdf_document = fitz.open(stream=contents, filetype="pdf")
    text = ""
    for page_num in range(pdf_document.page_count):
        page = pdf_document.load_page(page_num)
        text += page.get_text()
    return textual_analysis(text)

def textual_analysis(data):
    data_sample = data
    prompt_extract = PromptTemplate.from_template(
        f"""
        ###DATA SAMPLE:
        {data_sample}\n
        ###INSTRUCTION
        Extract and structure the following resume text into a well-formatted JSON object with these fields:
    
    1) Should he be taken into a company of Cyber Security, Data Science, or Software Development.
    2) Personal Details: Name, Email, Phone, Profile URLs  
    3) Self Summary  
    4) Work Experience: Job Title, Job Duration, Job Description  
    5) Projects: Project Title, Project URL  
    6) Education Details: Duration, Institute Name, Course Name, Score/GPA (if available)  
    7) Achievements: Title, Description  
    8) Certifications: Title, Description, Expiry Date (if available)  
    9) Skills: Categorized as Technical Skills and Soft Skills  
    10) Languages  
    11) Interests  
    
    Return only a valid JSON response without any additional text.
        ### VALID JSON (NO PREAMBLE):
        """
    )
    chain_extract = prompt_extract | llm
    response = chain_extract.invoke(input={'data': data_sample})
    json_data = None
    json_parser = JsonOutputParser()
    try:
        json_data = json_parser.parse(response.content)
    except Exception as e:
        print(f"Failed to parse JSON: {e}")
    return json_data

# ----------------- Expression Analysis Setup -----------------
import cv2
import torch
import numpy as np
import time
import os
import datetime
import matplotlib.pyplot as plt
import tempfile
from transformers import AutoFeatureExtractor, AutoModelForImageClassification

class InterviewAnalysisSystem:
    def __init__(self, duration_minutes):
        print("Initializing Interview Analysis System...")
        self.duration_minutes = duration_minutes
        print("Loading emotion recognition model...")
        self.expression_extractor = AutoFeatureExtractor.from_pretrained("Rajaram1996/FacialEmoRecog")
        self.expression_model = AutoModelForImageClassification.from_pretrained("Rajaram1996/FacialEmoRecog")
        print("Setting up face detection...")
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
        return max(0, nervousness - confidence)
    
    def process_frame(self, frame):
        faces = self.detect_face(frame)
        if len(faces) == 0:
            return frame
        for (x, y, w, h) in faces:
            face_img = frame[y:y+h, x:x+w]
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
            print("No data recorded.")
            return
        times = np.array(self.timestamps) - self.timestamps[0]
        plt.figure(figsize=(10, 5))
        plt.plot(times, self.emotion_data["confidence"], label="Confidence", color="green")
        plt.plot(times, self.emotion_data["nervousness"], label="Nervousness", color="red")
        plt.plot(times, self.emotion_data["comfortable"], label="Comfortable", color="blue")
        plt.xlabel("Time (seconds)")
        plt.ylabel("Emotion Score")
        plt.legend()
        plt.title("Emotional Trends During Interview")
        plt.savefig(os.path.join(self.results_dir, "emotion_trends.png"))
        plt.close()
        plt.figure(figsize=(10, 3))
        plt.plot(times, self.cheating_scores, label="Cheating Score", color="purple")
        plt.xlabel("Time (seconds)")
        plt.ylabel("Cheating Confidence")
        plt.title("Cheating Detection Over Time")
        plt.legend()
        plt.savefig(os.path.join(self.results_dir, "cheating_trends.png"))
        plt.close()
        avg_confidence = np.mean(self.emotion_data["confidence"]) * 100
        avg_nervousness = np.mean(self.emotion_data["nervousness"]) * 100
        avg_comfortable = np.mean(self.emotion_data["comfortable"]) * 100
        avg_cheating = np.mean(self.cheating_scores) * 100
        multi_face_duration = len(self.multi_face_timestamps) / len(self.timestamps) * 100 if self.timestamps else 0
        report_path = os.path.join(self.results_dir, "final_report.txt")
        with open(report_path, "w") as f:
            f.write(f"Confidence: {avg_confidence:.2f}%\n")
            f.write(f"Nervousness: {avg_nervousness:.2f}%\n")
            f.write(f"Comfortable: {avg_comfortable:.2f}%\n")
            f.write(f"Cheating Score: {avg_cheating:.2f}%\n")
            f.write(f"Multiple People Detected: {multi_face_duration:.2f}% of the time\n")

@app.post("/api/py/expression")
async def analyze_expression(video: UploadFile = File(...)):
    if video.content_type not in ["video/webm", "video/mp4"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only video/webm or video/mp4 supported.")
    try:
        contents = await video.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp.write(contents)
            video_path = tmp.name
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to save video file.")
    try:
        system = InterviewAnalysisSystem(duration_minutes=0)
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Could not open video file.")
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        output_path = os.path.join(system.results_dir, "recording.mp4")
        out = cv2.VideoWriter(output_path, fourcc, 20.0, (640, 480))
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            system.process_frame(frame)
            out.write(frame)
        cap.release()
        out.release()
        cv2.destroyAllWindows()
        system.plot_results()
        report_path = os.path.join(system.results_dir, "final_report.txt")
        with open(report_path, "r") as f:
            report = f.read()
        os.unlink(video_path)
        return JSONResponse(content={"report": report, "results_dir": system.results_dir})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing video: {str(e)}")
