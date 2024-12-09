let mediaRecorder;
let audioChunks = [];
let userScores = [];
let recordingsData = []; 

const micButton = document.querySelector(".mic-button");
const popup = document.getElementById("micPopup");
const closePopupButton = document.getElementById("closePopup");

const recordingStatus = document.getElementById("recordingStatus");
const messageInput = document.getElementById("messageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const messagesContainer = document.querySelector(".chat-container");

const doneButton = document.getElementById("done-button");
const confirmPopup = document.getElementById("confirmPopup");
const closeConfirmButton = document.getElementById("closeConfirmButton");

const openResultButton = document.getElementById("openResultPopup");
const resultPopup = document.getElementById("resultPopup");
const seeResultButton = document.getElementById("seeResultButton");

const blackOverlay = document.getElementById("blackOverlay");

const moreResultPopup = document.getElementById("seeResult");  
const scorePercentage = document.getElementById('score-percentage');
const scoreLevel = document.getElementById('score-level');
const retryButton = document.getElementById('retry');
const checkAnswerButton = document.getElementById('check-answer');


const questions = [
    "What is your role in your current job?",
    "What skill do you use most at work?",
    "How do you prioritize tasks?",
    "What do you say when you need help?",
    "How do you share ideas in a meeting?",
    "What do you do if you disagree with someone?",
    "How do you handle an urgent issue?",
    "What do you say to an unhappy client?",
    "How do you ask for a meeting reschedule?",
    "What do you say to thank a coworker?"
];

// Function to add a message to the chat
function addMessage(messageText, isUser = true) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", isUser ? "user" : "ai");
    messageElement.textContent = messageText;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// buat display random questions
function displayRandomQuestion() {
    const randomIndex = Math.floor(Math.random() * questions.length);
    const question = questions[randomIndex];
    addMessage(question, false); // Add as AI message
}

micButton.addEventListener("click", async () => {
    try {
        audioChunks = [];

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            recordedBlob = new Blob(audioChunks, { type: 'audio/wav' });
            audioChunks = [];
        };

        mediaRecorder.start();
        console.log("Recording started");

        popup.classList.remove("hidden");
        recordingStatus.textContent = "Listening...";

    } catch (error) {
        console.error("Error accessing microphone:", error);
        // Log the type of error for better debugging
        if (error.name) {
            console.log("Error name:", error.name);
        }
    }
});

closePopupButton.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });

            // Send audio to backend for transcription
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.wav");

            try {
                const response = await fetch("http://127.0.0.1:5000/upload_audio", {
                    method: "POST",
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    messageInput.value = data.user_transcript; // Show transcript in the input box
                
                    userScores.push(data.overall_accuracy.score)
                    
                    const recordingId = new Date().toISOString(); // Timestamp as a unique ID

                    recordingsData.push({
                        id: recordingId,
                        userTranscript: data.user_transcript,
                        wordAccuracies: data.word_accuracies
                    });
                } else {
                    console.error("Failed to transcribe audio.");
                }
            } catch (error) {
                console.error("Error uploading audio:", error);
            }
        };
    }
    popup.classList.add("hidden");
});

sendMessageBtn.addEventListener("click", () => {
    const userMessage = messageInput.value.trim();
    if (userMessage !== "") {
        addMessage(userMessage, true); // Add message to the chat container
        messageInput.value = ""; // Clear the input box
        displayRandomQuestion();
    }
});

// Show the pop-up when the DONE button is clicked
doneButton.addEventListener("click", async () => {
    confirmPopup.classList.remove("hidden"); // Remove the "hidden" class to make it visible
    blackOverlay.classList.remove("hidden");

    const overallScore = userScores.reduce((a, b) => a + b, 0) / userScores.length;
    updateScore(overallScore)
});

// Close the pop-up when the Close button is clicked
closeConfirmButton.addEventListener("click", () => {
    confirmPopup.classList.add("hidden"); // Add the "hidden" class to hide it again
    blackOverlay.classList.add("hidden");
});

openResultButton.addEventListener("click", async () => {
    resultPopup.classList.remove("hidden"); // Remove the "hidden" class to make it visible
    confirmPopup.classList.add("hidden");
    blackOverlay.classList.remove("hidden");
});

seeResultButton.addEventListener("click", () => {
    resultPopup.classList.add("hidden"); // Add the "hidden" class to hide it again
    moreResultPopup.classList.remove("hidden");
});

function updateScore(score) {
    const level = score >= 80 ? 'GOOD' : score >= 50 ? 'FAIR' : 'POOR';
    const formattedScore = score.toFixed(2); // Format the score to two decimal places

    scorePercentage.textContent = `${formattedScore}%`;
    scoreLevel.textContent = level;
    scoreLevel.style.color = level === 'GOOD' ? 'green' : level === 'FAIR' ? 'orange' : 'red';
    document.querySelector('.score-circle').style.background = `conic-gradient(
        ${level === 'GOOD' ? 'green' : level === 'FAIR' ? 'orange' : 'red'} 0%, 
        ${level === 'GOOD' ? 'green' : level === 'FAIR' ? 'orange' : 'red'} ${score}%, 
        #ddd ${score}%, 
        #ddd 100%
    )`;
}


document.addEventListener("DOMContentLoaded", () => {
    const messageInput = document.getElementById("messageInput");
    messageInput.disabled = true; // Disable the input field
});

retryButton.addEventListener('click', () => {
    moreResultPopup.classList.add("hidden"); 
    blackOverlay.classList.add("hidden");   
 });

    // Event untuk check the answer
checkAnswerButton.addEventListener('click', () => {
    moreResultPopup.classList.add("hidden");
    blackOverlay.classList.add("hidden");   

    const threshold = 60;

    const userMessageElements = document.querySelectorAll('.message.user');

    recordingsData.forEach((recording, index) => {
        const userMessageElement = userMessageElements[index]; // Get the corresponding message element
    
        if (!userMessageElement) {
            console.warn(`No user message element found for index ${index}`);
            return; // Skip if there's no matching element
        }
    
        let messageHTML = userMessageElement.textContent.split(" ").map((word) => {
            const wordData = recording.wordAccuracies.find(w => w.word === word);
            if (wordData && wordData.accuracy < threshold) {
                return `<span style="color: red">${word}</span>`;
            }
            return word;
        }).join(" ");
    
        userMessageElement.innerHTML = messageHTML; // Update the element with highlighted words
    });

});
