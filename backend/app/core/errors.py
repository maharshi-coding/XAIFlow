from fastapi import HTTPException


def api_error(status: int, code: str, message: str, details=None):
    detail = {"code": code, "message": message}
    if details is not None:
        detail["details"] = details
    return HTTPException(status_code=status, detail=detail)
