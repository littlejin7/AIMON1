from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from jose import jwt, JWTError
from services.judge0_service import execute_code
import os

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")


def verify_token(authorization: str) -> str:
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")


class CodeRunRequest(BaseModel):
    source_code: str
    language_id: int = 71  # Python 3 default
    stdin: str = ""


@router.post("/run")
async def run_code(req: CodeRunRequest, authorization: str = Header(...)):
    verify_token(authorization)
    result = await execute_code(
        source_code=req.source_code,
        language_id=req.language_id,
        stdin=req.stdin,
    )
    return result
