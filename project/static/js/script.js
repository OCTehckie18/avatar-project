document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const captureBtn = document.getElementById('captureBtn');
    const nameInput = document.getElementById('nameInput');
    const cameraSection = document.getElementById('camera-section');
    const resultSection = document.getElementById('result-section');
    const loadingOverlay = document.getElementById('loading');
    const greetingName = document.getElementById('greetingName');
    const avatarImage = document.getElementById('avatarImage');
    const resetBtn = document.getElementById('resetBtn');

    // Access Webcam
    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
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

        // Capture frame
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataURL = canvas.toDataURL('image/jpeg');

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

            // Map detected attire to expected file suffix
            const gender = data.gender.toLowerCase();
            const attire = data.attire; // 'suit', 'traditional', 'shirt'

            // Construct filename: project/static/avatars/male_suit.png
            const imagePath = `/static/avatars/${gender}_${attire}.png`;

            avatarImage.src = imagePath;
            // Handle image load error fallback
            avatarImage.onerror = function () {
                console.warn(`Image not found: ${imagePath}. Creating fallback.`);
                // Fallback to text or generic placeholder if image missing
                this.src = "https://via.placeholder.com/400x600?text=Avatar+Missing";
            };

            // Switch views
            loadingOverlay.classList.add('hidden');
            cameraSection.classList.add('hidden');
            resultSection.classList.remove('hidden');

            // Force fullscreen on result if possible (optional per browser policy)
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log("Fullscreen denied", err);
                });
            }

            // Auto-read message
            const welcomeText = `Hi ${data.name}, Welcome to Christ University. Thanks for joining the Corporate Conclave by the School of Sciences. We are happy to have you today.`;
            // Small delay to allow transition
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

        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.log(err));
        }

        // Stop speaking
        if (synth.speaking) {
            synth.cancel();
        }
    });
    // Text to Speech
    const screenReaderBtn = document.getElementById('screenReaderBtn');
    let synth = window.speechSynthesis;
    let isSpeaking = false;
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

        // Ensure voices are loaded
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
            utterance.pitch = 1.6; // Higher pitch
        }

        // Visual feedback
        screenReaderBtn.classList.add('speaking');
        screenReaderBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            <span>Stop Reading</span>
        `;
        isSpeaking = true;

        utterance.onend = () => {
            screenReaderBtn.classList.remove('speaking');
            screenReaderBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                <span>Read Message</span>
             `;
            isSpeaking = false;
        };

        synth.speak(utterance);
    }

    screenReaderBtn.addEventListener('click', () => {
        if (isSpeaking) {
            synth.cancel();
            screenReaderBtn.classList.remove('speaking');
            screenReaderBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                <span>Read Message</span>
             `;
            isSpeaking = false;
        } else {
            // Reconstruct message
            const name = greetingName.textContent.replace('Hi ', '').replace(',', '');
            const message = `Hi ${name}, Welcome to Christ University. Thanks for joining the Corporate Conclave by the School of Sciences. We are happy to have you today.`;
            speakMessage(message);
        }
    });

});
