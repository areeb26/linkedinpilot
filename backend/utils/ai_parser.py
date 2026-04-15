import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

async def parse_scraped_text(text: str):
    """
    Uses Gemini Flash to extract structured JSON from raw scraped text.
    """
    if not GEMINI_API_KEY:
        return {"error": "Gemini API key not configured"}

    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = f"""
    Extract lead information from the following raw text scraped from a LinkedIn profile.
    Return a JSON object with: 
    - first_name
    - last_name
    - full_name
    - headline
    - title
    - company
    - location
    - skills (list)
    
    Raw text:
    {text}
    """
    
    try:
        response = model.generate_content(prompt)
        # Clean response text if it has markdown code blocks
        content = response.text.strip().replace("```json", "").replace("```", "")
        import json
        return json.loads(content)
    except Exception as e:
        print(f"AI Parsing Error: {e}")
        return {"error": str(e)}
