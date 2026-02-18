# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Install system dependencies for OpenCV
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY project/requirements.txt /app/requirements.txt

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /app
COPY project /app/project

# Generate avatars during build
RUN python project/create_assets.py

# Make port 7860 available to the world outside this container
EXPOSE 7860

# Define environment variable
ENV PORT=7860

# Run gunicorn when the container launches
# Hugging Face Spaces expects the app at port 7860
CMD ["gunicorn", "--bind", "0.0.0.0:7860", "project.app:app"]
