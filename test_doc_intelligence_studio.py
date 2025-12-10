#!/usr/bin/env python3
"""
Test Document Intelligence Studio API endpoints
"""

import os
import json
import requests
import time

def test_document_intelligence_studio():
    """Test Document Intelligence Studio specific endpoints"""
    
    KEY = os.getenv('AZURE_API_KEY', 'your-azure-api-key')
    MODEL_ID = "b962d6ea-8617-4290-a641-70b0b896a933"
    IMAGE_PATH = "/Users/kyle/Downloads/IMG_3031.jpeg"
    
    print("Testing Document Intelligence Studio API")
    print("=" * 45)
    
    # Document Intelligence Studio endpoints
    studio_endpoints = [
        # Your endpoint with Studio paths
        "https://ipptocr.cognitiveservices.azure.com/documentintelligence/documentModels/",
        "https://ipptocr.cognitiveservices.azure.com/aiservices/documentintelligence/documentModels/",
        "https://ipptocr.cognitiveservices.azure.com/vision/documentintelligence/documentModels/",
        
        # Studio-specific endpoints
        "https://ipptocr.cognitiveservices.azure.com/studio/documentModels/",
        "https://ipptocr.cognitiveservices.azure.com/builder/documentModels/",
    ]
    
    # Read image
    with open(IMAGE_PATH, "rb") as f:
        image_data = f.read()
    
    headers = {
        "Ocp-Apim-Subscription-Key": KEY,
        "Content-Type": "application/octet-stream"
    }
    
    for endpoint in studio_endpoints:
        print("\nTrying: " + endpoint)
        
        # Try to analyze with your model
        analyze_url = endpoint + MODEL_ID + ":analyze?api-version=2023-07-31"
        
        try:
            response = requests.post(analyze_url, headers=headers, data=image_data, timeout=30)
            
            print("Status: " + str(response.status_code))
            
            if response.status_code == 202:
                # Success! Analysis started
                operation_url = response.headers.get('Operation-Location')
                print("Operation URL: " + str(operation_url))
                
                if operation_url:
                    # Poll for results
                    for i in range(10):
                        poll_response = requests.get(operation_url, headers={"Ocp-Apim-Subscription-Key": KEY})
                        
                        if poll_response.status_code == 200:
                            result = poll_response.json()
                            print("SUCCESS! Analysis complete.")
                            
                            # Save results
                            with open("studio_model_result.json", "w") as f:
                                json.dump(result, f, indent=2)
                            
                            print("Results saved to: studio_model_result.json")
                            
                            # Display summary
                            if 'analyzeResult' in result:
                                analyze_result = result['analyzeResult']
                                if 'documents' in analyze_result:
                                    print("Documents found: " + str(len(analyze_result['documents'])))
                                    
                                    for doc in analyze_result['documents']:
                                        print("Document confidence: " + str(doc.get('confidence', 'N/A')))
                                        
                                        if 'fields' in doc:
                                            print("Fields found: " + str(len(doc['fields'])))
                                            for field_name, field in doc['fields'].items():
                                                if 'value' in field:
                                                    print("  " + field_name + ": " + str(field['value']))
                            
                            return result
                        
                        else:
                            print("Poll attempt " + str(i+1) + ": " + str(poll_response.status_code))
                            time.sleep(2)
                
            else:
                print("Error: " + response.text[:200])
        
        except Exception as e:
            print("Exception: " + str(e))
    
    print("\n" + "=" * 45)
    print("Studio model not found with these endpoints.")
    return None

if __name__ == "__main__":
    test_document_intelligence_studio()
