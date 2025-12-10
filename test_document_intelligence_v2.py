#!/usr/bin/env python3
"""
Test Azure Document Intelligence with different API versions and URLs
"""

import os
import json
import time
import requests

def test_document_intelligence_variants():
    """Test different Document Intelligence API variants"""
    
    # Your credentials
    ENDPOINT = "https://ipptocr.cognitiveservices.azure.com/"
    AZURE_API_KEY = os.getenv('AZURE_API_KEY', 'your-azure-api-key')
    MODEL_ID = "b962d6ea-8617-4290-a641-70b0b896a933"
    IMAGE_PATH = "/Users/kyle/Downloads/IMG_3031.jpeg"
    
    print("Testing Azure Document Intelligence API Variants")
    print("=" * 55)
    
    # Read image
    with open(IMAGE_PATH, "rb") as f:
        image_data = f.read()
    
    headers = {
        "Ocp-Apim-Subscription-Key": KEY,
        "Content-Type": "application/octet-stream"
    }
    
    # Try different API versions and URL patterns
    api_variants = [
        # Document Intelligence (newer)
        ENDPOINT + "/documentintelligence/documentModels/" + MODEL_ID + ":analyze?api-version=2023-07-31",
        ENDPOINT + "/documentintelligence/documentModels/" + MODEL_ID + ":analyze?api-version=2022-08-31",
        ENDPOINT + "/documentintelligence/documentModels/" + MODEL_ID + ":analyze?api-version=2022-06-30-preview",
        
        # Form Recognizer (older)
        ENDPOINT + "/formrecognizer/v2.1/custom/models/" + MODEL_ID + "/analyze",
        ENDPOINT + "/formrecognizer/v2.0/custom/models/" + MODEL_ID + "/analyze",
        
        # Alternative Document Intelligence URLs
        ENDPOINT + "/cognitiveservices/documentintelligence/documentModels/" + MODEL_ID + ":analyze?api-version=2023-07-31",
        ENDPOINT + "/vision/v3.2/documentintelligence/documentModels/" + MODEL_ID + ":analyze?api-version=2023-07-31",
    ]
    
    for i, api_url in enumerate(api_variants):
        print("\n" + str(i+1) + ". Testing: " + api_url)
        
        try:
            response = requests.post(api_url, headers=headers, data=image_data)
            
            print("   Status: " + str(response.status_code))
            
            if response.status_code == 202:
                # Analysis started
                operation_url = response.headers.get('Operation-Location')
                print("   Operation URL: " + str(operation_url))
                
                if operation_url:
                    # Poll for results
                    for j in range(5):
                        poll_response = requests.get(operation_url, headers={"Ocp-Apim-Subscription-Key": KEY})
                        
                        if poll_response.status_code == 200:
                            result = poll_response.json()
                            print("   SUCCESS! Analysis complete.")
                            
                            # Save results
                            with open("doc_intelligence_success.json", "w") as f:
                                json.dump(result, f, indent=2)
                            
                            print("   Results saved to: doc_intelligence_success.json")
                            
                            # Display summary
                            if 'analyzeResult' in result:
                                analyze_result = result['analyzeResult']
                                if 'documents' in analyze_result:
                                    print("   Documents found: " + str(len(analyze_result['documents'])))
                                    
                                    for doc in analyze_result['documents']:
                                        print("   Document confidence: " + str(doc.get('confidence', 'N/A')))
                                        
                                        if 'fields' in doc:
                                            print("   Fields found: " + str(len(doc['fields'])))
                                            for field_name, field in doc['fields'].items():
                                                if 'value' in field:
                                                    print("     " + field_name + ": " + str(field['value']))
                            
                            return result
                        else:
                            print("   Poll attempt " + str(j+1) + ": " + str(poll_response.status_code))
                            time.sleep(1)
                
            elif response.status_code == 200:
                print("   Direct response received")
                result = response.json()
                print("   Response: " + str(result)[:200] + "...")
                
            else:
                print("   Error: " + response.text[:100])
        
        except Exception as e:
            print("   Exception: " + str(e))
    
    print("\n" + "=" * 55)
    print("No working API variant found.")
    print("Model might be in a different service or region.")
    return None

if __name__ == "__main__":
    test_document_intelligence_variants()
