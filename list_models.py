#!/usr/bin/env python3
"""
List all available custom models in your Azure Form Recognizer account
"""

import os
from azure.ai.formrecognizer import FormTrainingClient
from azure.core.credentials import AzureKeyCredential

def list_available_models():
    """List all custom models in your account"""
    
    # Your credentials
    ENDPOINT = "https://ipptocr.cognitiveservices.azure.com/"
    AZURE_API_KEY = os.getenv('AZURE_API_KEY', 'your-azure-api-key')
    
    print("Listing available custom models...")
    print("=" * 50)
    
    try:
        # Initialize training client
        client = FormTrainingClient(
            endpoint=ENDPOINT,
            credential=AzureKeyCredential(KEY)
        )
        
        # List all custom models
        models = client.list_custom_models()
        
        model_count = 0
        print("Available custom models:")
        print("-" * 30)
        
        for model in models:
            model_count += 1
            print("Model ID: " + model.model_id)
            print("Status: " + model.status)
            print("Created: " + str(model.created_on))
            print("Last updated: " + str(model.last_updated))
            
            if hasattr(model, 'properties') and model.properties:
                print("Properties:")
                if hasattr(model.properties, 'is_composed'):
                    print("  Is composed: " + str(model.properties.is_composed))
            
            print()
        
        print("Total models found: " + str(model_count))
        
        print("=" * 50)
        return models
        
    except Exception as e:
        print("Error: " + str(e))
        return None

if __name__ == "__main__":
    list_available_models()
