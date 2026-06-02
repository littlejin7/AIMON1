from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, quiz, boss, progress, user, code

app = FastAPI(title="AI MON API - MVP", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(user.router, prefix="/user", tags=["User"])
app.include_router(quiz.router, prefix="/quiz", tags=["Quiz"])
app.include_router(progress.router, prefix="/progress", tags=["Progress"])
app.include_router(boss.router, prefix="/boss", tags=["Boss"])
app.include_router(code.router, prefix="/code", tags=["Code"])

@app.get("/")
def health_check():
    return {"status": "AI MON Backend is running"}
