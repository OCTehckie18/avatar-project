import base64
import os
import cv2
import numpy as np
from flask import Flask, request, jsonify, render_template
import logging
from deepface import DeepFace
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2, preprocess_input, decode_predictions
from tensorflow.keras.preprocessing import image

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

def analyze_attire(img_array):
    """
    Classifies attire as 'formal_suit' or 'casual' using MobileNetV2.
    It checks top 5 predictions for suit-related keywords.
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
            'trench_coat', 'academic_gown', 'mortarboard', 'blazer'
        ]
        
        traditional_keywords = [
            'gown', 'kimono', 'sari', 'saree', 'stole', 'poncho', 
            'cloak', 'vestment', 'pajama', 'sarong', 'velvet', 'wool'
        ]

        print(f"Attire predictions: {decoded}")

        for _, label, score in decoded:
            label_lower = label.lower()
            if any(keyword in label_lower for keyword in suit_keywords):
                if score > 0.05: 
                    return "suit"
            if any(keyword in label_lower for keyword in traditional_keywords):
                if score > 0.05:
                    return "traditional"
        
        # Default to 'shirt' (casual) if no strong suit/traditional signal
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

# --- Routes ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        image_data = data.get('image')
        user_name = data.get('name', 'Guest')

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

        # --- Attire Classification ---
        attire = analyze_attire(img_rgb)
        
        # --- Gender Detection ---
        # DeepFace works well with file paths
        gender = analyze_gender(temp_filename)

        # Clean up temp file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

        print(f"Analysis Result: Gender={gender}, Attire={attire}")

        return jsonify({
            'name': user_name,
            'gender': gender,
            'attire': attire
        })

    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({
            'name': user_name,
            'gender': 'male', # Failsafe
            'attire': 'shirt' # Failsafe
        }), 200 # Return 200 with default to not break frontend flow

if __name__ == '__main__':
    # Ensure static directories exist
    os.makedirs(AVATAR_DIR, exist_ok=True)
    port = int(os.environ.get('PORT', 7860))
    app.run(debug=True, host='0.0.0.0', port=port)
