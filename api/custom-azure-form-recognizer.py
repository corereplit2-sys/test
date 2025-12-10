import os
import json
from flask import Flask, request, jsonify
from azure.ai.formrecognizer import FormRecognizerClient
from azure.core.credentials import AzureKeyCredential
from werkzeug.utils import secure_filename
import tempfile

app = Flask(__name__)

# Configuration
AZURE_FORM_RECOGNIZER_ENDPOINT = os.getenv('AZURE_FORM_RECOGNIZER_ENDPOINT', 'YOUR_ENDPOINT')
AZURE_FORM_RECOGNIZER_KEY = os.getenv('AZURE_FORM_RECOGNIZER_KEY', 'YOUR_KEY')
IPPT_MODEL_ID = os.getenv('IPPT_MODEL_ID', 'mode2')  # Your trained model ID

# Initialize Form Recognizer client
form_recognizer_client = FormRecognizerClient(
    endpoint=AZURE_FORM_RECOGNIZER_ENDPOINT,
    credential=AzureKeyCredential(AZURE_FORM_RECOGNIZER_KEY)
)

@app.route('/api/custom-azure-form-recognizer', methods=['POST'])
def extract_with_custom_model():
    """Extract IPPT data using Azure Form Recognizer custom model"""
    
    try:
        # Check if file was uploaded
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
            file.save(temp_file.name)
            temp_path = temp_file.name
        
        try:
            # Analyze with custom model
            with open(temp_path, "rb") as f:
                image_data = f.read()
            
            poller = form_recognizer_client.begin_recognize_custom_forms(
                model_id=IPPT_MODEL_ID,
                form=image_data
            )
            
            result = poller.result()
            
            soldiers = []
            
            # Process each recognized form
            for recognized_form in result:
                soldier_data = {
                    'name': '',
                    'sit_up_reps': 0,
                    'push_up_reps': 0,
                    'run_time': '',
                    'confidence': 0.0
                }
                
                # Extract fields based on custom model training
                fields = recognized_form.fields
                
                # Soldier name (field name depends on your training)
                if 'soldier_name' in fields and fields['soldier_name'].value:
                    soldier_data['name'] = fields['soldier_name'].value
                    soldier_data['confidence'] = max(soldier_data['confidence'], fields['soldier_name'].confidence)
                elif 'name' in fields and fields['name'].value:
                    soldier_data['name'] = fields['name'].value
                    soldier_data['confidence'] = max(soldier_data['confidence'], fields['name'].confidence)
                
                # Sit-ups
                if 'sit_up_reps' in fields and fields['sit_up_reps'].value:
                    soldier_data['sit_up_reps'] = int(fields['sit_up_reps'].value)
                    soldier_data['confidence'] = max(soldier_data['confidence'], fields['sit_up_reps'].confidence)
                elif 'situps' in fields and fields['situps'].value:
                    soldier_data['sit_up_reps'] = int(fields['situps'].value)
                    soldier_data['confidence'] = max(soldier_data['confidence'], fields['situps'].confidence)
                
                # Push-ups
                if 'push_up_reps' in fields and fields['push_up_reps'].value:
                    soldier_data['push_up_reps'] = int(fields['push_up_reps'].value)
                    soldier_data['confidence'] = max(soldier_data['confidence'], fields['push_up_reps'].confidence)
                elif 'pushups' in fields and fields['pushups'].value:
                    soldier_data['push_up_reps'] = int(fields['pushups'].value)
                    soldier_data['confidence'] = max(soldier_data['confidence'], fields['pushups'].confidence)
                
                # Run time
                if 'run_time' in fields and fields['run_time'].value:
                    soldier_data['run_time'] = fields['run_time'].value
                    soldier_data['confidence'] = max(soldier_data['confidence'], fields['run_time'].confidence)
                elif 'runtime' in fields and fields['runtime'].value:
                    soldier_data['run_time'] = fields['runtime'].value
                    soldier_data['confidence'] = max(soldier_data['confidence'], fields['runtime'].confidence)
                
                # Only add if we have meaningful data
                if soldier_data['name'] and (soldier_data['sit_up_reps'] > 0 or soldier_data['run_time']):
                    soldiers.append(soldier_data)
            
            # Create response
            response = {
                'soldiers': soldiers,
                'total_soldiers': len(soldiers),
                'model_used': IPPT_MODEL_ID,
                'success': True
            }
            
            return jsonify(response)
            
        finally:
            # Clean up temporary file
            os.unlink(temp_path)
            
    except Exception as e:
        print(f"Error in custom model extraction: {str(e)}")
        return jsonify({
            'error': f'Custom model extraction failed: {str(e)}',
            'soldiers': [],
            'success': False
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Custom Azure Form Recognizer API',
        'model_id': IPPT_MODEL_ID
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
