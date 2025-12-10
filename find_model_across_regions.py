#!/usr/bin/env python3
"""
Search for your model across different Azure regions and services
"""

import os
import json
import requests

def search_for_mode2_model():
    """Search for mode2 model across different endpoints"""
    
    AZURE_API_KEY = os.getenv('AZURE_API_KEY', 'your-azure-api-key')
    MODEL_ID = "b962d6ea-8617-4290-a641-70b0b896a933"
    
    print("Searching for mode2 model across Azure services...")
    print("=" * 50)
    
    headers = {"Ocp-Apim-Subscription-Key": AZURE_API_KEY}
    
    # Try different regions and services
    endpoints_to_try = [
        # Different regions
        "https://eastus.api.cognitive.microsoft.com/",
        "https://westus2.api.cognitive.microsoft.com/", 
        "https://westcentralus.api.cognitive.microsoft.com/",
        "https://southeastasia.api.cognitive.microsoft.com/",
        
        # Document Intelligence Studio
        "https://documentintelligence.azure.com/",
        
        # Your current endpoint variations
        "https://ipptocr.cognitiveservices.azure.com/",
        "https://ipptocr.azure.ai/",
    ]
    
    for endpoint in endpoints_to_try:
        print("\nTrying endpoint: " + endpoint)
        
        # Try to list models
        model_list_urls = [
            endpoint + "formrecognizer/v2.1/custom/models",
            endpoint + "documentintelligence/documentModels?api-version=2023-07-31"
        ]
        
        for url in model_list_urls:
            try:
                response = requests.get(url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    result = response.json()
                    models = result.get('modelList', result.get('value', []))
                    
                    print("  SUCCESS! Found " + str(len(models)) + " models")
                    
                    for model in models:
                        model_id = model.get('modelId', model.get('model_id', ''))
                        if 'b962d6ea-8617-4290-a641-70b0b896a933' in model_id:
                            print("  *** FOUND YOUR MODEL ***")
                            print("  Model ID: " + model_id)
                            print("  Status: " + model.get('status', 'N/A'))
                            print("  Endpoint: " + endpoint)
                            return endpoint, model_id
                
                elif response.status_code == 401:
                    print("  Unauthorized - wrong region/service")
                    break
                else:
                    print("  Status: " + str(response.status_code))
                    
            except Exception as e:
                print("  Error: " + str(e))
    
    print("\n" + "=" * 50)
    print("Model not found in any tested endpoint.")
    print("Please check your Azure Portal for exact details.")
    return None, None

if __name__ == "__main__":
    endpoint, model_id = search_for_mode2_model()
    
    if endpoint:
        print("\nFOUND! Your model is at:")
        print("Endpoint: " + endpoint)
        print("Model ID: " + model_id)
