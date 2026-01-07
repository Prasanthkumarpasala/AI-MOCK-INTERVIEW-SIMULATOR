import cv2
import mediapipe as mp
import numpy as np
import base64
import os
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

class ProctorAgent:
    def __init__(self):
        # Path is root since main.py runs from backend/
        model_path = os.path.join(os.getcwd(), 'face_detector_full_range.tflite')
        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.FaceDetectorOptions(base_options=base_options)
        self.detector = vision.FaceDetector.create_from_options(options)

    def analyze_frame(self, base64_image):
        try:
            encoded_data = base64_image.split(',')[1]
            nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None: return "INVALID"

            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            res = self.detector.detect(mp_image)

            if not res.detections: return "NO_FACE"
            if len(res.detections) > 1: return "MULTIPLE_PEOPLE"

            bbox = res.detections[0].bounding_box
            center_x = bbox.origin_x + (bbox.width / 2)
            
            # Thresholds for 640px width
            if center_x < 150: return "LOOKING_LEFT"
            if center_x > 490: return "LOOKING_RIGHT"

            return "OK"
        except Exception as e:
            return f"ERROR"