import json
import re

def parse_all_soldiers_correctly(json_file_path):
    """Working manual Azure OCR parser - correct positions for all soldiers"""
    
    # Load JSON data
    with open(json_file_path, 'r') as f:
        data = json.load(f)
    
    # Extract main content
    content = data['analyzeResult']['content']
    lines = content.split('\n')
    
    print "Working Manual Parser - All 10 Soldiers"
    print "=" * 50
    
    soldiers = []
    
    # Based on the OCR analysis, these are the exact positions:
    soldier_positions = [
        (23, '1'),   # Soldier 1 starts at line 23
        (33, '2'),   # Soldier 2 starts at line 33
        (42, '3'),   # Soldier 3 starts at line 42
        (51, '4'),   # Soldier 4 starts at line 51
        (60, '5'),   # Soldier 5 starts at line 60
        (69, '6'),   # Soldier 6 starts at line 69
        (78, '7'),   # Soldier 7 starts at line 78
        (87, '8'),   # Soldier 8 starts at line 87
        (96, '9'),   # Soldier 9 starts at line 96
        (105, '10')  # Soldier 10 starts at line 105
    ]
    
    for pos, serial in soldier_positions:
        try:
            if pos >= len(lines):
                print str(serial) + ". [Position out of range]"
                continue
                
            # Verify this is the right serial number
            if lines[pos].strip() != serial:
                print str(serial) + ". [Serial mismatch at line " + str(pos) + "]"
                continue
            
            soldier_data = {
                'name': '',
                'sit_up_reps': 0,
                'push_up_reps': 0,
                'run_time': ''
            }
            
            # Extract name at pos+2
            if pos + 2 < len(lines):
                name_line = lines[pos + 2].strip()
                soldier_data['name'] = name_line.replace('PTE', '').strip()
            
            # Extract performance data:
            # Soldier 1 has: pos+7: sit-ups, pos+8: push-ups, pos+9: run (pos+6 is tag)
            # Soldiers 2-10 have: pos+6: sit-ups, pos+7: push-ups, pos+8: run
            
            if serial == '1':
                # Soldier 1 pattern
                # Sit-ups
                if pos + 7 < len(lines):
                    situp_line = lines[pos + 7].strip()
                    if re.match(r'^\d+$', situp_line):
                        soldier_data['sit_up_reps'] = int(situp_line)
                
                # Push-ups
                if pos + 8 < len(lines):
                    pushup_line = lines[pos + 8].strip()
                    if re.match(r'^\d+$', pushup_line):
                        soldier_data['push_up_reps'] = int(pushup_line)
                
                # Run time
                if pos + 9 < len(lines):
                    run_line = lines[pos + 9].strip()
                    if re.match(r'^\d{1,2}:\d{2}$', run_line):
                        soldier_data['run_time'] = run_line
            else:
                # Soldiers 2-10 pattern
                # Sit-ups
                if pos + 6 < len(lines):
                    situp_line = lines[pos + 6].strip()
                    if re.match(r'^\d+$', situp_line):
                        soldier_data['sit_up_reps'] = int(situp_line)
                
                # Push-ups
                if pos + 7 < len(lines):
                    pushup_line = lines[pos + 7].strip()
                    if re.match(r'^\d+$', pushup_line):
                        soldier_data['push_up_reps'] = int(pushup_line)
                
                # Run time
                if pos + 8 < len(lines):
                    run_line = lines[pos + 8].strip()
                    if re.match(r'^\d{1,2}:\d{2}$', run_line):
                        soldier_data['run_time'] = run_line
            
            # Only add if we have a name
            if soldier_data['name']:
                soldiers.append(soldier_data)
                
                print str(serial) + ". " + soldier_data['name']
                print "   Sit-ups: " + str(soldier_data['sit_up_reps']) + " reps"
                print "   Push-ups: " + str(soldier_data['push_up_reps']) + " reps"
                print "   Run: " + soldier_data['run_time']
                print ""
            else:
                print str(serial) + ". [No name found]"
                print ""
        
        except Exception as e:
            print str(serial) + ". [Error: " + str(e) + "]"
            print ""
    
    # Create result
    result = {
        'soldiers': soldiers
    }
    
    # Export to JSON
    output_file = 'all_soldiers_final.json'
    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)
    
    print "=" * 50
    print "FINAL SUMMARY:"
    print "People parsed: " + str(len(soldiers))
    print "Data exported to: " + output_file
    print "=" * 50
    
    return result

if __name__ == "__main__":
    result = parse_all_soldiers_correctly('/Users/kyle/Downloads/IMG_3031.jpeg.json')
