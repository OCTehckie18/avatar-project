import base64
import os
import cv2
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, render_template
import logging
from deepface import DeepFace
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2, preprocess_input, decode_predictions
from tensorflow.keras.preprocessing import image


# Avatars
# Indianish avatars
"""
image should be really big
words can be small

"""

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# --- Configuration ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AVATAR_DIR = os.path.join(BASE_DIR, 'static', 'avatars')
MODEL_PATH = 'mobilenet_v2_weights_tf_dim_ordering_tf_kernels_1.0_224.h5'

# --- Load Models ---
# MobileNetV2 for attire (Standard ImageNet weights)
# We load it globally to avoid reloading on every request
try:
    print("Loading MobileNetV2 for attire classification...")
    attire_model = MobileNetV2(weights='imagenet')
    print("MobileNetV2 loaded successfully.")
except Exception as e:
    print(f"Error loading MobileNetV2: {e}")
    attire_model = None

# DeepFace loads models automatically on first run, but we can warm it up if needed.
# For simplicity, we'll let it handle itself.
# Note: DeepFace might download weights on first run.

# --- Helper Functions ---

def analyze_attire(img_array, gender):
    """
    Classifies attire intelligently based on gender using MobileNetV2.
    It checks top 5 predictions for keywords associated with the new avatars.
    """
    if attire_model is None:
        return "shirt" # Fallback
    
    try:
        # Resize image to 224x224 for MobileNetV2
        img_resized = cv2.resize(img_array, (224, 224))
        img_expanded = np.expand_dims(img_resized, axis=0)
        img_preprocessed = preprocess_input(img_expanded.astype(float))

        preds = attire_model.predict(img_preprocessed)
        decoded = decode_predictions(preds, top=5)[0] # Top 5 predictions

        # Keywords lists
        suit_keywords = [
            'suit', 'groom', 'tuxedo', 'bow_tie', 'tie', 'Windsor_tie', 
            'trench_coat', 'academic_gown', 'mortarboard', 'blazer', 'vest'
        ]
        
        saree_keywords = ['sari', 'saree', 'wrap']

        traditional_keywords = [
            'gown', 'kimono', 'stole', 'poncho', 'cloak', 'vestment', 
            'pajama', 'sarong', 'velvet', 'wool', 'abaya', 'kurta',
            'sari', 'saree', 'wrap' # In case of male prediction, fallback to traditional
        ]

        casual_keywords = [
            'jersey', 't-shirt', 'sweatshirt', 'cardigan', 'swimming_trunks', 
            'jean', 'miniskirt', 'hoopskirt', 'sweatpants'
        ]

        print(f"Attire predictions: {decoded}")

        for _, label, score in decoded:
            label_lower = label.lower()
            
            # Saree check for females
            if gender == 'female' and any(keyword in label_lower for keyword in saree_keywords):
                if score > 0.03: 
                    return "saree"
            
            # Suit check for both
            if any(keyword in label_lower for keyword in suit_keywords):
                if score > 0.03: 
                    return "suit"
                    
            # Traditional check
            if any(keyword in label_lower for keyword in traditional_keywords):
                if score > 0.03:
                    return "traditional"
            
            # Casual check
            if any(keyword in label_lower for keyword in casual_keywords):
                if score > 0.03:
                    return "casual" if gender == 'male' else "shirt"
        
        # Default fallback
        return "shirt"
    except Exception as e:
        print(f"Error in attire analysis: {e}")
        return "shirt"

def analyze_gender(img_path):
    """
    Detects gender using DeepFace.
    Returns 'Male' or 'Female'.
    """
    try:
        # DeepFace expects a path or numpy array. We can pass numpy array directly if supported,
        # otherwise we save to temp file. DeepFace supports numpy arrays (BGR).
        # However, to be safe and avoid BGR/RGB confusion, passing path is often robust.
        # But for speed, let's try passing the array (RGB).
        
        # DeepFace.analyze returns a list of dicts
        objs = DeepFace.analyze(img_path = img_path, 
                                actions = ['gender'],
                                enforce_detection = False, # Don't crash if no face
                                silent=True)
        
        if len(objs) > 0:
            gender = objs[0]['dominant_gender']
            # DeepFace returns 'Man' or 'Woman'. We need 'male' or 'female' for our filenames
            if gender == 'Man':
                return 'male'
            elif gender == 'Woman':
                return 'female'
        
        return 'male' # Default fallback
    except Exception as e:
        print(f"Error in gender analysis: {e}")
        return 'male' # Fallback

def get_random_message():
    """
    Reads a random message from messages.xlsx.
    Expected format: 1 column named 'message'.
    """
    try:
        file_path = os.path.join(BASE_DIR, 'messages.xlsx')
        if not os.path.exists(file_path):
            return "Welcome to Christ University."
        
        df = pd.read_excel(file_path)
        if df.empty or 'message' not in df.columns:
             return "Welcome to Christ University."
             
        random_row = df.sample(n=1)
        return random_row['message'].values[0]
    except Exception as e:
        print(f"Error reading messages.xlsx: {e}")
        return "Welcome to Christ University."

# --- Routes ---

# Global attributes for Kiosk Wave Polling
prev_hand_frame = None
wave_motion_score = 0
wave_cooldown = 0
is_processing_wave = False

@app.route('/detect_wave', methods=['POST'])
def detect_wave():
    global prev_hand_frame, wave_motion_score, wave_cooldown, is_processing_wave
    
    if is_processing_wave:
        return jsonify({'wave': False})

    if wave_cooldown > 0:
        wave_cooldown -= 1
        return jsonify({'wave': False})

    try:
        data = request.json
        image_data = data.get('image')
        if not image_data: return jsonify({'wave': False})

        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img_bgr is None: return jsonify({'wave': False})

        # --- Deep Level OpenCV Motion Tracking Strategies ---
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        if prev_hand_frame is None:
            prev_hand_frame = gray
            return jsonify({'wave': False})

        frame_delta = cv2.absdiff(prev_hand_frame, gray)
        _, thresh = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)
        thresh = cv2.dilate(thresh, None, iterations=2)
        
        contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        motion_detected = False
        for contour in contours:
            # Significant area threshold validates local, large frame-bursts (like an active hand waving)
            if cv2.contourArea(contour) > 5000:
                motion_detected = True
                break
                
        if motion_detected:
            wave_motion_score += 1
        else:
            wave_motion_score = max(0, wave_motion_score - 1)
            
        prev_hand_frame = gray
        
        # Consistent massive hand motion across 4 frames -> Verified Wave
        if wave_motion_score >= 4:
            wave_motion_score = 0
            wave_cooldown = 15 # Wait frames
            is_processing_wave = True
            return jsonify({'wave': True})

        return jsonify({'wave': False})

    except Exception as e:
        print(f"Error in deep wave detection: {e}")
        return jsonify({'wave': False})

@app.route('/wave_reset', methods=['POST'])
def wave_reset():
    global is_processing_wave, wave_motion_score, prev_hand_frame
    is_processing_wave = False
    wave_motion_score = 0
    prev_hand_frame = None
    return jsonify({'status': 'reset'})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        image_data = data.get('image')
        user_name = data.get('name', '')
        user_name = user_name.strip() if user_name else ''

        if not image_data:
            return jsonify({'error': 'No image provided'}), 400

        # Decode base64 image
        # Remove header if present "data:image/jpeg;base64,"
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img_bgr is None:
            return jsonify({'error': 'Failed to decode image'}), 400
            
        # Ensure RGB for DeepFace/MobileNet
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        # Save temp file for DeepFace (sometimes more reliable with paths)
        temp_filename = "temp_capture.jpg"
        cv2.imwrite(temp_filename, img_bgr) # Save BGR for OpenCV read compatibility

        # --- Gender Detection ---
        # DeepFace works well with file paths, so run this first
        gender = analyze_gender(temp_filename)

        if not user_name:
            user_name = "Sir" if gender == 'male' else "Ma'am"

        # --- Attire Classification ---
        # Evaluate attire using the detected gender
        attire = analyze_attire(img_rgb, gender)

        # Clean up temp file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

        # --- Get Random Message ---
        welcome_message = get_random_message()

        print(f"Analysis Result: Gender={gender}, Attire={attire}")

        return jsonify({
            'name': user_name,
            'gender': gender,
            'attire': attire,
            'message': welcome_message
        })

    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({
            'name': user_name,
            'gender': 'male', # Failsafe
            'attire': 'shirt', # Failsafe
            'message': "Welcome to Christ University."
        }), 200 # Return 200 with default to not break frontend flow

if __name__ == '__main__':
    # Ensure static directories exist
    os.makedirs(AVATAR_DIR, exist_ok=True)
    port = int(os.environ.get('PORT', 7860))
    app.run(debug=False, host='0.0.0.0', port=port)
