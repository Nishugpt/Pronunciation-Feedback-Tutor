document.addEventListener('DOMContentLoaded', () => {
    // DOM Element References
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const playRefBtn = document.getElementById('playRefBtn');
    const stopNativeBtn = document.getElementById('stopNativeBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const recognizeSpeechBtn = document.getElementById('recognizeSpeechBtn');
    const uploadNativeAudio = document.getElementById('uploadNativeAudio');
    const clearNativeAudioBtn = document.getElementById('clearNativeAudioBtn');
    const uploadDocFile = document.getElementById('uploadDocFile');
    const clearDocBtn = document.getElementById('clearDocBtn');
    const feedback = document.getElementById('feedback');
    const speechResult = document.getElementById('speechResult');
    const history = document.getElementById('history');
    const nativeAudioList = document.getElementById('nativeAudioList');
    const docDisplay = document.getElementById('docDisplay');
    const canvas = document.getElementById('audioVisualizer');
    const canvasCtx = canvas.getContext('2d');

    // State Variables
    let mediaRecorder;
    let audioChunks = [];
    let nativeAudioElements = [];
    let recordingCounter = 0;
    let audioContext;
    let analyser;
    let source;
    let animationFrameId;
    let nativePlaybackTimeout;

    // --- Initial Button States ---
    playRefBtn.disabled = true; // Can't play if nothing is uploaded

    // --- Audio Recording & Visualization ---
    const setupAudioContext = (stream) => {
        if (audioContext) audioContext.close();
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 2048;
        visualize();
    };
    
    const visualize = () => {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        const draw = () => {
            if (!mediaRecorder || mediaRecorder.state !== 'recording') {
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }
            animationFrameId = requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(dataArray);
            canvasCtx.fillStyle = '#f9f9f9';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = '#0b3d91';
            canvasCtx.beginPath();
            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;
                if (i === 0) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);
                x += sliceWidth;
            }
            canvasCtx.lineTo(canvas.width, canvas.height / 2);
            canvasCtx.stroke();
        };
        draw();
    };
    
    startBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            setupAudioContext(stream);
            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                addRecordingToHistory(audioUrl);
                audioChunks = [];
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            feedback.textContent = 'Recording... 🎤';
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } catch (err) {
            console.error("Error accessing microphone:", err);
            feedback.textContent = 'Could not access microphone. Ensure you are on a secure (https or localhost) connection and have granted permission.';
        }
    });

    stopBtn.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
        feedback.textContent = 'Recording stopped. ✅';
        startBtn.disabled = false;
        stopBtn.disabled = true;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
    });

    uploadNativeAudio.addEventListener('change', (event) => {
        const files = event.target.files;
        if (files.length === 0) return;
        clearAllNativeAudio();
        for (const file of files) {
            const audioUrl = URL.createObjectURL(file);
            addNativeAudioToList(file.name, audioUrl);
        }
        clearNativeAudioBtn.style.display = 'inline-block';
        playRefBtn.disabled = false;
    });

    clearNativeAudioBtn.addEventListener('click', clearAllNativeAudio);
    
    playRefBtn.addEventListener('click', () => {
        if (nativeAudioElements.length === 0) return;
        const audio = nativeAudioElements[0];
        const startTime = parseFloat(document.getElementById('startTime').value) || 0;
        const endTimeInput = document.getElementById('endTime').value;
        const endTime = parseFloat(endTimeInput) >= 0 ? parseFloat(endTimeInput) : 99999;
        audio.currentTime = startTime;
        audio.play();
        playRefBtn.disabled = true;
        stopNativeBtn.disabled = false;
        const duration = (endTime - startTime) * 1000;
        if (duration > 0 && isFinite(duration)) {
            clearTimeout(nativePlaybackTimeout);
            nativePlaybackTimeout = setTimeout(() => { if (!audio.paused) audio.pause(); }, duration);
        }
        const onPauseOrEnd = () => {
            playRefBtn.disabled = false;
            stopNativeBtn.disabled = true;
            clearTimeout(nativePlaybackTimeout);
        };
        audio.onpause = onPauseOrEnd;
        audio.onended = onPauseOrEnd;
    });
    
    stopNativeBtn.addEventListener('click', () => {
        if (nativeAudioElements.length > 0 && !nativeAudioElements[0].paused) {
            nativeAudioElements[0].pause();
        }
    });

    clearHistoryBtn.addEventListener('click', () => {
        history.innerHTML = '';
        recordingCounter = 0;
        feedback.textContent = 'History cleared.';
    });
    
    uploadDocFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => docDisplay.textContent = e.target.result;
        if (file.type === "text/plain") reader.readAsText(file);
        else docDisplay.textContent = `Preview is only for .txt files.`;
    });

    clearDocBtn.addEventListener('click', () => {
        docDisplay.textContent = '';
        uploadDocFile.value = '';
        clearDocBtn.style.display = 'none';
    });
    
    function addRecordingToHistory(audioUrl) {
        recordingCounter++;
        const recordItem = document.createElement('div');
        recordItem.className = 'record-item';
        recordItem.innerHTML = `<span class="record-num">Rec ${recordingCounter}:</span><audio controls src="${audioUrl}"></audio>`;
        history.appendChild(recordItem);
    }

    function addNativeAudioToList(fileName, audioUrl) {
        const item = document.createElement('div');
        item.className = 'native-audio-item';
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = audioUrl;
        item.innerHTML = `<span>${fileName}</span>`;
        item.appendChild(audio);
        nativeAudioList.appendChild(item);
        nativeAudioElements.push(audio);
    }
    
    function clearAllNativeAudio() {
        nativeAudioElements.forEach(audio => URL.revokeObjectURL(audio.src));
        nativeAudioElements = [];
        nativeAudioList.innerHTML = '';
        uploadNativeAudio.value = '';
        clearNativeAudioBtn.style.display = 'none';
        playRefBtn.disabled = true;
        stopNativeBtn.disabled = true;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.onresult = (event) => { speechResult.textContent = `Recognized: "${event.results[0][0].transcript}"`; };
        recognition.onerror = (event) => { speechResult.textContent = 'Error: ' + event.error; };
        recognition.onend = () => { recognizeSpeechBtn.disabled = false; };
        recognizeSpeechBtn.addEventListener('click', () => {
            recognizeSpeechBtn.disabled = true;
            speechResult.textContent = 'Listening...';
            recognition.start();
        });
    } else {
        recognizeSpeechBtn.disabled = true;
        speechResult.textContent = 'Speech recognition not supported.';
    }
});