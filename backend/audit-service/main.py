from fastapi import FastAPI, HTTPException

from shared.errors import safe_exception_handler, safe_http_exception_handler


SERVICE_NAME = "audit-service"

app = FastAPI(title="SecureOps Audit Service")
app.add_exception_handler(Exception, safe_exception_handler)
app.add_exception_handler(HTTPException, safe_http_exception_handler)


def health_response() -> dict[str, str]:
    return {"service": SERVICE_NAME, "status": "healthy"}


@app.get("/health")
def health() -> dict[str, str]:
    return health_response()


@app.get("/audit/health")
def audit_gateway_health() -> dict[str, str]:
    return health_response()


@app.get("/security/health")
def security_gateway_health() -> dict[str, str]:
    return health_response()
