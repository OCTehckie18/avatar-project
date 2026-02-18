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
    });
});
