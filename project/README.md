---
title: SocioLift Interface
emoji: 🎓
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# SocioLift Interface - AI Avatar Kiosk for School of Sciences

This is a Flask-based web application that uses computer vision (DeepFace, MobileNetV2) to detect user gender and attire from a webcam feed and display a personalized avatar greeting.

## Features
- **Gender Detection**: Uses DeepFace to detect if the user is Male or Female.
- **Attire Detection**: Uses MobileNetV2 to classify attire as 'Traditional' or 'Suit'.
- **Dynamic Greeting**: Displays a random welcome message and speaks it aloud.
- **Interactive Avatar**: An animated owl guides the user, and a specific avatar (based on detection) greets them.
- **Agenda & Details**: Shows the event agenda and a QR code for delegate details.

## How to Run Locally
1. Clone the repository.
2. Install dependencies: `pip install -r requirements.txt`.
3. Run the app: `python app.py`.
4. Open `http://localhost:7860` in your browser.

## Deployment on Hugging Face Spaces
This space is configured to run using Docker.

**Note**: The first run might take a few minutes as it downloads the DeepFace and MobileNet models.
