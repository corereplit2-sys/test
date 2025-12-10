# ChatGPT Vision OCR Setup Guide

## Overview
This guide shows how to set up ChatGPT Vision OCR for your IPPT tracker, which provides more accurate and reliable OCR extraction compared to traditional OCR services.

## Prerequisites
- OpenAI API key with access to GPT-4 Vision
- Python 3.7+
- Flask installed

## Setup Instructions

### 1. Install Dependencies
```bash
cd /Users/kyle/test-2
pip install -r requirements_chatgpt_vision.txt
```

### 2. Set OpenAI API Key
Create a `.env` file in the `/Users/kyle/test-2` directory:
```bash
OPENAI_API_KEY=your-openai-api-key-here
```

Or set it as environment variable:
```bash
export OPENAI_API_KEY=your-openai-api-key-here
```

### 3. Start the ChatGPT Vision API Server
```bash
cd /Users/kyle/test-2/api
python chatgpt_vision_ocr.py
```

The server will start on `http://localhost:5002`

### 4. Test the API
You can test the API with curl:
```bash
curl -X POST \
  http://localhost:5002/api/chatgpt-vision-ocr \
  -H 'Content-Type: multipart/form-data' \
  -F 'image=@/Users/kyle/Downloads/IMG_3031.jpeg'
```

### 5. Update Frontend Configuration
The React component is already configured to use the ChatGPT Vision API at `/api/chatgpt-vision-ocr`.

## Features

### ChatGPT Vision Advantages:
- **Better OCR Accuracy**: GPT-4 Vision understands context better
- **Intelligent Extraction**: Can handle varied layouts and formatting
- **Error Correction**: Can fix OCR mistakes intelligently
- **Flexible Parsing**: Handles different form layouts
- **Natural Language Understanding**: Better at recognizing military names and ranks

### API Endpoints:
- `POST /api/chatgpt-vision-ocr` - Extract IPPT data from image
- `GET /api/health` - Health check

### Response Format:
```json
{
  "soldiers": [
    {
      "name": "ALLOYSIUS GOH WEI JIE",
      "sit_up_reps": 10,
      "push_up_reps": 20,
      "run_time": "10:20"
    }
  ],
  "total_soldiers": 1,
  "method": "chatgpt_vision",
  "success": true
}
```

## Usage in IPPT Tracker

1. **Upload Image**: Click "Scan Scoresheet" in the IPPT tracker
2. **ChatGPT Processing**: Image is sent to ChatGPT Vision for OCR
3. **Data Extraction**: ChatGPT intelligently extracts soldier data
4. **Review & Edit**: Review extracted data and make corrections if needed
5. **Accumulate**: Scan multiple sheets before finalizing

## Troubleshooting

### Common Issues:
1. **API Key Error**: Make sure your OpenAI API key is valid and has GPT-4 Vision access
2. **Rate Limits**: OpenAI has rate limits - implement retry logic if needed
3. **Image Quality**: ChatGPT Vision works best with clear, high-quality images
4. **Cost**: GPT-4 Vision API calls cost money - monitor usage

### Error Messages:
- `"No image file provided"` - Make sure you're uploading a file
- `"Invalid API key"` - Check your OpenAI API key
- `"Model not found"` - Ensure you have access to GPT-4 Vision

## Cost Considerations

- GPT-4 Vision pricing varies by usage
- Typical IPPT form extraction costs ~$0.01-0.05 per image
- Monitor your OpenAI usage dashboard
- Consider caching results for repeated scans

## Alternative Setup

If you prefer not to run a separate server, you can integrate ChatGPT Vision directly in the React frontend using the OpenAI JavaScript SDK.

## Security Notes

- Keep your OpenAI API key secure
- Don't expose API keys in frontend code
- Use environment variables for sensitive data
- Consider implementing rate limiting on the API

## Next Steps

1. Get your OpenAI API key
2. Install dependencies
3. Start the ChatGPT Vision server
4. Test with your IPPT forms
5. Monitor accuracy and costs

The ChatGPT Vision integration should provide significantly better OCR accuracy for your IPPT tracker!
