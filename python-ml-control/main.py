import sys
import argparse
import json
import numpy as np

# import cv2
from picamera2 import Picamera2
from picamera2.devices import Hailo
import libcamera

# Custom encoder for NumPy float32
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.float32):
            return float(obj)  # Convert np.float32 to Python float
        return super().default(obj)


def extract_detections(hailo_output, w, h, class_names, threshold=0.5):
    """Extract detections from the HailoRT-postprocess output."""
    results = []
    for class_id, detections in enumerate(hailo_output):
        for detection in detections:
            score = detection[4]
            if score >= threshold:
                y0, x0, y1, x1 = detection[:4]
                bbox = (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
                results.append([class_names[class_id], bbox, score])
    return results

def handle_command(command):
    if command == "PING":
        print("PING: Ping acknowledged by Python.")
    elif command == "EXIT":
        print("EXIT: Exiting Python...")
    else:
        print(f"ERROR: Unknown command to Python: {command}")

if __name__ == "__main__":
    print("INIT: Python subsystem started.")

    # Parse command-line arguments.
    parser = argparse.ArgumentParser(description="Detection Example")
    parser.add_argument("-m", "--model", help="Path for the HEF model.",
                        default="/usr/share/hailo-models/yolov8s_h8l.hef")
    parser.add_argument("-l", "--labels", default="../python-ml-control/coco.txt",
                        help="Path to a text file containing labels.")
    parser.add_argument("-s", "--score_thresh", type=float, default=0.5,
                        help="Score threshold, must be a float between 0 and 1.")
    parser.add_argument("-x", "--width", type=int, default=1920,
                        help="Camera image width.")
    parser.add_argument("-y", "--height", type=int, default=1080,
                        help="Camera image height.")
    args = parser.parse_args()


    # Get the Hailo model, the input size it wants, and the size of our preview stream.
    with Hailo(args.model) as hailo:
        model_h, model_w, _ = hailo.get_input_shape()
        video_w, video_h = args.width, args.height

        # Load class names from the labels file
        with open(args.labels, 'r', encoding="utf-8") as f:
            class_names = f.read().splitlines()

        # The list of detected objects to draw.
        detections = None

        # Configure and start Picamera2.
        with Picamera2() as picam2:
            main = {'size': (video_w, video_h), 'format': 'XRGB8888'}
            lores = {'size': (model_w, model_h), 'format': 'RGB888'}
            controls = {'FrameRate': 30}
            config = picam2.create_preview_configuration(main, lores=lores, controls=controls, transform=libcamera.Transform(hflip=1, vflip=1))
            picam2.configure(config)
            # picam2.start_preview(Preview.QTGL, x=0, y=0, width=video_w, height=video_h)
            picam2.start()

            while True:
                # Read command from stdin
                command = sys.stdin.readline().strip()
                if command == "READ_CAMERA":
                    # Image detection
                    frame = picam2.capture_array('lores')
                    results = hailo.run(frame)
                    detections = extract_detections(results, video_w, video_h, class_names, args.score_thresh)
                    print("READ_CAMERA: " + json.dumps(detections, cls=NumpyEncoder))

                elif command:
                    handle_command(command)
                    if command == "EXIT":
                        break

