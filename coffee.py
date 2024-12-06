import os
from flask_cors import CORS
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import whisper
from transformers import pipeline

app = Flask(__name__)

# Enable CORS for all routes
CORS(app)

# Set the directory where audio files will be stored temporarily
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Ensure the uploads folder exists
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Load the Whisper model
model = whisper.load_model("base", device="cuda")

file_counter = 1
last_uploaded_file_path = None

@app.route('/')
def index():
    return render_template('index2.html')

@app.route('/coffee')
def coffee():
    return render_template('coffee.html')

@app.route('/upload_audio', methods=['POST'])
def upload_audio():
    global file_counter, last_uploaded_file_path

    try:
        # Check for audio in the request
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'Empty file name'}), 400
        
        # Save the audio file
        filename = f"speech{file_counter}.wav"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        audio_file.save(filepath)
        print(filepath)

        file_counter += 1
        last_uploaded_file_path = filepath
        
        # Validate file size
        if os.path.getsize(filepath) == 0:
            return jsonify({'error': 'Empty audio file received'}), 400

        # Transcribe audio
        transcript = model.transcribe(filepath)
        print(f"Transcript: {transcript}")
        return jsonify({'transcript': transcript, 'file_path': filepath}), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': 'Transcription failed', 'details': str(e)}), 500

def calculate_pronunciation(file_path):
    print(f"Calculating pronunciation for file: {file_path}")
    pipe = pipeline("audio-classification", model="JohnJumon/pronunciation_accuracy", device=0)  # Use GPU if available
    result = pipe(file_path)
    highest_score_result = max(result, key=lambda x: x['score'])
    return highest_score_result

def transcribe_audio(filepath):
    try:
        result = model.transcribe(filepath, language="en")
        print(result['text'])
        return result['text']
    except Exception as e:
        print(f"Error transcribing audio: {e}")
        return None

if __name__ == '__main__':
    app.run(debug=True)
