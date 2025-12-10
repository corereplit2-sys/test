import json
import re

def parse_simple_ippt_data(json_file_path):
    """Simplified Azure OCR parser - only name, situps, pushups, run time for up to 10 people"""
    
    # Load the JSON data
    with open(json_file_path, 'r') as f:
        data = json.load(f)
    
    # Extract the main content
    content = data['analyzeResult']['content']
    lines = content.split('\n')
    
    print "Simple IPPT Parser - Up to 10 people"
    print "=" * 50
    
    # Parse up to 10 soldiers
    soldiers = []
    current_serial = 1
    max_people = 10
    i = 0
    
    while current_serial <= max_people and i < len(lines):
        line = lines[i].strip()
        
        # Look for a line that's just a number (serial number)
        if line.isdigit() and int(line) == current_serial:
            try:
                # Extract basic info
                nric = lines[i + 1].strip() if i + 1 < len(lines) else ""
                name_line = lines[i + 2].strip() if i + 2 < len(lines) else ""
                
                # Parse name (remove rank prefix)
                name = name_line.replace('PTE', '').strip() if name_line else ""
                
                # Performance data - based on the structure we learned
                # Line i+7: sit-up reps
                # Line i+8: push-up reps  
                # Line i+9: run time
                sit_up_line = lines[i + 7].strip() if i + 7 < len(lines) else ""
                push_up_line = lines[i + 8].strip() if i + 8 < len(lines) else ""
                run_time_line = lines[i + 9].strip() if i + 9 < len(lines) else ""
                
                # Parse the data
                sit_up_reps = 0
                push_up_reps = 0
                run_time = ""
                
                try:
                    sit_up_reps = int(sit_up_line)
                except:
                    sit_up_reps = 0
                
                try:
                    push_up_reps = int(push_up_line)
                except:
                    push_up_reps = 0
                
                run_time = run_time_line
                
                # Only add if we have a name or valid data
                if name and (sit_up_reps > 0 or push_up_reps > 0 or run_time):
                    soldier_data = {
                        'name': name,
                        'sit_up_reps': sit_up_reps,
                        'push_up_reps': push_up_reps,
                        'run_time': run_time
                    }
                    soldiers.append(soldier_data)
                    
                    print str(current_serial) + ". " + name
                    print "   Sit-ups: " + str(sit_up_reps) + " reps"
                    print "   Push-ups: " + str(push_up_reps) + " reps"
                    print "   Run: " + run_time
                    print ""
                
                # Skip ahead to next potential soldier
                i += 12
                current_serial += 1
                
            except Exception as e:
                print "Error parsing soldier " + str(current_serial) + ": " + str(e)
                current_serial += 1
                i += 1
        else:
            i += 1
    
    # Create simple result
    result = {
        'soldiers': soldiers
    }
    
    # Export to JSON
    output_file = 'simple_parsed_ippt.json'
    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)
    
    print "=" * 50
    print "SIMPLE SUMMARY:"
    print "People parsed: " + str(len(soldiers))
    print "Data exported to: " + output_file
    print "=" * 50
    
    return result

if __name__ == "__main__":
    result = parse_simple_ippt_data('/Users/kyle/Downloads/IMG_3031.jpeg.json')
