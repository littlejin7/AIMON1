from dotenv import load_dotenv
import os
import subprocess
import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="passlib")
from contextlib import asynccontextmanager
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))


def _detect_version() -> str:
    """배포 시 GIT_COMMIT_SHA 환경변수로 주입, 없으면 git 직접 조회, 둘 다 없으면 "dev"."""
    v = os.getenv("GIT_COMMIT_SHA", "").strip()
    if v:
        return v
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except Exception:
        return "dev"


_SERVER_VERSION = _detect_version()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, quiz, boss, endboss, miniboss, progress, user, code, train, titles, game, game_aicross, game_ranking, mission, admin, attempts, guide


@asynccontextmanager
async def lifespan(app: FastAPI):
    from scheduler import scheduler
    # 멀티워커(gunicorn -w N / uvicorn --workers N) 환경에서 모든 워커가
    # scheduler.start()를 호출하면 스트릭 이메일 중복 발송·백업 중복 실행이 발생한다.
    # 운영: 스케줄러를 담당할 워커 1개에만 RUN_SCHEDULER=1 을 주거나,
    #       별도 단일 프로세스(worker role)로 분리해 RUN_SCHEDULER=1 을 부여한다.
    # 로컬 단일 워커: 미설정 시 편의상 1로 취급해 스케줄러를 켠다.
    # Advisory lock 대안: DB 레벨 pg_try_advisory_lock 으로 선착 워커만 잡아도 됨.
    if os.getenv("RUN_SCHEDULER", "1") == "1":
        scheduler.start()
    yield
    if scheduler.running:
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


def _expand_local_dev_origins(values: list[str]) -> list[str]:
    expanded: list[str] = []
    seen: set[str] = set()

    def _add(origin: str) -> None:
        if origin and origin not in seen:
            seen.add(origin)
            expanded.append(origin)

    for origin in values:
        _add(origin)
        if origin.startswith("http://localhost:"):
            _add(origin.replace("http://localhost:", "http://127.0.0.1:", 1))
        elif origin.startswith("http://127.0.0.1:"):
            _add(origin.replace("http://127.0.0.1:", "http://localhost:", 1))

    return expanded


origins = _expand_local_dev_origins(origins)

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
app.include_router(attempts.router, prefix="/attempts", tags=["Attempts"])
app.include_router(titles.router, prefix="/titles", tags=["Titles"])
app.include_router(game.router, prefix="/game", tags=["Game"])
app.include_router(game_aicross.router, prefix="/game", tags=["Game"])
app.include_router(game_ranking.router, prefix="/game", tags=["Game"])
app.include_router(mission.router, prefix="/missions", tags=["Missions"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(guide.router, prefix="/guide", tags=["Guide"])

@app.get("/")
def health_check():
    return {"status": "AI MON Backend is running"}


@app.get("/version")
def get_version():
    return {"version": _SERVER_VERSION}
