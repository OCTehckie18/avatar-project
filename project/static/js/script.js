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
    const nextGuestInputBtn = document.getElementById('nextGuestInputBtn');
    const namePromptText = document.getElementById('namePromptText');

    // Detect View Mode for Kiosk Panel Setup
    const urlParams = new URLSearchParams(window.location.search);
    const viewMode = urlParams.get('view') || 'combined'; // 'input', 'display', 'combined'

    // Use Broadcast Channel API for multi-window communication
    const channel = new BroadcastChannel('kiosk_channel');

    // Apply specific CSS adjustments according to what window we are supposed to be rendering
    if (viewMode === 'display') {
        document.querySelector('.input-group').style.display = 'none';
        document.querySelector('.camera-container').style.flex = '1';
        document.querySelector('.camera-container').style.justifyContent = 'center';
        document.querySelector('.camera-container').style.paddingRight = '0';
        resetBtn.style.display = 'none'; // No "Next Guest" on display screen
    } else if (viewMode === 'input') {
        owlCanvas.style.display = 'none';
        document.querySelector('.camera-container').style.flex = '0';
        document.querySelector('.camera-container').style.padding = '0';
        document.querySelector('.input-group').style.alignItems = 'center';
        document.querySelector('.input-group').style.width = '100%';
        resetBtn.style.display = 'none'; // The primary result reset button is disabled, we use nextGuestInputBtn
    }

    // Text to Speech
    let synth = window.speechSynthesis;
    let voices = [];

    function loadVoices() {
        voices = synth.getVoices();
    }

    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }

    loadVoices();

    function speakMessage(text, gender) {
        if (synth.speaking) {
            synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);

        if (voices.length === 0) voices = synth.getVoices();

        if (gender === 'male') {
            const maleVoice = voices.find(voice =>
                voice.name.includes('David') ||
                voice.name.includes('Google UK English Male') ||
                (voice.name.toLowerCase().includes('male') && !voice.name.toLowerCase().includes('female'))
            );
            if (maleVoice) utterance.voice = maleVoice;
            utterance.pitch = 0.8;
            utterance.rate = 0.95;
        } else {
            const femaleVoice = voices.find(voice =>
                voice.name.includes('Zira') ||
                voice.name.includes('Google UK English Female') ||
                voice.name.includes('Samantha') ||
                voice.name.toLowerCase().includes('female')
            );
            if (femaleVoice) utterance.voice = femaleVoice;
            utterance.pitch = 1.5;
            utterance.rate = 1.1;
        }

        synth.speak(utterance);
    }

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

            processCtx.drawImage(videoEl, 0, 0, processCtx.canvas.width, processCtx.canvas.height);
            const frame = processCtx.getImageData(0, 0, processCtx.canvas.width, processCtx.canvas.height);
            const l = frame.data.length / 4;

            for (let i = 0; i < l; i++) {
                const r = frame.data[i * 4 + 0];
                const g = frame.data[i * 4 + 1];
                const b = frame.data[i * 4 + 2];

                // Target Color: #73B55D => R=115, G=181, B=93
                const dist = Math.sqrt(
                    Math.pow(r - 115, 2) +
                    Math.pow(g - 181, 2) +
                    Math.pow(b - 93, 2)
                );

                if (dist < 90) {
                    frame.data[i * 4 + 3] = 0;
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
    if (viewMode !== 'input') {
        // Start owl processing only if we need to see it (saves resources on input panel)
        owlProcessor.start();
    }

    let isProcessingWave = false;
    let waveDetectionInterval;

    // Access Webcam (Silent, for capture only)
    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;

            // Deep Level Server-Side Waving Detection via App.py API Polling
            waveDetectionInterval = setInterval(async () => {
                // Ensure we only poll when camera is actively used and not hidden
                if (video.paused || video.ended || isProcessingWave || cameraSection.classList.contains('hidden') || viewMode === 'display') {
                    return;
                }

                const context = captureCanvas.getContext('2d');
                captureCanvas.width = video.videoWidth;
                captureCanvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
                // Heavily compress frame to maintain 10fps network stability locally
                const dataURL = captureCanvas.toDataURL('image/jpeg', 0.5);

                try {
                    const response = await fetch('/detect_wave', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: dataURL })
                    });

                    const data = await response.json();

                    if (data.wave && !isProcessingWave) {
                        isProcessingWave = true;
                        console.log("Deep Level Backend Motion Detected! Translating Wave.");
                        captureBtn.click();
                    }
                } catch (err) {
                    // Ignore connection drops natively
                }
            }, 120); // roughly ~8 fps

        } catch (err) {
            console.error("Error accessing webcam: ", err);
            alert("Could not access webcam. Please allow permissions.");
        }
    }

    if (viewMode === 'input' || viewMode === 'combined') {
        // Only spin up the user webcam on the input or combined window
        startCamera();
    }

    // --- Modular Core Actions ---

    function showResult(data) {
        greetingName.textContent = `Hi ${data.name},`;

        if (data.message) {
            dynamicMessageContent.innerHTML = `<h3>${data.message}</h3>`;
        }

        const gender = data.gender.toLowerCase();
        const attire = data.attire;
        const imagePath = `/static/avatars/${gender}_${attire}.png`;

        avatarImage.src = imagePath;
        avatarImage.onerror = function () {
            avatarImage.src = '/static/avatars/male_suit.png';
        };

        cameraSection.classList.add('hidden');
        resultSection.classList.remove('hidden');

        if (viewMode !== 'input') {
            owlProcessor.stop();
        }

        const welcomeText = `Hi ${data.name}, ${data.message || ""}`;
        setTimeout(() => {
            speakMessage(welcomeText, gender);
        }, 1000);
    }

    function resetDisplay() {
        resultSection.classList.add('hidden');
        cameraSection.classList.remove('hidden');
        if (viewMode !== 'input') {
            owlProcessor.start();
        }
        if (synth.speaking) {
            synth.cancel();
        }
    }

    function resetInput() {
        nameInput.value = '';
        nameInput.style.display = 'block';
        captureBtn.style.display = 'block';
        if (namePromptText) namePromptText.style.display = 'block';
        if (nextGuestInputBtn) {
            nextGuestInputBtn.style.display = 'none';
        }

        // Ensure backend resets frame processing memory
        fetch('/wave_reset', { method: 'POST' }).catch(e => console.error(e));
        isProcessingWave = false;
    }

    // --- Multi-Window Orchestration Listener ---
    channel.onmessage = (event) => {
        if (event.data.type === 'result') {
            if (viewMode === 'display' || viewMode === 'combined') {
                showResult(event.data.data);
            }
        } else if (event.data.type === 'reset') {
            if (viewMode === 'display' || viewMode === 'combined') {
                resetDisplay();
            }
            if (viewMode === 'input' || viewMode === 'combined') {
                resetInput();
            }
        }
    };

    // --- User Interactions ---
    nameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            captureBtn.click();
        }
    });

    captureBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();

        loadingOverlay.classList.remove('hidden');

        // Capture frame
        const context = captureCanvas.getContext('2d');
        captureCanvas.width = video.videoWidth;
        captureCanvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
        const dataURL = captureCanvas.toDataURL('image/jpeg');

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataURL, name: name })
            });

            const data = await response.json();

            if (data.error) {
                console.error("Backend error:", data.error);
                alert("Error during analysis. Please try again.");
                loadingOverlay.classList.add('hidden');
                return;
            }

            loadingOverlay.classList.add('hidden');

            if (viewMode === 'input') {
                // Actions confined to the Input Panel ONLY
                nameInput.style.display = 'none';
                captureBtn.style.display = 'none';
                if (namePromptText) namePromptText.style.display = 'none';

                if (nextGuestInputBtn) {
                    nextGuestInputBtn.style.display = 'block';
                    nextGuestInputBtn.classList.remove('hidden');
                }

                // Blast result globally to Owl Displays
                channel.postMessage({ type: 'result', data: data });
            } else {
                // Actions confined to the default local full Combined Panel
                channel.postMessage({ type: 'result', data: data }); // Notify any other connected screens just in case
                showResult(data);
            }

        } catch (err) {
            console.error("Network error:", err);
            alert("Failed to connect to server.");
            loadingOverlay.classList.add('hidden');
        }
    });

    // Handle Reset action trigger from either button or panel
    resetBtn.addEventListener('click', () => {
        channel.postMessage({ type: 'reset' });
        resetDisplay();
        resetInput();
    });

    if (nextGuestInputBtn) {
        nextGuestInputBtn.addEventListener('click', () => {
            channel.postMessage({ type: 'reset' });
            resetDisplay();
            resetInput();
        });
    }
});
