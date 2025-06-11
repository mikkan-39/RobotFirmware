import argparse
import json
import numpy as np
import os
import zmq
from picamera2 import Picamera2
from picamera2.devices import Hailo
import libcamera
import threading
import time

# Shared state
latest_detections = []
detections_lock = threading.Lock()
exit_event = threading.Event()

# Get the directory of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))

# Build the full path to `coco.txt`
labels_path = os.path.join(script_dir, 'coco.txt')

# Custom encoder for NumPy float32
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.float32):
            return float(obj)
        return super().default(obj)

def extract_detections(hailo_output, w, h, class_names, threshold=0.5):
    results = []
    for class_id, detections in enumerate(hailo_output):
        for detection in detections:
            score = detection[4]
            if score >= threshold:
                y0, x0, y1, x1 = detection[:4]
                bbox = (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
                results.append([class_names[class_id], bbox, score])
    return results

def listen_for_requests():
    ctx = zmq.Context()
    sock = ctx.socket(zmq.REP)
    sock.bind("tcp://127.0.0.1:5836")
    print("ZMQ: Listening on tcp://127.0.0.1:5836")

    while not exit_event.is_set():
        try:
            msg = sock.recv_json(flags=zmq.NOBLOCK)
        except zmq.Again:
            time.sleep(0.005)
            continue

        method = msg.get("method")
        if method == "PING":
            sock.send_json({"ok": True})

        elif method == "READ_CAMERA":
            with detections_lock:
                sock.send_json(latest_detections, cls=NumpyEncoder)

        elif method == "EXIT":
            sock.send_json({"ok": True})
            print("ZMQ: Received EXIT, shutting down.")
            exit_event.set()

        else:
            sock.send_json({"error": "Unknown method"})

if __name__ == "__main__":
    print("INIT: Python subsystem started.")

    parser = argparse.ArgumentParser(description="Detection Example")
    parser.add_argument("-m", "--model", help="Path for the HEF model.",
                        default="/usr/share/hailo-models/yolov8s_h8l.hef")
    parser.add_argument("-l", "--labels", default=labels_path,
                        help="Path to a text file containing labels.")
    parser.add_argument("-s", "--score_thresh", type=float, default=0.5,
                        help="Score threshold, must be a float between 0 and 1.")
    parser.add_argument("-x", "--width", type=int, default=1920,
                        help="Camera image width.")
    parser.add_argument("-y", "--height", type=int, default=1080,
                        help="Camera image height.")
    args = parser.parse_args()

    # === Start ZMQ request handler thread ===
    zmq_thread = threading.Thread(target=listen_for_requests, daemon=True)
    zmq_thread.start()

    # === Start Hailo + Picamera2 detection loop ===
    with Hailo(args.model) as hailo:
        model_h, model_w, _ = hailo.get_input_shape()
        video_w, video_h = args.width, args.height

        with Picamera2() as picam2:
            main = {'size': (video_w, video_h), 'format': 'XRGB8888'}
            lores = {'size': (model_w, model_h), 'format': 'RGB888'}
            controls = {'FrameRate': 30}
            config = picam2.create_preview_configuration(
                main, lores=lores, controls=controls,
                transform=libcamera.Transform(hflip=1, vflip=1)
            )
            picam2.configure(config)
            picam2.start()

            while not exit_event.is_set():
                try:
                    frame = picam2.capture_array('lores')
                    results = hailo.run(frame)
                    new_detections = extract_detections(results, video_w, video_h, class_names, args.score_thresh)

                    with detections_lock:
                        latest_detections = new_detections

                    time.sleep(0.01)  # Tune based on CPU usage
                except Exception as e:
                    print("ERROR during detection loop:", e)

    print("SHUTDOWN: Python subsystem exited.")
