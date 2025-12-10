#!/usr/bin/env python3
"""
List all models in your Azure Document Intelligence service
"""

import os
import json
import requests

def list_document_intelligence_models():
    """List all custom models in Document Intelligence"""
    
    # Your credentials
    ENDPOINT = "https://ipptocr.cognitiveservices.azure.com/"
    KEY = os.getenv('AZURE_API_KEY', 'your-azure-api-key')
    
    print("Listing Azure Document Intelligence Models")
    print("=" * 45)
    
    headers = {
        "Ocp-Apim-Subscription-Key": KEY
    }
    
    # Try different API endpoints to list models
    api_urls = [
        ENDPOINT + "/documentintelligence/documentModels?api-version=2023-07-31",
        ENDPOINT + "/formrecognizer/v2.1/custom/models?api-version=2022-08-31",
        ENDPOINT + "/formrecognizer/v2.0/custom/models?api-version=2022-08-31"
    ]
    
    for i, api_url in enumerate(api_urls):
        print("\n" + str(i+1) + ". Trying: " + api_url)
        
        try:
            response = requests.get(api_url, headers=headers)
            
            print("   Status: " + str(response.status_code))
            
            if response.status_code == 200:
                result = response.json()
                print("   SUCCESS! Models found.")
                
                if 'customModels' in result or 'value' in result:
                    models = result.get('customModels', result.get('value', []))
                    
                    print("   Total models: " + str(len(models)))
                    
                    for model in models:
                        print("\n   Model:")
                        print("     ID: " + model.get('modelId', model.get('model_id', 'N/A')))
                        print("     Status: " + model.get('status', 'N/A'))
                        print("     Created: " + str(model.get('createdDateTime', model.get('created_on', 'N/A'))))
                        print("     Description: " + model.get('description', 'N/A'))
                        
                        # Check if this is your model
                        model_id = model.get('modelId', model.get('model_id', ''))
                        if 'b962d6ea-8617-4290-a641-70b0b896a933' in model_id or 'mode2' in model.get('description', '').lower():
                            print("     *** THIS IS YOUR MODEL ***")
                
                elif 'summary' in result:
                    summary = result['summary']
                    print("   Summary:")
                    print("     Custom models: " + str(summary.get('customModelCount', 0)))
                    print("     Prebuilt models: " + str(summary.get('prebuiltModelCount', 0)))
                
                # Save full response
                with open("doc_intelligence_models.json", "w") as f:
                    json.dump(result, f, indent=2)
                
                print("   Full response saved to: doc_intelligence_models.json")
                return result
                
            else:
                print("   Error: " + response.text[:200])
        
        except Exception as e:
            print("   Exception: " + str(e))
    
    print("\n" + "=" * 45)
    print("Could not list models.")
    return None

if __name__ == "__main__":
    list_document_intelligence_models()
