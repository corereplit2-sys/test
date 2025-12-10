import React, { useState } from 'react';

interface IpptResultInputProps {
  sessionId?: string;
  onSaveComplete?: () => void;
}

interface CustomModelResult {
  name: string;
  sit_up_reps: number;
  push_up_reps: number;
  run_time: string;
  confidence: number;
}

interface CustomModelResponse {
  soldiers: CustomModelResult[];
  total_soldiers: number;
  model_used: string;
}

export function IpptResultInputWithCustomModel({ sessionId, onSaveComplete }: IpptResultInputProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [customModelResults, setCustomModelResults] = useState<CustomModelResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const extractWithCustomModel = async (imageFile: File): Promise<CustomModelResponse> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    try {
      const response = await fetch('/api/custom-azure-form-recognizer', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Custom model extraction error:', error);
      throw error;
    }
  };

  const handleCustomModelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setError(null);
    setScanProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setScanProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await extractWithCustomModel(file);
      
      clearInterval(progressInterval);
      setScanProgress(100);
      
      if (result.soldiers && result.soldiers.length > 0) {
        setCustomModelResults(result.soldiers);
        console.log('Custom model extracted soldiers:', result.soldiers);
      } else {
        setError('No soldiers detected in the image');
      }
    } catch (error) {
      setError(`Custom model extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanProgress(0), 1000);
    }
  };

  const addSoldiersToConduct = async () => {
    if (customModelResults.length === 0) return;

    try {
      // Match soldiers to users and add to conduct session
      const participants = [];
      
      for (const soldier of customModelResults) {
        // Find user by name (you might want to add NRIC matching too)
        const userResponse = await fetch(`/api/users/search?name=${encodeURIComponent(soldier.name)}`);
        const users = await userResponse.json();
        
        if (users.length > 0) {
          const user = users[0];
          
          // Calculate IPPT score using backend API
          const scoreResponse = await fetch('/api/ippt/calculate-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sit_up_reps: soldier.sit_up_reps,
              push_up_reps: soldier.push_up_reps,
              run_time: soldier.run_time,
              age: user.age || 25, // Default age if not available
              gender: user.gender || 'male'
            })
          });
          
          const scoreData = await scoreResponse.json();
          
          participants.push({
            user_id: user.id,
            name: soldier.name,
            sit_up_reps: soldier.sit_up_reps,
            push_up_reps: soldier.push_up_reps,
            run_time: soldier.run_time,
            points: scoreData.points,
            award: scoreData.award,
            confidence: soldier.confidence
          });
        } else {
          console.warn(`User not found for: ${soldier.name}`);
        }
      }

      // Save all participants to the conduct session
      if (participants.length > 0) {
        await fetch(`/api/ippt/sessions/${sessionId}/participants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participants })
        });
        
        onSaveComplete?.();
        setCustomModelResults([]);
      } else {
        setError('No matching users found for extracted soldiers');
      }
    } catch (error) {
      setError(`Failed to add soldiers to conduct: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Custom Model Upload Section */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold mb-4">Custom Model OCR Scanning</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload IPPT Sheet for Custom Model Extraction
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleCustomModelUpload}
              disabled={isScanning}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {isScanning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Extracting with custom model...</span>
                <span>{scanProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Custom Model Results */}
      {customModelResults.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Extracted Soldiers ({customModelResults.length})
            </h3>
            <button
              onClick={addSoldiersToConduct}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Add All to Conduct
            </button>
          </div>

          <div className="space-y-3">
            {customModelResults.map((soldier, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{soldier.name}</h4>
                    <div className="mt-2 text-sm text-gray-600 space-y-1">
                      <div>Sit-ups: <span className="font-medium">{soldier.sit_up_reps} reps</span></div>
                      <div>Push-ups: <span className="font-medium">{soldier.push_up_reps} reps</span></div>
                      <div>Run time: <span className="font-medium">{soldier.run_time}</span></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Confidence</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {Math.round(soldier.confidence * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
