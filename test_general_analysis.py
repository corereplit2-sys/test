#!/usr/bin/env python3
"""
Test with general document analysis (no custom model)
"""

import os
from azure.ai.formrecognizer import FormRecognizerClient
from azure.core.credentials import AzureKeyCredential

def test_general_analysis():
    """Test with general document analysis"""
    
    # Your credentials
    ENDPOINT = "https://ipptocr.cognitiveservices.azure.com/"
    KEY = os.getenv('AZURE_API_KEY', 'your-azure-api-key')
    IMAGE_PATH = "/Users/kyle/Downloads/IMG_3031.jpeg"
    
    print("Testing general document analysis")
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
        
        print("Analyzing document with general model...")
        
        # Use general document analysis
        poller = client.begin_recognize_content(form=image_data)
        result = poller.result()
        
        print("Analysis successful!")
        print("Pages found: " + str(len(result)))
        
        for page_idx, page in enumerate(result):
            print("\nPage " + str(page_idx + 1) + ":")
            print("Lines found: " + str(len(page.lines)))
            
            for line_idx, line in enumerate(page.lines):
                print("  Line " + str(line_idx + 1) + ": " + line.text)
                
                # Show bounding box
                if hasattr(line, 'bounding_box'):
                    print("    Bounding box: " + str(line.bounding_box))
        
        # Look for IPPT-related content
        print("\nLooking for IPPT patterns...")
        for page_idx, page in enumerate(result):
            for line in page.lines:
                text = line.text.lower()
                if any(keyword in text for keyword in ['sit', 'push', 'run', 'reps', 'time']):
                    print("Found IPPT data: " + line.text)
        
        # Save results
        import json
        output = {
            "service": "Form Recognizer - General Analysis",
            "pages": len(result),
            "success": True
        }
        
        with open("general_analysis_results.json", "w") as f:
            json.dump(output, f, indent=2)
        
        print("\nResults saved to: general_analysis_results.json")
        print("=" * 50)
        
        return result
        
    except Exception as e:
        print("Error: " + str(e))
        return None

if __name__ == "__main__":
    test_general_analysis()
