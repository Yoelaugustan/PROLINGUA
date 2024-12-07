let mediaRecorder;
let audioChunks = [];
const micButton = document.querySelector(".mic-button");
const popup = document.getElementById("micPopup");
const closePopupButton = document.getElementById("closePopup");
const recordingStatus = document.getElementById("recordingStatus");
const messageInput = document.getElementById("messageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const messagesContainer = document.querySelector(".chat-container");