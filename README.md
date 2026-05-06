# OsseoAI PCD

An AI-powered bone fracture detection system using computer vision and deep learning.

## Features

- Bone fracture analysis from X-ray images
- Web-based interface with React frontend
- FastAPI backend with authentication
- Multi-model support for different bone types
- Real-time predictions with Grad-CAM visualizations

## Tech Stack

- **Backend**: Python, FastAPI, PyTorch, SQLAlchemy
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Database**: SQLite (development) / PostgreSQL (production)
- **AI Models**: Custom PyTorch models for bone fracture detection

## Local Development

### Prerequisites

- Python 3.8+
- Node.js 16+
- Git

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/fbrj33/osseoAI.git
   cd osseoAI
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Install Node.js dependencies:
   ```bash
   npm install
   ```

4. Run the application:
   ```bash
   # Backend (in one terminal)
   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

   # Frontend (in another terminal)
   npm run dev
   ```

5. Open your browser to `http://localhost:5173`

## API Documentation

When running locally, visit `http://localhost:8000/docs` for interactive API documentation.

## Project Structure

```
├── main.py              # FastAPI application
├── database.py          # Database models and connections
├── auth.py              # Authentication and authorization
├── predictor.py         # AI model inference logic
├── src/                 # React frontend
├── checkpoints/         # Trained model weights
├── uploads/             # User uploaded images
└── static/              # Static assets
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[Add your license here]