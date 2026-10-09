from datetime import datetime, timezone
from pathlib import Path
import json
import os
import uuid

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
DATA_FILE = Path(__file__).parent / "data" / "hazards.json"
DATA_FILE.parent.mkdir(exist_ok=True)

SEED_HAZARDS = [
    {
        "id": "HZ-1001", "title": "Rock debris reported on roadside",
        "type": "Landslide", "severity": "High", "location": "Uttarkashi–Gangotri Road",
        "lat": 30.994, "lng": 78.939,
        "description": "Community report: rocks and debris may be obstructing one lane.",
        "source": "Community report", "status": "Pending verification",
        "reported_at": "2026-10-09T15:10:00Z"
    },
    {
        "id": "HZ-1002", "title": "Heavy rainfall and low visibility",
        "type": "Heavy Rainfall", "severity": "Moderate", "location": "Dharali, Uttarkashi",
        "lat": 31.019, "lng": 78.759,
        "description": "A sample report of heavy rainfall and reduced visibility.",
        "source": "Community report", "status": "Pending verification",
        "reported_at": "2026-10-09T14:45:00Z"
    },
    {
        "id": "HZ-1003", "title": "Road blockage reported",
        "type": "Road Blockage", "severity": "Severe", "location": "Near Harsil",
        "lat": 31.036, "lng": 78.748,
        "description": "Sample incident for demonstration only; check official sources.",
        "source": "Demo data", "status": "Unverified demo",
        "reported_at": "2026-10-09T13:20:00Z"
    }
]

def load_hazards():
    if not DATA_FILE.exists():
        save_hazards(SEED_HAZARDS)
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return SEED_HAZARDS.copy()

def save_hazards(hazards):
    DATA_FILE.write_text(json.dumps(hazards, indent=2), encoding="utf-8")

@app.get("/")
def home():
    return render_template("index.html")

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "PahadRakshak API"})

@app.get("/api/hazards")
def get_hazards():
    hazards = load_hazards()
    hazard_type = request.args.get("type", "").strip().lower()
    severity = request.args.get("severity", "").strip().lower()
    if hazard_type and hazard_type != "all":
        hazards = [h for h in hazards if h["type"].lower() == hazard_type]
    if severity and severity != "all":
        hazards = [h for h in hazards if h["severity"].lower() == severity]
    hazards.sort(key=lambda h: h.get("reported_at", ""), reverse=True)
    return jsonify({"items": hazards, "count": len(hazards)})

@app.post("/api/hazards")
def create_hazard():
    body = request.get_json(silent=True) or {}
    required = ["title", "type", "severity", "location", "description"]
    missing = [key for key in required if not str(body.get(key, "")).strip()]
    if missing:
        return jsonify({"error": "Please complete all required fields.", "fields": missing}), 400

    try:
        lat = float(body["lat"]) if str(body.get("lat", "")).strip() else None
        lng = float(body["lng"]) if str(body.get("lng", "")).strip() else None
    except (TypeError, ValueError):
        return jsonify({"error": "Latitude and longitude must be numbers."}), 400

    if lat is not None and not -90 <= lat <= 90:
        return jsonify({"error": "Latitude must be between -90 and 90."}), 400
    if lng is not None and not -180 <= lng <= 180:
        return jsonify({"error": "Longitude must be between -180 and 180."}), 400

    allowed_types = {"Landslide", "Road Blockage", "Flood / High Water", "Heavy Rainfall", "Other"}
    allowed_severities = {"Low", "Moderate", "High", "Severe"}
    if body["type"] not in allowed_types or body["severity"] not in allowed_severities:
        return jsonify({"error": "Choose a valid hazard type and severity."}), 400

    item = {
        "id": f"HZ-{uuid.uuid4().hex[:6].upper()}",
        "title": str(body["title"]).strip()[:120],
        "type": body["type"],
        "severity": body["severity"],
        "location": str(body["location"]).strip()[:160],
        "lat": lat, "lng": lng,
        "description": str(body["description"]).strip()[:1000],
        "source": "Community report",
        "status": "Pending verification",
        "reported_at": datetime.now(timezone.utc).isoformat()
    }
    hazards = load_hazards()
    hazards.append(item)
    save_hazards(hazards)
    return jsonify({"message": "Report submitted for review.", "item": item}), 201

@app.get("/api/route-check")
def route_check():
    origin = request.args.get("origin", "").strip()
    destination = request.args.get("destination", "").strip()
    if not origin or not destination:
        return jsonify({"error": "Enter both an origin and destination."}), 400

    # This is a transparent demo check, not a live routing or safety service.
    hazards = load_hazards()
    return jsonify({
        "origin": origin,
        "destination": destination,
        "status": "Needs review",
        "message": "This prototype does not have live road-closure or routing data. Review the reports below and confirm conditions with official authorities before travelling.",
        "related_reports": hazards[:5],
        "is_live": False
    })

if __name__ == "__main__":
    app.run(debug=True, port=int(os.environ.get("PORT", 5000)))
