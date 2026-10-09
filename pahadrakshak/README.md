# PahadRakshak

A Flask + HTML/CSS/JavaScript prototype for community hazard reporting and Himalayan travel-risk awareness.

## Features
- Responsive safety dashboard
- View and filter hazard reports
- Submit community reports with optional coordinates
- Prototype route check that surfaces reports and clearly labels data limitations
- JSON-file persistence for a quick hackathon demo

## Important data note
The bundled incidents are **sample/demo data**, not live road conditions. The route checker does not calculate routes or establish that a road is safe. Do not use this prototype as an emergency service. Before travel, confirm conditions with official authorities.

## Run locally

Python 3.10+ recommended.

```bash
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1

pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000

## Repository structure

```text
pahadrakshak/
├── app.py
├── requirements.txt
├── README.md
├── .gitignore
├── data/
│   └── hazards.json
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── styles.css
    ├── js/
    │   └── app.js
    └── img/
        └── README.md
```

## Suggested next improvements
1. Replace demo data with sourced official advisories and show each source URL and retrieval time.
2. Add authentication and role-based review before allowing reports to be marked verified.
3. Use a real geocoding/routing provider for route geometry; don't infer a safe alternative from hazard pins alone.
4. Move from JSON storage to PostgreSQL/MySQL for multi-user deployment.
5. Add rate limiting, upload validation, audit logs, tests, and production server configuration.
