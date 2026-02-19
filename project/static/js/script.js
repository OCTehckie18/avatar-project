document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video'); // Webcam
    const owlVideo = document.getElementById('owlVideo'); // Owl Video
    const owlCanvas = document.getElementById('owlCanvas'); // Display Canvas
    const captureCanvas = document.getElementById('canvas'); // Hidden canvas for capture
    const captureBtn = document.getElementById('captureBtn');
    const nameInput = document.getElementById('nameInput');
    const cameraSection = document.getElementById('camera-section');
    const resultSection = document.getElementById('result-section');
    const loadingOverlay = document.getElementById('loading');
    const greetingName = document.getElementById('greetingName');
    const dynamicMessageContent = document.getElementById('dynamicMessageContent');
    const avatarImage = document.getElementById('avatarImage');
    const resetBtn = document.getElementById('resetBtn');

    // Green Screen Logic for Owl
    function setupGreenScreen(videoEl, canvasEl) {
        let animationFrameId;
        const processCtx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        const targetCtx = canvasEl.getContext('2d', { willReadFrequently: true });

        const loop = () => {
            if (videoEl.paused || videoEl.ended) return;

            if (canvasEl.width !== videoEl.videoWidth) {
                canvasEl.width = videoEl.videoWidth;
                canvasEl.height = videoEl.videoHeight;
                processCtx.canvas.width = videoEl.videoWidth;
                processCtx.canvas.height = videoEl.videoHeight;
            }

            // Draw video to offscreen canvas
            processCtx.drawImage(videoEl, 0, 0, processCtx.canvas.width, processCtx.canvas.height);
            const frame = processCtx.getImageData(0, 0, processCtx.canvas.width, processCtx.canvas.height);
            const l = frame.data.length / 4;

            for (let i = 0; i < l; i++) {
                const r = frame.data[i * 4 + 0];
                const g = frame.data[i * 4 + 1];
                const b = frame.data[i * 4 + 2];

                // Target Color: #73B55D => R=115, G=181, B=93
                // Euclidean distance
                const dist = Math.sqrt(
                    Math.pow(r - 115, 2) +
                    Math.pow(g - 181, 2) +
                    Math.pow(b - 93, 2)
                );

                if (dist < 90) { // Threshold for Green Screen
                    frame.data[i * 4 + 3] = 0; // Alpha = 0 (Transparent)
                }
            }
            targetCtx.putImageData(frame, 0, 0);
            animationFrameId = requestAnimationFrame(loop);
        };

        const start = () => {
            if (videoEl.readyState >= 2) {
                videoEl.play().catch(e => console.log("Autoplay fail", e));
                loop();
            } else {
                videoEl.addEventListener('loadeddata', () => {
                    videoEl.play();
                    loop();
                }, { once: true });
            }
        };

        const stop = () => {
            videoEl.pause();
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };

        return { start, stop };
    }

    const owlProcessor = setupGreenScreen(owlVideo, owlCanvas);
    owlProcessor.start();

    // Access Webcam (Silent, for capture only)
    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            // Video is hidden by CSS, but active
        } catch (err) {
            console.error("Error accessing webcam: ", err);
            alert("Could not access webcam. Please allow permissions.");
        }
    }

    startCamera();

    captureBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
            alert("Please enter your name.");
            return;
        }

        // Show loading
        loadingOverlay.classList.remove('hidden');

        // Capture frame from WEBCAM video to hidden canvas
        const context = captureCanvas.getContext('2d');
        captureCanvas.width = video.videoWidth;
        captureCanvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

        const dataURL = captureCanvas.toDataURL('image/jpeg');

        // Send to backend
        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: dataURL,
                    name: name
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error("Backend error:", data.error);
                alert("Error during analysis. Please try again.");
                loadingOverlay.classList.add('hidden');
                return;
            }

            // Update UI with response
            greetingName.textContent = `Hi ${data.name},`;

            // Update dynamic message
            if (data.message) {
                dynamicMessageContent.innerHTML = `<h3>${data.message}</h3>`;
            }

            // Map detected attire to expected file suffix
            const gender = data.gender.toLowerCase();
            const attire = data.attire; // 'suit', 'traditional', 'shirt'

            // Construct filename
            const imagePath = `/static/avatars/${gender}_${attire}.png`;

            console.log("Setting avatar source:", imagePath);
            avatarImage.src = imagePath;

            avatarImage.onerror = function () {
                console.warn(`Image not found: ${imagePath}. Creating fallback.`);
                avatarImage.src = '/static/avatars/male_suit.png'; // Fallback
            };

            // Switch views
            loadingOverlay.classList.add('hidden');
            cameraSection.classList.add('hidden');
            resultSection.classList.remove('hidden');

            // Stop Owl Loop to save resources
            owlProcessor.stop();

            // Auto-read message
            const welcomeText = `Hi ${data.name}, ${data.message || ""}`;
            setTimeout(() => {
                speakMessage(welcomeText);
            }, 1000);

        } catch (err) {
            console.error("Network error:", err);
            alert("Failed to connect to server.");
            loadingOverlay.classList.add('hidden');
        }
    });

    resetBtn.addEventListener('click', () => {
        // Reset UI
        nameInput.value = '';
        resultSection.classList.add('hidden');
        cameraSection.classList.remove('hidden');

        // Restart Owl
        owlProcessor.start();

        // Stop speaking
        if (synth.speaking) {
            synth.cancel();
        }
    });

    // Text to Speech
    let synth = window.speechSynthesis;
    let voices = [];

    function loadVoices() {
        voices = synth.getVoices();
    }

    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Initial load
    loadVoices();

    function speakMessage(text) {
        if (synth.speaking) {
            synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;

        if (voices.length === 0) voices = synth.getVoices();

        const femaleVoice = voices.find(voice =>
            voice.name.includes('Zira') ||
            voice.name.includes('Google UK English Female') ||
            voice.name.includes('Samantha') ||
            voice.name.toLowerCase().includes('female')
        );

        if (femaleVoice) {
            utterance.voice = femaleVoice;
            utterance.pitch = 1.1;
        } else {
            console.log("No female voice found, using default with higher pitch");
            utterance.pitch = 1.0;
        }

        synth.speak(utterance);
    }
});
