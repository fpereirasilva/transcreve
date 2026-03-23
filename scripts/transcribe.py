import sys
import json

from faster_whisper import WhisperModel

model_size = sys.argv[2] if len(sys.argv) > 2 else "small"
model = WhisperModel(model_size, device="cpu", compute_type="int8")

segments, info = model.transcribe(sys.argv[1], language="pt")
text = " ".join(segment.text.strip() for segment in segments)

print(json.dumps({"text": text, "language": info.language, "duration": info.duration}))
