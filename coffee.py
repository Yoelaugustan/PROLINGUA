import os
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import whisper
from pydub import AudioSegment
from transformers import pipeline
from flask_cors import CORS

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
    return render_template('index.html')

@app.route('/coffee')
def coffee():
    return render_template('coffee.html')

@app.route('/upload_audio', methods=['POST'])
def upload_audio():
    global file_counter, last_uploaded_file_path, pronunciation_score

    try:
        # Check for audio in the request
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'Empty file name'}), 400
        
        # Generate a secure filename and save the original audio file temporarily
        original_filename = secure_filename(audio_file.filename)
        original_filepath = os.path.join(app.config['UPLOAD_FOLDER'], original_filename)
        audio_file.save(original_filepath)

        # Convert the uploaded audio to WAV format using pydub
        converted_filename = f"speech{file_counter}.wav"
        converted_filepath = os.path.join(app.config['UPLOAD_FOLDER'], converted_filename)

        # Load the uploaded audio and export as WAV
        audio = AudioSegment.from_file(original_filepath)
        audio.export(converted_filepath, format="wav")

        file_counter += 1
        last_uploaded_file_path = converted_filepath
        print(last_uploaded_file_path)

        # Validate file size
        if os.path.getsize(converted_filepath) == 0:
            return jsonify({'error': 'Empty audio file received'}), 400

        # Transcribe audio
        transcription = model.transcribe(last_uploaded_file_path, language="en", word_timestamps=True)
        user_transcript = transcription['text']
        print(user_transcript)

        # Calculate overall pronunciation accuracy
        overall_accuracy = calculate_overall_pronunciation(last_uploaded_file_path)
        overall_score_percentage = overall_accuracy['score'] if overall_accuracy['score'] is not None else None

        print(overall_score_percentage)

        # Extract word-level timings from the transcription
        word_timings = {}
        if 'segments' in transcription:
            for segment in transcription['segments']:
                if 'words' in segment:
                    for word_info in segment['words']:
                        word_timings[word_info['word']] = (word_info['start'], word_info['end'])
        
        # Calculate pronunciation accuracy for each word
        word_accuracies = {}
        if word_timings:
            word_accuracies = calculate_pronunciation_per_word(last_uploaded_file_path, word_timings)

        print(word_accuracies)
        
        return jsonify({
            'user_transcript': user_transcript,
            'overall_accuracy': {
                'score': overall_score_percentage,
                'label': overall_accuracy['label']
            },
            'word_accuracies': word_accuracies
        }), 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': 'Audio processing failed', 'details': str(e)}), 500

def calculate_overall_pronunciation(audio_file_path):
    # Load the pipeline for pronunciation accuracy
    pipe = pipeline("audio-classification", model="JohnJumon/pronunciation_accuracy", device=0)  # Use GPU if available
    result = pipe(audio_file_path)

    if result:
        # Calculate the final overall score using the existing helper function
        overall_score = calculate_weighted_score(result)

        # Return a label based on the calculated overall score
        return {
            "score": overall_score,
            "label": "Excellent" if overall_score >= 90 else
            "Good" if overall_score >= 70 else
            "Average" if overall_score >= 50 else
            "Poor" if overall_score >= 30 else
            "Extremely Poor"
        }
    else:
        return {"score": None, "label": "No result"}

def calculate_pronunciation_per_word(audio_file_path, word_timings):
    # Load the pipeline for pronunciation accuracy
    pipe = pipeline("audio-classification", model="JohnJumon/pronunciation_accuracy", device=0)  # Use GPU if available
    word_accuracies = {}
    audio = AudioSegment.from_file(audio_file_path, format="wav")
    word_counter = 1

    for word, (start_time, end_time) in word_timings.items():
        # Extract audio segment for the word
        word_audio = audio[start_time * 1000:end_time * 1000]  # pydub uses milliseconds
        word_audio_path = f"temp_word{word_counter}.wav"
        word_audio.export(word_audio_path, format="wav")
        
        try:
            result = pipe(word_audio_path)
            if result:
                final_score = calculate_weighted_score(result)
                
                # Assign label based on the final score
                word_accuracies[word] = {
                    "score": final_score,
                    "label": "Excellent" if final_score >= 90 else
                    "Good" if final_score >= 70 else
                    "Average" if final_score >= 50 else
                    "Poor" if final_score >= 30 else
                    "Extremely Poor"
                }
            else:
                word_accuracies[word] = {
                    "score": None,
                    "label": "No result"
                }
        except Exception as e:
            print(f"Error processing word '{word}': {e}")
            word_accuracies[word] = {
                "score": None,
                "label": "Error"
            }
        
        # Clean up temporary file
        os.remove(word_audio_path)
        word_counter += 1
    
    return word_accuracies

def calculate_weighted_score(result):
    label_values = {
        'Excellent': 100,
        'Good': 75,
        'Average': 50,
        'Poor': 25,
        'Extremely Poor': 0
    }

    weighted_sum = 0
    total_score = 0

    for entry in result:
        label = entry['label']
        score = entry['score']
        if label in label_values:
            weighted_sum += label_values[label] * score
            total_score += score

    # Return the weighted score as a percentage if total_score is greater than zero
    if total_score > 0:
        return weighted_sum / total_score
    else:
        return 0  # Handle cases where total_score is 0

if __name__ == '__main__':
    app.run(debug=True)