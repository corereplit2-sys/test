#!/usr/bin/env python3
"""
ChatGPT Vision OCR API for IPPT tracker
Uses OpenAI GPT-4 Vision for intelligent OCR extraction
"""

from flask import Flask, request, jsonify
import os
import json
import base64
from openai import OpenAI
import re

app = Flask(__name__)

# Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'your-openai-api-key-here')

# Initialize OpenAI client
client = OpenAI(api_key=OPENAI_API_KEY)

class ChatGPTVisionOCR:
    def __init__(self):
        self.client = client
    
    def extract_ippt_data(self, image_path):
        """Extract IPPT data using ChatGPT Vision"""
        
        try:
            # Read and encode image
            with open(image_path, "rb") as f:
                image_data = f.read()
                base64_image = base64.b64encode(image_data).decode('utf-8')
            
            # Create prompt for ChatGPT Vision
            prompt = """
            Please extract IPPT (Individual Physical Proficiency Test) data from this image.
            
            Look for a table or list with the following columns for each soldier:
            - Name (full name, may include ranks like PTE, 1 SIR, 2 SIR)
            - Sit-ups (number of repetitions)
            - Push-ups (number of repetitions) 
            - 2.4km Run time (format: MM:SS)
            
            Return the data as a JSON array of objects with these fields:
            {
              "name": "Full Name",
              "sit_up_reps": number,
              "push_up_reps": number,
              "run_time": "MM:SS"
            }
            
            Important guidelines:
            - Extract ALL soldiers visible in the image
            - Be accurate with numbers and times
            - Handle OCR errors intelligently
            - If unsure about a value, make your best estimate
            - Return valid JSON only, no other text
            """
            
            # Call ChatGPT Vision API
            response = self.client.chat.completions.create(
                model="gpt-4-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=2000
            )
            
            # Extract and parse response
            content = response.choices[0].message.content
            
            # Try to extract JSON from response
            soldiers = self._parse_json_response(content)
            
            # Validate and clean data
            validated_soldiers = self._validate_and_clean_soldiers(soldiers)
            
            return {
                'soldiers': validated_soldiers,
                'total_soldiers': len(validated_soldiers),
                'method': 'chatgpt_vision',
                'success': len(validated_soldiers) > 0,
                'raw_response': content
            }
            
        except Exception as e:
            return {'soldiers': [], 'error': str(e)}
    
    def _parse_json_response(self, content):
        """Parse JSON from ChatGPT response"""
        
        try:
            # Try to extract JSON array from response
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                return json.loads(json_str)
            
            # If no array found, try to parse entire response
            return json.loads(content)
            
        except json.JSONDecodeError:
            # If JSON parsing fails, try to extract manually
            return self._manual_extraction(content)
    
    def _manual_extraction(self, content):
        """Manual extraction if JSON parsing fails"""
        
        soldiers = []
        lines = content.split('\n')
        
        current_soldier = {}
        
        for line in lines:
            line = line.strip()
            
            # Look for name patterns
            if any(keyword in line.upper() for keyword in ['PTE', 'SIR', 'LTA', 'CPL', 'SGT']):
                if current_soldier:
                    soldiers.append(current_soldier)
                current_soldier = {'name': line}
            
            # Look for sit-up patterns
            elif re.search(r'sit-?up\s*:?\s*(\d+)', line, re.IGNORECASE):
                match = re.search(r'sit-?up\s*:?\s*(\d+)', line, re.IGNORECASE)
                if match:
                    current_soldier['sit_up_reps'] = int(match.group(1))
            
            # Look for push-up patterns
            elif re.search(r'push-?up\s*:?\s*(\d+)', line, re.IGNORECASE):
                match = re.search(r'push-?up\s*:?\s*(\d+)', line, re.IGNORECASE)
                if match:
                    current_soldier['push_up_reps'] = int(match.group(1))
            
            # Look for run time patterns
            elif re.search(r'run\s*:?\s*(\d{1,2}:\d{2})', line, re.IGNORECASE):
                match = re.search(r'run\s*:?\s*(\d{1,2}:\d{2})', line, re.IGNORECASE)
                if match:
                    current_soldier['run_time'] = match.group(1)
        
        # Add last soldier
        if current_soldier:
            soldiers.append(current_soldier)
        
        return soldiers
    
    def _validate_and_clean_soldiers(self, soldiers):
        """Validate and clean soldier data"""
        
        validated_soldiers = []
        
        for soldier in soldiers:
            # Ensure required fields exist
            if not soldier.get('name'):
                continue
            
            # Clean and validate data
            cleaned_soldier = {
                'name': str(soldier['name']).strip(),
                'sit_up_reps': self._validate_number(soldier.get('sit_up_reps', 0), 0, 200),
                'push_up_reps': self._validate_number(soldier.get('push_up_reps', 0), 0, 200),
                'run_time': self._validate_time(soldier.get('run_time', ''))
            }
            
            # Only include if we have meaningful data
            if (cleaned_soldier['sit_up_reps'] > 0 or 
                cleaned_soldier['push_up_reps'] > 0 or 
                cleaned_soldier['run_time']):
                validated_soldiers.append(cleaned_soldier)
        
        return validated_soldiers[:10]  # Limit to 10 soldiers
    
    def _validate_number(self, value, min_val, max_val):
        """Validate and clean numeric values"""
        
        try:
            num = int(value)
            return max(min_val, min(num, max_val))
        except (ValueError, TypeError):
            return min_val
    
    def _validate_time(self, time_str):
        """Validate and clean time values"""
        
        if not time_str:
            return ''
        
        # Look for MM:SS pattern
        match = re.search(r'(\d{1,2}):(\d{2})', str(time_str))
        if match:
            minutes = int(match.group(1))
            seconds = int(match.group(2))
            
            # Validate reasonable range
            if 0 <= minutes <= 30 and 0 <= seconds <= 59:
                return f"{minutes}:{seconds:02d}"
        
        return ''

# Initialize OCR
ocr = ChatGPTVisionOCR()

@app.route('/api/chatgpt-vision-ocr', methods=['POST'])
def extract_with_chatgpt_vision():
    """Extract IPPT data using ChatGPT Vision"""
    
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Save file temporarily
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpeg') as tmp_file:
            file.save(tmp_file.name)
            image_path = tmp_file.name
        
        # Extract data
        result = ocr.extract_ippt_data(image_path)
        
        # Clean up
        os.unlink(image_path)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'chatgpt-vision-ocr'})

if __name__ == '__main__':
    print("Starting ChatGPT Vision OCR API...")
    print("Make sure to set OPENAI_API_KEY environment variable")
    app.run(debug=True, port=5002)
