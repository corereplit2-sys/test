#!/usr/bin/env python3
"""
Test script for your mode2 Azure Form Recognizer model
"""

import os
from azure.ai.formrecognizer import FormRecognizerClient
from azure.core.credentials import AzureKeyCredential

def test_mode2_model():
    """Test your mode2 model with IMG_3031.jpeg"""
    
    # Configuration - Your credentials
    ENDPOINT = "https://ipptocr.cognitiveservices.azure.com/"
    AZURE_API_KEY = os.getenv('AZURE_API_KEY', 'your-azure-api-key')
    MODEL_ID = "962d6ea-8617-4290-a641-70b0b896a933"
    IMAGE_PATH = "/Users/kyle/Downloads/IMG_3031.jpeg"
    
    print("Testing mode2 model with IMG_3031.jpeg")
    print("=" * 50)
    
    try:
        # Initialize client
        client = FormRecognizerClient(
            endpoint=ENDPOINT,
            credential=AzureKeyCredential(KEY)
        )
        
        # Read image
        with open(IMAGE_PATH, "rb") as f:
            image_data = f.read()
        
        print("Analyzing with model: " + MODEL_ID)
        
        # Analyze with your custom model
        poller = client.begin_recognize_custom_forms(
            model_id=MODEL_ID,
            form=image_data
        )
        
        result = poller.result()
        
        print("Forms found: " + str(len(result)))
        print("-" * 30)
        
        # Display results
        for i, form in enumerate(result):
            print("Form " + str(i+1) + ":")
            
            if form.fields:
                for field_name, field in form.fields.items():
                    if field.value:
                        print("  " + field_name + ": " + str(field.value) + " (confidence: " + str(round(field.confidence, 2)) + ")")
            else:
                print("  No fields detected")
            
            print()
        
        # Save results
        import json
        output = {
            "model_id": MODEL_ID,
            "forms_detected": len(result),
            "results": []
        }
        
        for form in result:
            form_data = {}
            if form.fields:
                for field_name, field in form.fields.items():
                    if field.value:
                        form_data[field_name] = {
                            "value": field.value,
                            "confidence": field.confidence
                        }
            output["results"].append(form_data)
        
        with open("mode2_test_results.json", "w") as f:
            json.dump(output, f, indent=2)
        
        print("Results saved to: mode2_test_results.json")
        print("=" * 50)
        
        return output
        
    except Exception as e:
        print("Error: " + str(e))
        return None

if __name__ == "__main__":
    test_mode2_model()
