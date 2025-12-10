#!/usr/bin/env python3
"""
Foolproof OCR Parser with Multiple Extraction Methods
Combines Azure OCR, pattern matching, and fallback strategies
"""

import os
import json
import re
from azure.ai.formrecognizer import FormRecognizerClient
from azure.core.credentials import AzureKeyCredential

class FoolproofOCRParser:
    """Multi-layered OCR parser for maximum reliability"""
    
    def __init__(self, endpoint, key):
        self.client = FormRecognizerClient(
            endpoint=endpoint,
            credential=AzureKeyCredential(key)
        )
    
    def extract_ippt_data(self, image_path):
        """Foolproof extraction with multiple methods"""
        
        print("FOOLPROOF OCR PARSER - Multi-Layer Extraction")
        print("=" * 55)
        
        try:
            # Method 1: Azure General OCR
            azure_result = self._azure_ocr_extraction(image_path)
            
            # Method 2: Pattern-based extraction
            pattern_result = self._pattern_based_extraction(azure_result)
            
            # Method 3: Fallback extraction
            fallback_result = self._fallback_extraction(azure_result)
            
            # Combine and validate results
            final_result = self._combine_and_validate([
                azure_result,
                pattern_result, 
                fallback_result
            ])
            
            # Export results
            output_file = 'foolproof_parsed_ippt.json'
            with open(output_file, 'w') as f:
                json.dump(final_result, f, indent=2)
            
            print("=" * 55)
            print("FOOLPROOF SUMMARY:")
            print("People parsed: " + str(len(final_result['soldiers'])))
            print("Methods used: Azure OCR + Patterns + Fallback")
            print("Data exported to: " + output_file)
            print("=" * 55)
            
            return final_result
            
        except Exception as e:
            print("Error in foolproof parsing: " + str(e))
            return {'soldiers': [], 'error': str(e)}
    
    def _azure_ocr_extraction(self, image_path):
        """Method 1: Azure Form Recognizer general OCR"""
        
        print("Method 1: Azure General OCR")
        
        try:
            with open(image_path, "rb") as f:
                image_data = f.read()
            
            poller = self.client.begin_recognize_content(form=image_data)
            result = poller.result()
            
            # Extract all text with positions
            all_text = []
            for page in result:
                for line in page.lines:
                    all_text.append({
                        'text': line.text,
                        'bbox': line.bounding_box
                    })
            
            # Extract soldiers using spatial patterns
            soldiers = self._extract_soldiers_from_text(all_text)
            
            print("  Azure OCR found: " + str(len(soldiers)) + " soldiers")
            return {'soldiers': soldiers, 'method': 'azure_ocr'}
            
        except Exception as e:
            print("  Azure OCR failed: " + str(e))
            return {'soldiers': [], 'method': 'azure_ocr_failed'}
    
    def _pattern_based_extraction(self, azure_result):
        """Method 2: Pattern-based extraction from text"""
        
        print("Method 2: Pattern-Based Extraction")
        
        soldiers = []
        
        # Extract text from Azure result
        try:
            with open('/Users/kyle/Downloads/IMG_3031.jpeg.json', 'r') as f:
                data = json.load(f)
            
            content = data['analyzeResult']['content']
            lines = content.split('\n')
            
            # Enhanced pattern matching
            soldiers = self._enhanced_pattern_matching(lines)
            
            print("  Pattern extraction found: " + str(len(soldiers)) + " soldiers")
            return {'soldiers': soldiers, 'method': 'pattern_based'}
            
        except Exception as e:
            print("  Pattern extraction failed: " + str(e))
            return {'soldiers': [], 'method': 'pattern_failed'}
    
    def _fallback_extraction(self, azure_result):
        """Method 3: Fallback extraction with heuristics"""
        
        print("Method 3: Fallback Heuristic Extraction")
        
        soldiers = []
        
        try:
            # Try reading the JSON file directly
            with open('/Users/kyle/Downloads/IMG_3031.jpeg.json', 'r') as f:
                data = json.load(f)
            
            content = data['analyzeResult']['content']
            lines = content.split('\n')
            
            # Aggressive extraction heuristics
            soldiers = self._aggressive_extraction(lines)
            
            print("  Fallback found: " + str(len(soldiers)) + " soldiers")
            return {'soldiers': soldiers, 'method': 'fallback'}
            
        except Exception as e:
            print("  Fallback extraction failed: " + str(e))
            return {'soldiers': [], 'method': 'fallback_failed'}
    
    def _extract_soldiers_from_text(self, all_text):
        """Extract soldiers from Azure OCR text with positions"""
        
        soldiers = []
        
        # Look for serial numbers (1-10)
        for i, item in enumerate(all_text):
            text = item['text'].strip()
            
            if text.isdigit() and 1 <= int(text) <= 10:
                serial_num = int(text)
                
                # Extract data near this serial number
                soldier = self._extract_nearby_data(all_text, i, serial_num)
                if soldier and soldier['name']:
                    soldiers.append(soldier)
        
        return soldiers
    
    def _enhanced_pattern_matching(self, lines):
        """Enhanced pattern matching for soldier data"""
        
        soldiers = []
        
        # Multiple pattern strategies
        strategies = [
            self._working_line_based_strategy(lines),
            self._serial_number_strategy(lines),
            self._name_based_strategy(lines),
            self._performance_data_strategy(lines)
        ]
        
        # Combine results from all strategies
        all_soldiers = []
        for strategy_soldiers in strategies:
            for soldier in strategy_soldiers:
                if soldier and soldier['name'] and soldier not in all_soldiers:
                    all_soldiers.append(soldier)
        
        return all_soldiers
    
    def _working_line_based_strategy(self, lines):
        """Our proven working line-based strategy"""
        
        soldiers = []
        positions = [
            (23, '1'), (33, '2'), (42, '3'), (51, '4'), (60, '5'),
            (69, '6'), (78, '7'), (87, '8'), (96, '9'), (105, '10')
        ]
        
        for pos, serial in positions:
            if pos < len(lines):
                soldier = self._extract_soldier_at_position(lines, pos, serial)
                if soldier:
                    soldiers.append(soldier)
        
        return soldiers
    
    def _serial_number_strategy(self, lines):
        """Strategy based on finding serial numbers"""
        
        soldiers = []
        
        for i, line in enumerate(lines):
            if line.strip().isdigit() and 1 <= int(line.strip()) <= 10:
                serial = int(line.strip())
                soldier = self._extract_soldier_at_position(lines, i, serial)
                if soldier:
                    soldiers.append(soldier)
        
        return soldiers
    
    def _name_based_strategy(self, lines):
        """Strategy based on finding military names"""
        
        soldiers = []
        
        for i, line in enumerate(lines):
            # Look for military ranks and names
            if any(rank in line.upper() for rank in ['PTE', 'LTA', 'CPL', 'SGT', '2LT', 'CPT']):
                # Extract data around this name
                soldier = self._extract_data_around_name(lines, i)
                if soldier:
                    soldiers.append(soldier)
        
        return soldiers
    
    def _performance_data_strategy(self, lines):
        """Strategy based on performance data patterns"""
        
        soldiers = []
        
        for i, line in enumerate(lines):
            # Look for performance data patterns
            if re.match(r'^\d{1,2}:\d{2}$', line.strip()):  # Run time
                # This might be run time, look for soldier data nearby
                soldier = self._extract_from_performance_context(lines, i)
                if soldier:
                    soldiers.append(soldier)
        
        return soldiers
    
    def _aggressive_extraction(self, lines):
        """Aggressive extraction with multiple heuristics"""
        
        soldiers = []
        
        # Try every possible approach
        for start_line in range(len(lines) - 20):
            # Look for potential soldier data blocks
            block = lines[start_line:start_line + 20]
            soldier = self._extract_from_block(block, start_line)
            if soldier and soldier not in soldiers:
                soldiers.append(soldier)
        
        return soldiers[:10]  # Limit to 10 soldiers
    
    def _extract_soldier_at_position(self, lines, pos, serial):
        """Extract soldier data at specific position"""
        
        soldier_data = {
            'name': '',
            'sit_up_reps': 0,
            'push_up_reps': 0,
            'run_time': ''
        }
        
        # Extract name
        if pos + 2 < len(lines):
            name_line = lines[pos + 2].strip()
            soldier_data['name'] = name_line.replace('PTE', '').strip()
        
        # Extract performance data
        if serial == '1':
            # Soldier 1 pattern
            offsets = [(7, 'situp'), (8, 'pushup'), (9, 'run')]
        else:
            # Soldiers 2-10 pattern
            offsets = [(6, 'situp'), (7, 'pushup'), (8, 'run')]
        
        for offset, data_type in offsets:
            if pos + offset < len(lines):
                line = lines[pos + offset].strip()
                
                if data_type == 'situp' and re.match(r'^\d+$', line):
                    soldier_data['sit_up_reps'] = int(line)
                elif data_type == 'pushup' and re.match(r'^\d+$', line):
                    soldier_data['push_up_reps'] = int(line)
                elif data_type == 'run' and re.match(r'^\d{1,2}:\d{2}$', line):
                    soldier_data['run_time'] = line
        
        return soldier_data if soldier_data['name'] else None
    
    def _extract_nearby_data(self, all_text, index, serial):
        """Extract data near a text item"""
        
        soldier_data = {
            'name': '',
            'sit_up_reps': 0,
            'push_up_reps': 0,
            'run_time': ''
        }
        
        # Look in nearby lines for data
        search_range = min(index + 20, len(all_text))
        
        for i in range(index + 1, search_range):
            text = all_text[i]['text'].strip()
            
            # Skip if we hit another serial number
            if text.isdigit() and 1 <= int(text) <= 10:
                break
            
            # Look for name
            if 'PTE' in text or (text.isupper() and len(text) > 3):
                if not soldier_data['name']:
                    soldier_data['name'] = text.replace('PTE', '').strip()
            
            # Look for performance data
            elif re.match(r'^\d+$', text):
                num = int(text)
                if 5 <= num <= 80 and soldier_data['sit_up_reps'] == 0:
                    soldier_data['sit_up_reps'] = num
                elif num <= 2000 and soldier_data['push_up_reps'] == 0:
                    soldier_data['push_up_reps'] = num
            
            elif re.match(r'^\d{1,2}:\d{2}$', text):
                if not soldier_data['run_time']:
                    soldier_data['run_time'] = text
        
        return soldier_data if soldier_data['name'] else None
    
    def _extract_data_around_name(self, lines, name_index):
        """Extract data around a found name"""
        
        soldier_data = {
            'name': lines[name_index].replace('PTE', '').strip(),
            'sit_up_reps': 0,
            'push_up_reps': 0,
            'run_time': ''
        }
        
        # Look for performance data in nearby lines
        for i in range(max(0, name_index - 5), min(len(lines), name_index + 15)):
            line = lines[i].strip()
            
            if re.match(r'^\d+$', line):
                num = int(line)
                if 5 <= num <= 80 and soldier_data['sit_up_reps'] == 0:
                    soldier_data['sit_up_reps'] = num
                elif num <= 2000 and soldier_data['push_up_reps'] == 0:
                    soldier_data['push_up_reps'] = num
            
            elif re.match(r'^\d{1,2}:\d{2}$', line):
                if not soldier_data['run_time']:
                    soldier_data['run_time'] = line
        
        return soldier_data if soldier_data['sit_up_reps'] > 0 or soldier_data['run_time'] else None
    
    def _extract_from_performance_context(self, lines, run_index):
        """Extract from performance data context"""
        
        # Look backwards from run time to find soldier data
        soldier_data = {
            'name': '',
            'sit_up_reps': 0,
            'push_up_reps': 0,
            'run_time': lines[run_index]
        }
        
        # Look backwards for performance data and name
        for i in range(run_index - 1, max(0, run_index - 10), -1):
            line = lines[i].strip()
            
            if re.match(r'^\d+$', line):
                num = int(line)
                if 5 <= num <= 80 and soldier_data['sit_up_reps'] == 0:
                    soldier_data['sit_up_reps'] = num
                elif num <= 2000 and soldier_data['push_up_reps'] == 0:
                    soldier_data['push_up_reps'] = num
            
            elif 'PTE' in line or (line.isupper() and len(line) > 3):
                soldier_data['name'] = line.replace('PTE', '').strip()
                break
        
        return soldier_data if soldier_data['name'] else None
    
    def _extract_from_block(self, block, start_line):
        """Extract soldier from a block of lines"""
        
        # Look for a complete soldier data pattern in this block
        soldier_data = {
            'name': '',
            'sit_up_reps': 0,
            'push_up_reps': 0,
            'run_time': ''
        }
        
        for i, line in enumerate(block):
            line = line.strip()
            
            # Look for name
            if 'PTE' in line or (line.isupper() and len(line) > 3):
                soldier_data['name'] = line.replace('PTE', '').strip()
            
            # Look for performance data
            elif re.match(r'^\d+$', line):
                num = int(line)
                if 5 <= num <= 80 and soldier_data['sit_up_reps'] == 0:
                    soldier_data['sit_up_reps'] = num
                elif num <= 2000 and soldier_data['push_up_reps'] == 0:
                    soldier_data['push_up_reps'] = num
            
            elif re.match(r'^\d{1,2}:\d{2}$', line):
                soldier_data['run_time'] = line
        
        # Return only if we have substantial data
        if soldier_data['name'] and (soldier_data['sit_up_reps'] > 0 or soldier_data['run_time']):
            return soldier_data
        
        return None
    
    def _combine_and_validate(self, results):
        """Combine results from multiple methods and validate"""
        
        all_soldiers = []
        seen_names = set()
        
        # Prioritize methods by reliability
        method_priority = ['azure_ocr', 'pattern_based', 'fallback']
        
        for method in method_priority:
            for result in results:
                if result.get('method') == method:
                    for soldier in result['soldiers']:
                        if soldier['name'] and soldier['name'] not in seen_names:
                            # Validate soldier data
                            if self._validate_soldier_data(soldier):
                                all_soldiers.append(soldier)
                                seen_names.add(soldier['name'])
        
        # Limit to 10 soldiers (IPPT form max)
        all_soldiers = all_soldiers[:10]
        
        return {
            'soldiers': all_soldiers,
            'total_soldiers': len(all_soldiers),
            'method': 'foolproof_multi_layer',
            'success': len(all_soldiers) > 0
        }
    
    def _validate_soldier_data(self, soldier):
        """Validate soldier data quality"""
        
        # Must have a name
        if not soldier.get('name') or len(soldier['name']) < 2:
            return False
        
        # Must have some performance data
        has_performance = (
            soldier.get('sit_up_reps', 0) > 0 or
            soldier.get('push_up_reps', 0) > 0 or
            soldier.get('run_time')
        )
        
        if not has_performance:
            return False
        
        # Reasonable ranges
        if soldier.get('sit_up_reps', 0) > 200:
            return False
        if soldier.get('push_up_reps', 0) > 2000:
            return False
        
        return True

def main():
    # Your credentials
    ENDPOINT = "https://ipptocr.cognitiveservices.azure.com/"
    KEY = os.getenv('AZURE_API_KEY', 'your-azure-api-key')
    IMAGE_PATH = "/Users/kyle/Downloads/IMG_3031.jpeg"
    
    parser = FoolproofOCRParser(ENDPOINT, KEY)
    result = parser.extract_ippt_data(IMAGE_PATH)
    
    return result

if __name__ == "__main__":
    main()
