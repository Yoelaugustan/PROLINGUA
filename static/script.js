let mediaRecorder;
let audioChunks = [];
let recordedBlob;
let isRecording = false;

const startRecordingButton = document.getElementById('startRecording');
const stopRecordingButton = document.getElementById('stopRecording');
const showTranscriptButton = document.getElementById('showTranscript');
const seeResultButton = document.getElementById('seeResultButton');
const outputDiv = document.getElementById('output');
const transcriptDiv = document.getElementById('transcript');
const resultContainer = document.getElementById('resultContainer');

// Enable media recording
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            recordedBlob = new Blob(audioChunks, { type: 'audio/wav' });
            audioChunks = []; // Reset chunks

            outputDiv.innerHTML = 'Audio recorded successfully.';
            showTranscriptButton.disabled = false;
            seeResultButton.disabled = false;

            // Upload audio to the backend for transcription
            const formData = new FormData();
            formData.append('audio', recordedBlob, 'recorded_audio.wav');

            const response = await fetch('http://127.0.0.1:5000/upload_audio', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                transcriptDiv.innerHTML = `Transcript: ${data.user_transcript}`;
                sessionStorage.setItem('transcript', data.user_transcript);
                sessionStorage.setItem('results', JSON.stringify(data));
            } else {
                const errorData = await response.json();
                transcriptDiv.innerHTML = `Error: ${errorData.error}`;
            }
        };
    })
    .catch(error => {
        console.error('Error accessing audio devices:', error);
        outputDiv.innerHTML = 'Could not access audio devices. Please check your microphone settings.';
    });

// Start recording
startRecordingButton.addEventListener('click', () => {
    if (mediaRecorder && !isRecording) {
        mediaRecorder.start();
        isRecording = true;
        outputDiv.innerHTML = 'Recording...';
        startRecordingButton.disabled = true;
        stopRecordingButton.disabled = false;
    }
});

// Stop recording
stopRecordingButton.addEventListener('click', () => {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        outputDiv.innerHTML = 'Processing audio...';
        startRecordingButton.disabled = false;
        stopRecordingButton.disabled = true;
    }
});

// Show transcript
function showTranscript() {
    const transcript = sessionStorage.getItem('transcript');
    if (transcript) {
        alert(`Transcript: ${transcript}`);
    } else {
        alert('No transcript available.');
    }
}

// Fetch and display results
async function fetchAndShowResult() {
    const results = sessionStorage.getItem('results');
    if (results) {
        const data = JSON.parse(results);

        let overallAccuracy = data.overall_accuracy;
        let wordAccuracies = data.word_accuracies;

        let resultHTML = `<h3>Overall Pronunciation Accuracy</h3>`;
        if (overallAccuracy.score !== null) {
            resultHTML += `<p>Accuracy: ${overallAccuracy.score.toFixed(2)}%, Label: ${overallAccuracy.label}</p>`;
        } else {
            resultHTML += `<p>No accuracy data available.</p>`;
        }

        if (Object.keys(wordAccuracies).length > 0) {
            resultHTML += `<h3>Word-level Pronunciation Accuracy</h3><ul>`;
            for (const [word, accuracy] of Object.entries(wordAccuracies)) {
                if (accuracy.score !== null) {
                    resultHTML += `<li>Word: ${word}, Accuracy: ${accuracy.score.toFixed(2)}%, Label: ${accuracy.label}</li>`;
                } else {
                    resultHTML += `<li>Word: ${word}, Accuracy: No data available</li>`;
                }
            }
            resultHTML += `</ul>`;
        }

        resultContainer.innerHTML = resultHTML;
    } else {
        resultContainer.innerHTML = 'No results available. Please record and process an audio file first.';
    }
}
