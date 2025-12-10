#!/usr/bin/env python3
"""
Search for your model using different approaches
"""

import os
from azure.ai.formrecognizer import FormTrainingClient, FormRecognizerClient
from azure.core.credentials import AzureKeyCredential

def find_model():
    """Try to find your model"""
    
    # Your credentials
    ENDPOINT = "https://ipptocr.cognitiveservices.azure.com/"
    AZURE_API_KEY = os.getenv('AZURE_API_KEY', 'your-azure-api-key')
    TARGET_MODEL_ID = "962d6ea-8617-4290-a641-70b0b896a933"
    
    print("Searching for model: " + TARGET_MODEL_ID)
    print("=" * 50)
    
    try:
        # Try Form Training Client
        print("1. Checking with Form Training Client...")
        training_client = FormTrainingClient(
            endpoint=ENDPOINT,
            credential=AzureKeyCredential(KEY)
        )
        
        models = training_client.list_custom_models()
        model_count = 0
        
        for model in models:
            model_count += 1
            if model.model_id == TARGET_MODEL_ID:
                print("FOUND MODEL!")
                print("Model ID: " + model.model_id)
                print("Status: " + model.status)
                print("Created: " + str(model.created_on))
                print("Last updated: " + str(model.last_updated))
                
                # Try to use it
                print("\n2. Testing with Form Recognizer Client...")
                recognizer_client = FormRecognizerClient(
                    endpoint=ENDPOINT,
                    credential=AzureKeyCredential(KEY)
                )
                
                # Test with a simple request
                try:
                    from azure.ai.formrecognizer import FormRecognizerClient
                    print("Model is accessible via Form Recognizer")
                except Exception as e:
                    print("Form Recognizer error: " + str(e))
                
                return True
        
        print("Model not found in " + str(model_count) + " available models")
        
        # List all available models
        print("\nAvailable models:")
        print("-" * 30)
        model_count = 0
        for model in models:
            model_count += 1
            print(str(model_count) + ". " + model.model_id)
            print("   Status: " + model.status)
            print("   Created: " + str(model.created_on))
            print()
        
        return False
        
    except Exception as e:
        print("Error: " + str(e))
        return False

if __name__ == "__main__":
    find_model()
