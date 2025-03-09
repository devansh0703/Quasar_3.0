from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
import fitz  # PyMuPDF

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
    # Check if the file is a PDF (adjust if you want to support DOC/DOCX)
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
    
    # Extract JSON from response content
    json_data = None

    # Use JsonOutputParser to ensure valid JSON output
    json_parser = JsonOutputParser()
    try:
        json_data = json_parser.parse(response.content)
    except Exception as e:
        print(f"Failed to parse JSON: {e}")

    return json_data
