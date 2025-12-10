#!/usr/bin/env python3
"""
Test with Azure Document Intelligence (newer service)
"""

import os
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential

def test_document_intelligence():
    """Test with Azure Document Intelligence"""
    
    # Your credentials
    ENDPOINT = "https://ipptocr.cognitiveservices.azure.com/"
    AZURE_API_KEY = os.getenv('AZURE_API_KEY', 'your-azure-api-key')
    MODEL_ID = "962d6ea-8617-4290-a641-70b0b896a933"
    IMAGE_PATH = "/Users/kyle/Downloads/IMG_3031.jpeg"
    
    print("Testing with Azure Document Intelligence")
    print("=" * 50)
    
    try:
        # Initialize Document Intelligence client
        client = DocumentIntelligenceClient(
            endpoint=ENDPOINT,
            credential=AzureKeyCredential(KEY)
        )
        
        # Read image
        with open(IMAGE_PATH, "rb") as f:
            image_data = f.read()
        
        print("Analyzing with model: " + MODEL_ID)
        
        # Analyze with custom model
        poller = client.begin_analyze_document(
            model_id=MODEL_ID,
            analyze_request=image_data
        )
        
        result = poller.result()
        
        print("Analysis successful!")
        print("Document type: " + str(result.model_id))
        
        if hasattr(result, 'documents') and result.documents:
            print("Documents found: " + str(len(result.documents)))
            for doc in result.documents:
                print("Document confidence: " + str(doc.confidence))
                
                if hasattr(doc, 'fields') and doc.fields:
                    print("Fields:")
                    for field_name, field in doc.fields.items():
                        if hasattr(field, 'value') and field.value:
                            print("  " + field_name + ": " + str(field.value))
                            if hasattr(field, 'confidence'):
                                print("    Confidence: " + str(field.confidence))
        else:
            print("No documents found in analysis")
        
        # Save results
        import json
        output = {
            "model_id": MODEL_ID,
            "service": "Document Intelligence",
            "success": True,
            "result": str(result)
        }
        
        with open("document_intelligence_results.json", "w") as f:
            json.dump(output, f, indent=2)
        
        print("Results saved to: document_intelligence_results.json")
        print("=" * 50)
        
        return result
        
    except Exception as e:
        print("Error: " + str(e))
        return None

if __name__ == "__main__":
    test_document_intelligence()
