import json
from azure.ai.formrecognizer import FormRecognizerClient
from azure.core.credentials import AzureKeyCredential

class CustomAzureIPPTParser:
    """Azure Form Recognizer Custom Model for IPPT forms"""
    
    def __init__(self, endpoint, key, model_id):
        self.endpoint = endpoint
        self.key = key
        self.model_id = model_id
        self.form_recognizer_client = FormRecognizerClient(
            endpoint=endpoint, 
            credential=AzureKeyCredential(key)
        )
    
    def extract_ippt_data(self, image_path):
        """Extract IPPT data using custom trained model"""
        
        print("Custom Azure Form Recognizer - IPPT Parser")
        print("=" * 50)
        
        try:
            # Read image file
            with open(image_path, "rb") as f:
                image_data = f.read()
            
            # Analyze with custom model
            poller = self.form_recognizer_client.begin_recognize_custom_forms(
                model_id=self.model_id,
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
                
                # Soldier name
                if 'soldier_name' in fields:
                    name_field = fields['soldier_name']
                    if name_field.value:
                        soldier_data['name'] = name_field.value
                        soldier_data['confidence'] = max(soldier_data['confidence'], name_field.confidence)
                
                # Sit-ups
                if 'sit_up_reps' in fields:
                    situp_field = fields['sit_up_reps']
                    if situp_field.value:
                        soldier_data['sit_up_reps'] = int(situp_field.value)
                        soldier_data['confidence'] = max(soldier_data['confidence'], situp_field.confidence)
                
                # Push-ups
                if 'push_up_reps' in fields:
                    pushup_field = fields['push_up_reps']
                    if pushup_field.value:
                        soldier_data['push_up_reps'] = int(pushup_field.value)
                        soldier_data['confidence'] = max(soldier_data['confidence'], pushup_field.confidence)
                
                # Run time
                if 'run_time' in fields:
                    runtime_field = fields['run_time']
                    if runtime_field.value:
                        soldier_data['run_time'] = runtime_field.value
                        soldier_data['confidence'] = max(soldier_data['confidence'], runtime_field.confidence)
                
                # Only add if we have meaningful data
                if soldier_data['name'] and (soldier_data['sit_up_reps'] > 0 or soldier_data['run_time']):
                    soldiers.append(soldier_data)
                    
                    print(str(len(soldiers)) + ". " + soldier_data['name'])
                    print("   Sit-ups: " + str(soldier_data['sit_up_reps']) + " reps")
                    print("   Push-ups: " + str(soldier_data['push_up_reps']) + " reps")
                    print("   Run: " + soldier_data['run_time'])
                    print("   Confidence: " + str(round(soldier_data['confidence'] * 100, 1)) + "%")
                    print("")
            
            # Create result
            result = {
                'soldiers': soldiers,
                'total_soldiers': len(soldiers),
                'model_used': self.model_id
            }
            
            # Export to JSON
            output_file = 'custom_model_parsed_ippt.json'
            with open(output_file, 'w') as f:
                json.dump(result, f, indent=2)
            
            print("=" * 50)
            print("CUSTOM MODEL SUMMARY:")
            print("People parsed: " + str(len(soldiers)))
            print("Model ID: " + self.model_id)
            print("Data exported to: " + output_file)
            print("=" * 50)
            
            return result
            
        except Exception as e:
            print("Error extracting IPPT data: " + str(e))
            return {'soldiers': [], 'error': str(e)}
    
    def extract_multiple_soldiers(self, image_path):
        """Extract multiple soldiers from a single IPPT sheet"""
        
        print("Multi-Soldier Extraction with Custom Model")
        print("=" * 45)
        
        try:
            # For multi-soldier forms, we might need to process each soldier separately
            # This depends on how the custom model was trained
            
            result = self.extract_ippt_data(image_path)
            
            # If the custom model doesn't handle multiple soldiers automatically,
            # we might need to use region-based extraction
            
            return result
            
        except Exception as e:
            print("Error in multi-soldier extraction: " + str(e))
            return {'soldiers': [], 'error': str(e)}

# Example usage
def main():
    # Configuration
    ENDPOINT = "YOUR_AZURE_FORM_RECOGNIZER_ENDPOINT"
    KEY = "YOUR_AZURE_FORM_RECOGNIZER_KEY"
    MODEL_ID = "mode2"  # Your trained model ID
    
    # Initialize parser
    parser = CustomAzureIPPTParser(ENDPOINT, KEY, MODEL_ID)
    
    # Extract data
    result = parser.extract_ippt_data('/Users/kyle/Downloads/IMG_3031.jpeg')
    
    return result

if __name__ == "__main__":
    result = main()
