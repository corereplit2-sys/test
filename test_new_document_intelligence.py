#!/usr/bin/env python3
"""
Test with Azure Document Intelligence (newer service)
Your custom model might be in this service instead of Form Recognizer
"""

import os
import json

def test_with_requests():
    """Test using direct HTTP requests to Document Intelligence API"""
    
    # Your credentials
    ENDPOINT = "https://ipptocr.cognitiveservices.azure.com/"
    AZURE_API_KEY = os.getenv('AZURE_API_KEY', 'your-azure-api-key')
    MODEL_ID = "b962d6ea-8617-4290-a641-70b0b896a933"
    IMAGE_PATH = "/Users/kyle/Downloads/IMG_3031.jpeg"
    
    print("Testing Azure Document Intelligence API")
    print("=" * 50)
    
    try:
        import requests
        
        # Read image
        with open(IMAGE_PATH, "rb") as f:
            image_data = f.read()
        
        # Build API URL
        api_url = ENDPOINT + "/documentintelligence/documentModels/" + MODEL_ID + ":analyze?api-version=2023-07-31"
        
        headers = {
            "Ocp-Apim-Subscription-Key": KEY,
            "Content-Type": "application/octet-stream"
        }
        
        print("Analyzing with model: " + MODEL_ID)
        print("API URL: " + api_url)
        
        # Make request
        response = requests.post(api_url, headers=headers, data=image_data)
        
        print("Status Code: " + str(response.status_code))
        print("Response Headers: " + str(dict(response.headers)))
        
        if response.status_code == 202:
            # Analysis started, get operation location
            operation_url = response.headers.get('Operation-Location')
            print("Operation URL: " + str(operation_url))
            
            if operation_url:
                # Poll for results
                headers_poll = {"Ocp-Apim-Subscription-Key": KEY}
                
                for i in range(10):  # Try 10 times
                    print("Checking result... attempt " + str(i+1))
                    
                    poll_response = requests.get(operation_url, headers=headers_poll)
                    
                    if poll_response.status_code == 200:
                        result = poll_response.json()
                        print("Analysis complete!")
                        
                        # Save results
                        with open("document_intelligence_result.json", "w") as f:
                            json.dump(result, f, indent=2)
                        
                        print("Results saved to: document_intelligence_result.json")
                        
                        # Display summary
                        if 'analyzeResult' in result:
                            analyze_result = result['analyzeResult']
                            if 'documents' in analyze_result:
                                print("Documents found: " + str(len(analyze_result['documents'])))
                                
                                for doc in analyze_result['documents']:
                                    print("Document confidence: " + str(doc.get('confidence', 'N/A')))
                                    
                                    if 'fields' in doc:
                                        print("Fields:")
                                        for field_name, field in doc['fields'].items():
                                            if 'value' in field:
                                                print("  " + field_name + ": " + str(field['value']))
                                                if 'confidence' in field:
                                                    print("    Confidence: " + str(field['confidence']))
                        
                        return result
                    else:
                        print("Poll response: " + str(poll_response.status_code))
                        time.sleep(2)  # Wait 2 seconds
        
        else:
            print("Error response: " + response.text)
            
            # Try to understand the error
            try:
                error_json = response.json()
                print("Error details: " + str(error_json))
            except:
                pass
        
    except Exception as e:
        print("Error: " + str(e))
        return None

if __name__ == "__main__":
    test_with_requests()
