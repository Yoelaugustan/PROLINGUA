let mediaRecorder;
let audioChunks = [];

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


// Function to add a message to the chat
function addMessage(messageText, isUser = true) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", isUser ? "user" : "ai");
    messageElement.textContent = messageText;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

micButton.addEventListener("click", async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            recordedBlob = new Blob(audioChunks, { type: 'audio/wav' });
            audioChunks = []; // Reset chunks
            // Add transcription logic here
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
    }
});

// Show the pop-up when the DONE button is clicked
doneButton.addEventListener("click", async () => {
    confirmPopup.classList.remove("hidden"); // Remove the "hidden" class to make it visible
    blackOverlay.classList.remove("hidden");
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
    blackOverlay.classList.add("hidden");
});

/* nathaaan nanti yg buat more serult, javascriptnya masukin ke seeResultButton biar muncull */