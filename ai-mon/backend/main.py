from dotenv import load_dotenv
import os
import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="passlib")
from contextlib import asynccontextmanager
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, quiz, boss, endboss, miniboss, progress, user, code, train, titles, game, mission, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    from scheduler import scheduler
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(title="AI MON API - MVP", version="1.0.0", lifespan=lifespan)

from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from routers.utils import limiter
from fastapi.responses import JSONResponse

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_exceeded_handler(request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."}
    )

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
app.include_router(mission.router, prefix="/missions", tags=["Missions"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])

@app.get("/")
def health_check():
    return {"status": "AI MON Backend is running"}
