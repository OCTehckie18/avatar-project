# Deployment Guide

Since this project uses heavy Machine Learning libraries (TensorFlow, DeepFace), standard static hosting like Netlify won't work for the backend.

**The best free option for students is Hugging Face Spaces.**

## Option 1: Hugging Face Spaces (Recommended)
1.  **Create a Hugging Face Account**: Go to [huggingface.co](https://huggingface.co/).
2.  **Create a New Space**:
    *   Click "New Space".
    *   Name: `avatar-kiosk` (or similar).
    *   License: MIT.
    *   **SDK**: Select **Docker**.
    *   **Template**: Blank.
    *   Privacy: Public.
3.  **Upload Code**:
    *   You can upload files manually or push via Git.
    *   **Since you have this code in a Git repo**, simply add the Hugging Face Space as a remote:
        ```bash
        git remote add space https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME
        git push space main
        ```
    *   **IMPORTANT**: When it asks for your **Username** and **Password**:
        *   **Username**: Your Hugging Face username.
        *   **Password**: DO NOT use your account password. You MUST use an **Access Token**.
        *   Go to [Settings -> Access Tokens](https://huggingface.co/settings/tokens), create a **Write** token, and paste that as your password.
4.  **Wait for Build**: The first build will take a few minutes as it installs TensorFlow.
5.  **Done**: Your app will be live at `https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME`.

## Option 2: Render.com
1.  Push your code to **GitHub**.
2.  Go to [dashboard.render.com](https://dashboard.render.com/).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repo.
5.  **Runtime**: Python 3.
6.  **Build Command**: `pip install -r project/requirements.txt`
7.  **Start Command**: `gunicorn project.app:app`
8.  **Free Tier Note**: Render's free tier has low RAM (512MB). TensorFlow might crash it. If so, use Hugging Face Spaces.

## Option 3: Local Demo (Failsafe)
If cloud deployment fails due to model size or slow internet:
1.  Run `python project/app.py` locally.
2.  Use **ngrok** to share it if needed: `ngrok http 5000`.
