import cv2
import mediapipe as mp
import time, os, subprocess, threading

# Global flag for thread safety
alert_msg = ""

def detection_worker(face_model):
    global alert_msg
    options = mp.tasks.vision.FaceDetectorOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=face_model),
        running_mode=mp.tasks.vision.RunningMode.VIDEO
    )
    detector = mp.tasks.vision.FaceDetector.create_from_options(options)
    
    # Internal camera for the thread
    cap_thread = cv2.VideoCapture(0, cv2.CAP_V4L2)
    cap_thread.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
    cap_thread.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
    cap_thread.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)
    
    ts = 0
    while True:
        success, frame = cap_thread.read()
        if not success: continue
        ts += 1
        
        # Only analyze every 20 frames to save CPU
        if ts % 20 == 0:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            try:
                res = detector.detect_for_video(mp_img, ts)
                if not res.detections: alert_msg = "NO FACE"
                elif len(res.detections) > 1: alert_msg = "MULTIPLE PEOPLE"
                else:
                    bbox = res.detections[0].bounding_box
                    cx = bbox.origin_x + bbox.width/2
                    if cx < 80: alert_msg = "LOOKING LEFT"
                    elif cx > 240: alert_msg = "LOOKING RIGHT"
                    else: alert_msg = ""
            except: pass
        time.sleep(0.01)

def run():
    global alert_msg
    face_model = 'face_detector_full_range.tflite'
    
    # Start AI worker in background
    threading.Thread(target=detection_worker, args=(face_model,), daemon=True).start()
    
    # Main Window Thread
    cap = cv2.VideoCapture(0, cv2.CAP_V4L2)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    while cap.isOpened():
        success, frame = cap.read()
        if not success: continue

        if alert_msg:
            # High-visibility red bar
            cv2.rectangle(frame, (0,0), (640,60), (0,0,255), -1)
            cv2.putText(frame, alert_msg, (50, 45), cv2.FONT_HERSHEY_DUPLEX, 1, (255,255,255), 2)
            # Background beep
            subprocess.Popen("ffplay -f lavfi -i 'sine=frequency=1000:duration=0.1' -nodisp -autoexit -loglevel quiet > /dev/null 2>&1 || true", shell=True)

        cv2.imshow('PROCTORING_SHIELD', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'): break
    
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    run()