from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, quiz, boss, endboss, miniboss, progress, user, code, train, titles, game
from dotenv import load_dotenv
import os

load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

app = FastAPI(title="AI MON API - MVP", version="1.0.0")

raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(user.router, prefix="/user", tags=["User"])
app.include_router(quiz.router, prefix="/quiz", tags=["Quiz"])
app.include_router(progress.router, prefix="/progress", tags=["Progress"])
app.include_router(boss.router, prefix="/boss", tags=["Boss"])
app.include_router(endboss.router, prefix="/boss/endboss", tags=["Endboss"])
app.include_router(miniboss.router, prefix="/boss/miniboss", tags=["Miniboss"])
app.include_router(code.router, prefix="/code", tags=["Code"])
app.include_router(train.router, prefix="/train", tags=["Train"])
app.include_router(titles.router, prefix="/titles", tags=["Titles"])
app.include_router(game.router, prefix="/game", tags=["Game"])

@app.get("/")
def health_check():
    return {"status": "AI MON Backend is running"}
