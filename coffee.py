import os
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import whisper
from pydub import AudioSegment
from transformers import pipeline
from flask_cors import CORS

app = Flask(__name__)

CORS(app)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

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
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'Empty file name'}), 400

        original_filename = secure_filename(audio_file.filename)
        original_filepath = os.path.join(app.config['UPLOAD_FOLDER'], original_filename)
        audio_file.save(original_filepath)

        converted_filename = f"speech{file_counter}.wav"
        converted_filepath = os.path.join(app.config['UPLOAD_FOLDER'], converted_filename)

        audio = AudioSegment.from_file(original_filepath)
        audio.export(converted_filepath, format="wav")

        file_counter += 1
        last_uploaded_file_path = converted_filepath
        print(last_uploaded_file_path)

        if os.path.getsize(converted_filepath) == 0:
            return jsonify({'error': 'Empty audio file received'}), 400

        transcription = model.transcribe(last_uploaded_file_path, language="en", word_timestamps=True)
        user_transcript = transcription['text']
        print(user_transcript)

        overall_accuracy = calculate_overall_pronunciation(last_uploaded_file_path)
        overall_score_percentage = overall_accuracy['score'] if overall_accuracy['score'] is not None else None

        print(overall_score_percentage)

        word_timings = {}
        if 'segments' in transcription:
            for segment in transcription['segments']:
                if 'words' in segment:
                    for word_info in segment['words']:
                        word_timings[word_info['word']] = (word_info['start'], word_info['end'])
        
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
    pipe = pipeline("audio-classification", model="JohnJumon/pronunciation_accuracy", device=0)  # Use GPU if available
    result = pipe(audio_file_path)

    if result:
        overall_score = calculate_weighted_score(result, "overall")

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
    pipe = pipeline("audio-classification", model="JohnJumon/pronunciation_accuracy", device=0)  # Use GPU if available
    word_accuracies = {}
    audio = AudioSegment.from_file(audio_file_path, format="wav")
    word_counter = 1

    for word, (start_time, end_time) in word_timings.items():
        word_audio = audio[start_time * 1000:end_time * 1000]
        word_audio_path = f"temp_word{word_counter}.wav"
        word_audio.export(word_audio_path, format="wav")
        
        try:
            result = pipe(word_audio_path)
            if result:
                final_score = calculate_weighted_score(result, "word")

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

        os.remove(word_audio_path)
        word_counter += 1
    
    return word_accuracies

def calculate_weighted_score(result, checkName):
    if(checkName == "overall"):
        label_values = {
            'Excellent': 100,
            'Good': 80,
            'Average': 60,
            'Poor': 40,
            'Extremely Poor': 20
        }
    else:
        label_values = {
            'Excellent': 90,
            'Good': 70,
            'Average': 50,
            'Poor': 30,
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

    if total_score > 0:
        return weighted_sum / total_score
    else:
        return 0

    

if __name__ == '__main__':
    app.run(debug=True)