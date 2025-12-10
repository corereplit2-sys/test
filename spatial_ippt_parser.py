#!/usr/bin/env python3
"""
Spatial IPPT Parser using Azure Form Recognizer general analysis
Extracts soldier data using coordinate-based regions
"""

import os
import json
import re
from azure.ai.formrecognizer import FormRecognizerClient
from azure.core.credentials import AzureKeyCredential

class SpatialIPPTParser:
    """Parse IPPT data using spatial regions from general OCR analysis"""
    
    def __init__(self, endpoint, key):
        self.client = FormRecognizerClient(
            endpoint=endpoint,
            credential=AzureKeyCredential(key)
        )
    
    def extract_soldiers_by_regions(self, image_path):
        """Extract soldiers using coordinate-based regions"""
        
        print("Spatial IPPT Parser - Coordinate-Based Extraction")
        print("=" * 55)
        
        try:
            # Read image
            with open(image_path, "rb") as f:
                image_data = f.read()
            
            # Get general OCR analysis
            poller = self.client.begin_recognize_content(form=image_data)
            result = poller.result()
            
            if not result:
                print("No OCR results found")
                return {'soldiers': []}
            
            # Extract all text with coordinates
            all_text = []
            for page in result:
                for line in page.lines:
                    all_text.append({
                        'text': line.text,
                        'bbox': line.bounding_box,
                        'page': page_idx if 'page_idx' in locals() else 0
                    })
            
            print("Found " + str(len(all_text)) + " text lines")
            
            # Find soldier data using spatial patterns
            soldiers = []
            
            # Look for serial numbers (1-10) as anchors
            for i, text_item in enumerate(all_text):
                text = text_item['text'].strip()
                
                # Check if this is a serial number
                if text.isdigit() and 1 <= int(text) <= 10:
                    serial_num = int(text)
                    
                    # Look for soldier data near this serial number
                    soldier_data = self._extract_soldier_near_serial(
                        all_text, i, serial_num
                    )
                    
                    if soldier_data and soldier_data['name']:
                        soldiers.append(soldier_data)
                        
                        print(str(serial_num) + ". " + soldier_data['name'])
                        print("   Sit-ups: " + str(soldier_data['sit_up_reps']) + " reps")
                        print("   Push-ups: " + str(soldier_data['push_up_reps']) + " reps")
                        print("   Run: " + soldier_data['run_time'])
                        print("")
            
            # Create result
            result_data = {
                'soldiers': soldiers,
                'total_soldiers': len(soldiers),
                'method': 'spatial_coordinate_analysis'
            }
            
            # Export to JSON
            output_file = 'spatial_parsed_ippt.json'
            with open(output_file, 'w') as f:
                json.dump(result_data, f, indent=2)
            
            print("=" * 55)
            print("SPATIAL PARSER SUMMARY:")
            print("People parsed: " + str(len(soldiers)))
            print("Method: Coordinate-based analysis")
            print("Data exported to: " + output_file)
            print("=" * 55)
            
            return result_data
            
        except Exception as e:
            print("Error in spatial parsing: " + str(e))
            return {'soldiers': [], 'error': str(e)}
    
    def _extract_soldier_near_serial(self, all_text, serial_index, serial_num):
        """Extract soldier data near a serial number"""
        
        soldier_data = {
            'name': '',
            'sit_up_reps': 0,
            'push_up_reps': 0,
            'run_time': ''
        }
        
        # Look in the next 20 lines for soldier data
        search_range = min(serial_index + 20, len(all_text))
        
        # Find name (look for "PTE" or uppercase names)
        for i in range(serial_index + 1, search_range):
            text = all_text[i]['text'].strip()
            
            # Skip if we hit another serial number
            if text.isdigit() and 1 <= int(text) <= 10:
                break
            
            # Look for name patterns
            if 'PTE' in text or (text.isupper() and len(text) > 3):
                if not soldier_data['name']:
                    soldier_data['name'] = text.replace('PTE', '').strip()
                elif soldier_data['name'] and len(text) > len(soldier_data['name']):
                    # Take the longer name (might be split across lines)
                    soldier_data['name'] = text.replace('PTE', '').strip()
            
            # Look for performance data (numbers and times)
            elif re.match(r'^\d+$', text):
                num = int(text)
                
                # Reasonable ranges for IPPT data
                if 5 <= num <= 80:  # Sit-ups range
                    if soldier_data['sit_up_reps'] == 0:
                        soldier_data['sit_up_reps'] = num
                elif num <= 2000:  # Push-ups range
                    if soldier_data['push_up_reps'] == 0:
                        soldier_data['push_up_reps'] = num
            
            elif re.match(r'^\d{1,2}:\d{2}$', text):
                # Run time format
                if not soldier_data['run_time']:
                    soldier_data['run_time'] = text
        
        return soldier_data

def main():
    # Your credentials
    ENDPOINT = "https://ipptocr.cognitiveservices.azure.com/"
    KEY = os.getenv('AZURE_API_KEY', 'your-azure-api-key')
    IMAGE_PATH = "/Users/kyle/Downloads/IMG_3031.jpeg"
    
    parser = SpatialIPPTParser(ENDPOINT, KEY)
    result = parser.extract_soldiers_by_regions(IMAGE_PATH)
    
    return result

if __name__ == "__main__":
    main()
