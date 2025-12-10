# Azure Form Recognizer Custom Model Setup for IPPT

## Overview
This setup uses Azure Form Recognizer with a custom trained model to extract IPPT data from scanned sheets.

## Prerequisites
- Azure Account with Form Recognizer resource
- Trained custom model for IPPT forms
- Python 3.7+
- Node.js 14+

## Setup Steps

### 1. Azure Form Recognizer Setup

```bash
# Install Azure CLI
pip install azure-cli

# Login to Azure
az login

# Create Form Recognizer resource
az cognitiveservices account create \
    --name your-ippt-form-recognizer \
    --resource-group your-resource-group \
    --kind FormRecognizer \
    --sku S0 \
    --location eastus

# Get endpoint and key
az cognitiveservices account keys list \
    --name your-ippt-form-recognizer \
    --resource-group your-resource-group
```

### 2. Train Custom Model

1. **Prepare Training Data**
   - Create folder structure: `training_data/labels/`
   - Add 5+ IPPT form images as `.jpg` or `.png`
   - Create corresponding `.json` label files

2. **Label Training Data**
```json
// training_data/labels/form1.json
{
  "document": "form1.jpg",
  "fields": {
    "soldier_name": {
      "value": "ALLOYSIUS GOH WEI JIE",
      "boundingBox": [100, 50, 200, 80]
    },
    "sit_up_reps": {
      "value": "10",
      "boundingBox": [300, 50, 350, 80]
    },
    "push_up_reps": {
      "value": "1011", 
      "boundingBox": [400, 50, 450, 80]
    },
    "run_time": {
      "value": "10:20",
      "boundingBox": [500, 50, 550, 80]
    }
  }
}
```

3. **Train Model**
```python
from azure.ai.formrecognizer import FormTrainingClient

form_training_client = FormTrainingClient(
    endpoint=endpoint,
    credential=AzureKeyCredential(key)
)

# Train model
training_data = "training_data/"
poller = form_training_client.begin_training(
    training_data, 
    use_training_labels=True
)

model = poller.result()
print("Model ID:", model.model_id)
print("Training completed:", model.status)
```

### 3. Backend Setup

```bash
# Install dependencies
pip install flask azure-ai-formrecognizer werkzeug

# Set environment variables
export AZURE_FORM_RECOGNIZER_ENDPOINT="your-endpoint"
export AZURE_FORM_RECOGNIZER_KEY="your-key"  
export IPPT_MODEL_ID="your-model-id"

# Start API server
python api/custom-azure-form-recognizer.py
```

### 4. Frontend Integration

```typescript
// Add to your IPPT tracker
import { IpptResultInputWithCustomModel } from './components/ippt/IpptResultInputWithCustomModel';

// Use in your component
<IpptResultInputWithCustomModel 
  sessionId={sessionId} 
  onSaveComplete={handleSaveComplete} 
/>
```

## Field Names for Custom Model

Your custom model should be trained to recognize these fields:

### Required Fields:
- `soldier_name` - Soldier's full name
- `sit_up_reps` - Number of sit-up repetitions
- `push_up_reps` - Number of push-up repetitions  
- `run_time` - Run time in MM:SS format

### Optional Fields:
- `nric` - Soldier's NRIC number
- `unit` - Unit designation
- `age` - Age
- `gender` - Gender

## API Endpoints

### POST /api/custom-azure-form-recognizer
Extract IPPT data using custom model

**Request:**
```
Content-Type: multipart/form-data
image: [file]
```

**Response:**
```json
{
  "soldiers": [
    {
      "name": "ALLOYSIUS GOH WEI JIE",
      "sit_up_reps": 10,
      "push_up_reps": 1011,
      "run_time": "10:20",
      "confidence": 0.95
    }
  ],
  "total_soldiers": 1,
  "model_used": "your-model-id",
  "success": true
}
```

### GET /api/health
Health check endpoint

## Benefits of Custom Model

1. **Higher Accuracy** - Trained specifically for IPPT forms
2. **ROI-based Extraction** - Uses spatial regions, not line positions
3. **Consistent Results** - Handles layout variations better
4. **Confidence Scores** - Provides extraction confidence
5. **Scalable** - Can handle multiple form layouts

## Testing

```bash
# Test the API
curl -X POST \
  http://localhost:5000/api/custom-azure-form-recognizer \
  -F 'image=@/path/to/ippt-form.jpg'
```

## Troubleshooting

### Common Issues:
1. **Model Not Found** - Check model_id is correct
2. **Low Confidence** - Add more training data
3. **Missing Fields** - Verify field names match training
4. **API Errors** - Check endpoint/key are valid

### Debug Mode:
```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Production Deployment

1. **Use Azure App Service** or **Azure Functions**
2. **Set up CORS** for your frontend domain
3. **Add authentication** to protect the API
4. **Monitor performance** with Azure Monitor
5. **Set up alerts** for failed extractions

## Next Steps

1. Train your custom model with 5+ IPPT forms
2. Test with various form layouts
3. Integrate with your IPPT tracker
4. Monitor extraction accuracy
5. Retrain model with new data as needed
