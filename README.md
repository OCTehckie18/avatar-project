---
title: Avatar Kiosk Christ
emoji: 🎥
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# Event Welcome Kiosk

A minimal, local web application for an event welcome kiosk. It captures a webcam image, detects gender and attire (formal/casual), and displays a personalized welcome message with a corresponding avatar.

## Setup Instructions

1.  **Install Python Dependencies**:
    ```bash
    cd project
    pip install -r requirements.txt
    ```

2.  **Generate Assets**:
    Run the asset generator to create the required avatar images (placeholders):
    ```bash
    python ../create_assets.py
    ```
    *Note: If you have your own "better" images, replace them in `project/static/avatars/`: `male_formal.png`, `male_casual.png`, `female_formal.png`, `female_casual.png`.*

3.  **Run the Application**:
    ```bash
    python app.py
    ```
    *Note: The first time you run this, DeepFace and MobileNetV2 will download model weights. This may take a few minutes.*

4.  **Usage**:
    *   Open your browser (or use the provided link in terminal, usually `http://127.0.0.1:5000`).
    *   Enter your name.
    *   Stand in front of the camera.
    *   Click "Generate Welcome".
    *   The system will display the welcome message on a full screen.
    *   Connect via HDMI to the external monitor for the kiosk display.

## Tech Stack
*   **Frontend**: HTML, CSS, JavaScript (Vanilla)
*   **Backend**: Python Flask
*   **AI/ML**: DeepFace (Gender), MobileNetV2 (Attire Classification)

## Troubleshooting
*   **Camera not working**: Ensure your browser has permission to access the webcam. Use HTTPS or localhost.
*   **Model loading error**: Check internet connection for first-run downloads.
*   **Slow performance**: This runs on CPU. DeepFace detection might take 1-2 seconds.
