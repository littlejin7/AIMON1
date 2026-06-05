import httpx
import os

JUDGE0_BASE_URL = os.getenv("JUDGE0_BASE_URL", "https://judge0-ce.p.rapidapi.com")
JUDGE0_API_KEY  = os.getenv("JUDGE0_API_KEY", "")

HEADERS = {
    "x-rapidapi-host": "judge0-ce.p.rapidapi.com",
    "x-rapidapi-key": JUDGE0_API_KEY,
    "Content-Type": "application/json",
}

# Judge0 언어 ID: Python 3
PYTHON3_LANG_ID = 71


async def run_code(source_code: str, stdin: str = "") -> dict:
    """
    Judge0 API에 코드를 제출하고 실행 결과를 반환합니다.
    반환 형태: {"stdout": str, "stderr": str, "status": str, "compile_output": str}
    """
    async with httpx.AsyncClient(timeout=20.0) as client:
        # 1) 제출
        submit_res = await client.post(
            f"{JUDGE0_BASE_URL}/submissions",
            headers=HEADERS,
            params={"base64_encoded": "false", "wait": "true"},
            json={
                "language_id": PYTHON3_LANG_ID,
                "source_code": source_code,
                "stdin": stdin,
            },
        )
        submit_res.raise_for_status()
        result = submit_res.json()

    return {
        "stdout":         (result.get("stdout") or "").strip(),
        "stderr":         (result.get("stderr") or "").strip(),
        "compile_output": (result.get("compile_output") or "").strip(),
        "status":         result.get("status", {}).get("description", "Unknown"),
    }
