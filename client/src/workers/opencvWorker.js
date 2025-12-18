// OpenCV Worker - Load OpenCV in separate thread to prevent UI freezing
let cv = null;

// Load OpenCV in worker thread
async function loadOpenCV() {
  if (cv) return cv;

  try {
    // Import OpenCV.js
    importScripts("https://docs.opencv.org/4.5.0/opencv.js");

    // Wait for OpenCV to be ready
    return new Promise((resolve, reject) => {
      const checkCV = () => {
        // In Web Worker, OpenCV attaches to self
        if (typeof self !== "undefined" && self.cv && self.cv.Mat) {
          cv = self.cv;
          console.log("OpenCV loaded successfully in worker");
          resolve(cv);
        } else {
          setTimeout(checkCV, 100);
        }
      };
      checkCV();

      // Timeout after 10 seconds
      setTimeout(() => reject(new Error("OpenCV loading timeout")), 10000);
    });
  } catch (error) {
    throw new Error("Failed to load OpenCV: " + error.message);
  }
}

// Handle messages from main thread
self.onmessage = async function (e) {
  const { type, data } = e.data;

  try {
    switch (type) {
      case "LOAD_OPENCV":
        const opencv = await loadOpenCV();
        self.postMessage({ type: "OPENCV_LOADED", success: true });
        break;

      case "PROCESS_IMAGE":
        if (!cv) {
          throw new Error("OpenCV not loaded yet");
        }

        // Process image with OpenCV (biggest contour detection)
        const { imageData, width, height } = data;
        const result = processImageData(cv, imageData, width, height);
        self.postMessage({ type: "PROCESS_RESULT", success: true, result });
        break;

      default:
        throw new Error("Unknown message type");
    }
  } catch (error) {
    console.error("Worker error:", error);
    self.postMessage({ type: "ERROR", success: false, error: error.message });
  }
};

function processImageData(cv, imageData, width, height) {
  try {
    // Create ImageData from buffer
    const imageDataObj = new ImageData(new Uint8ClampedArray(imageData), width, height);

    // Create OpenCV Mat from image data
    const img = cv.matFromImageData(imageDataObj);

    // Convert to grayscale
    const imgGray = new cv.Mat();
    cv.cvtColor(img, imgGray, cv.COLOR_RGBA2GRAY);

    // Gaussian blur
    const imgBlur = new cv.Mat();
    cv.GaussianBlur(imgGray, imgBlur, new cv.Size(5, 5), 1);

    // Canny edge detection
    const imgThreshold = new cv.Mat();
    cv.Canny(imgBlur, imgThreshold, 200, 200);

    // Dilation and erosion
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    const imgDial = new cv.Mat();
    cv.dilate(imgThreshold, imgDial, kernel, new cv.Point(-1, -1), 2);
    cv.erode(imgDial, imgThreshold, kernel, new cv.Point(-1, -1), 1);

    // Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(imgThreshold, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Find biggest contour
    let biggest = null;
    let maxArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area > 5000) {
        const peri = cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.02 * peri, true);

        if (area > maxArea && approx.rows === 4) {
          if (biggest) biggest.delete();
          biggest = approx;
          maxArea = area;
        } else {
          approx.delete();
        }
      }
      contour.delete();
    }

    // Extract contour points if found
    let contourPoints = null;
    if (biggest && biggest.rows > 0) {
      contourPoints = {
        points: Array.from(biggest.data32S),
        area: maxArea,
      };
      biggest.delete();
    }

    // Cleanup
    img.delete();
    imgGray.delete();
    imgBlur.delete();
    imgThreshold.delete();
    imgDial.delete();
    kernel.delete();
    contours.delete();
    hierarchy.delete();

    return {
      contourFound: contourPoints !== null,
      contour: contourPoints,
    };
  } catch (error) {
    console.error("Error processing image:", error);
    return {
      contourFound: false,
      contour: null,
    };
  }
}
