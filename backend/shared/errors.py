from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


def safe_http_error(
    status_code: int = 500,
    message: str = "Request could not be completed.",
) -> HTTPException:
    return HTTPException(status_code=status_code, detail=message)


async def safe_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal server error.",
            "data": None,
        },
    )


async def safe_http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "Request could not be completed."
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": detail,
            "data": None,
        },
    )
