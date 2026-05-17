import httpx
import asyncio
from sqlalchemy.orm import Session
from shared.database import engine  # Fixed typo from 'engin'
from models import SimulationRun
from sqlalchemy import text
from datetime import datetime

def update_run(run_id, db, findings, mitigated, logs):
    run = db.query(SimulationRun).filter(SimulationRun.id == run_id).first()
    if run:
        run.status = "success"
        run.findings = findings
        run.mitigated = mitigated
        run.logs = logs
        db.commit()

def log_line(level: str, message: str) -> str:
    return f"[{datetime.utcnow().isoformat(timespec='seconds')}Z] {level}: {message}"


def protected(value: bool) -> str:
    return "PASS" if value else "FAIL"


async def simulate_rate_limiting(run_id: int, authorization: str | None = None):
    logs = ["Initiating Rate Limit Test on /auth/login"]
    mitigated = False
    target = "https://nginx/auth/login"
    
    async with httpx.AsyncClient(verify=False) as client:
        tasks = [client.post(target, json={"email": "test@test.com", "password": "..."}) for _ in range(15)]
        responses = await asyncio.gather(*tasks)
        
        status_codes = [r.status_code for r in responses]
        logs.append(f"Received status codes: {status_codes}")
        
        if 429 in status_codes:
            mitigated = True
            findings = "Control Validated: Nginx secureops_auth zone triggered 429 Too Many Requests."
        else:
            findings = "VULNERABILITY: Rate limiting failed to trigger."

    with Session(engine) as db:
        update_run(run_id, db, findings, mitigated, logs)


async def simulate_authz_bypass(run_id: int, authorization: str | None = None):
    logs = ["Attempting Unauthorized Access to /auth/users"]
    target = "https://nginx/auth/users"
    
    async with httpx.AsyncClient(verify=False) as client:
        response = await client.get(target)
        logs.append(f"Target: {target}, Response: {response.status_code}")
        
        if response.status_code in [401, 403]:
            mitigated = True
            findings = "Control Validated: Access denied to unauthenticated actor."
        else:
            mitigated = False
            findings = "VULNERABILITY: Unauthorized access granted to user list!"

    with Session(engine) as db:
        update_run(run_id, db, findings, mitigated, logs)


async def simulate_auth_abuse(run_id: int, authorization: str | None = None):
    logs = ["Initiating high-frequency Brute-Force Credential Stuffing simulation..."]
    target = "https://nginx/auth/login"
    status_codes = []
    
    total_attempts = 30
    fake_users = [f"test_attacker_{i}@company.local" for i in range(total_attempts)]
    
    async with httpx.AsyncClient(verify=False) as client:
        for user in fake_users:
            # All-inclusive payload to satisfy any variant of the LoginRequest Pydantic model
            json_payload = {
                "email": user,
                "username": user,
                "password": "Password123!",
                "remember_me": False
            }
            try:
                res = await client.post(target, json=json_payload, timeout=3.0)
                status_codes.append(res.status_code)
            except httpx.RequestError as e:
                status_codes.append(500)
                
    logs.append(f"Sent {total_attempts} high-speed bursts. Responses: {status_codes}")
    
    # Evaluation Matrix
    if 429 in status_codes:
        mitigated = True
        findings = f"Control Validated: Rate limiter successfully activated. Blocked traffic with status 429."
    elif 401 in status_codes or 403 in status_codes:
        # Some custom authentication handlers return 403 Forbidden instead of 401 Unauthorized
        mitigated = False
        findings = f"VULNERABILITY: Processed all {total_attempts} high-frequency authentication bursts without structural resistance (Returned failed credential statuses)."
    elif 422 in status_codes:
        mitigated = False
        findings = "ERROR: Schema validation failed (422). Please cross-reference 'json_payload' against the properties defined in the backend LoginRequest Pydantic model."
    else:
        mitigated = False
        findings = f"ANOMALOUS SEQUENCE: Received mixed or unexpected statuses: {list(set(status_codes))}"

    with Session(engine) as db:
        update_run(run_id, db, findings, mitigated, logs)
        
# NEW: Internal Service Protection Handler
async def simulate_internal_svc(run_id: int, authorization: str | None = None):
    logs = ["Probing perimeter vulnerabilities for unexposed services..."]
    # We attempt to hit Nginx on paths that should only be accessible internally or completely blocked
    target_private_route = "https://nginx/internal-status"
    
    async with httpx.AsyncClient(verify=False) as client:
        response = await client.get(target_private_route)
        logs.append(f"Probed internal context route. Status: {response.status_code}")
        
        if response.status_code in [401, 403, 404]:
            mitigated = True
            findings = "Control Validated: Internal context route blocked with 401/403/404. No private infrastructure data leaked outside container boundaries."
        else:
            mitigated = False
            findings = "CRITICAL VULNERABILITY: Exposed system topology discovered! Private infrastructure data leaked outside container boundaries."

    with Session(engine) as db:
        update_run(run_id, db, findings, mitigated, logs)


async def simulate_file_security_validation(run_id: int, authorization: str | None = None):
    logs = [log_line("INFO", "Starting File Security Validation against Secure File Vault endpoints.")]
    checks: list[bool] = []
    uploaded_file_id: int | None = None
    base_url = "https://nginx"
    headers = {"Authorization": authorization} if authorization else {}

    async with httpx.AsyncClient(timeout=20.0, verify=False) as client:
        valid_content = b"SecureOps file simulation validation\n"
        valid_upload = await client.post(
            f"{base_url}/files/upload",
            headers=headers,
            files={"file": ("simulation-valid.txt", valid_content, "text/plain")},
        )
        valid_ok = valid_upload.status_code == 201
        checks.append(valid_ok)
        logs.append(log_line(protected(valid_ok), f"Valid allowed .txt upload returned {valid_upload.status_code}; expected 201."))

        if valid_ok:
            try:
                uploaded_file_id = valid_upload.json()["data"]["id"]
                logs.append(log_line("INFO", f"Created encrypted vault test file #{uploaded_file_id}."))
            except (KeyError, TypeError, ValueError):
                logs.append(log_line("FAIL", "Valid upload response did not include a file id."))
                checks.append(False)

        dangerous_results: list[str] = []
        dangerous_ok = True
        dangerous_payloads = [
            ("malware.exe", b"MZ"),
            ("webshell.php", b"<?php echo 1;"),
            ("payload.js", b"alert(1);"),
            ("script.bat", b"@echo off"),
            ("shell.sh", b"#!/bin/sh\nid"),
        ]
        for filename, content in dangerous_payloads:
            response = await client.post(
                f"{base_url}/files/upload",
                headers=headers,
                files={"file": (filename, content, "application/octet-stream")},
            )
            blocked = response.status_code in {400, 415, 422}
            dangerous_ok = dangerous_ok and blocked
            dangerous_results.append(f"{filename}:{response.status_code}")
        checks.append(dangerous_ok)
        logs.append(log_line(protected(dangerous_ok), f"Dangerous extensions blocked results [{', '.join(dangerous_results)}]; expected 4xx."))

        oversized_content = b"a" * (11 * 1024 * 1024)
        oversized = await client.post(
            f"{base_url}/files/upload",
            headers=headers,
            files={"file": ("simulation-oversized.txt", oversized_content, "text/plain")},
        )
        oversized_ok = oversized.status_code == 413
        checks.append(oversized_ok)
        logs.append(log_line(protected(oversized_ok), f"Oversized file upload returned {oversized.status_code}; expected 413."))

        if uploaded_file_id is not None:
            unauthorized = await client.get(f"{base_url}/files/{uploaded_file_id}/download")
            unauthorized_ok = unauthorized.status_code in {401, 403}
            checks.append(unauthorized_ok)
            logs.append(log_line(protected(unauthorized_ok), f"Unauthenticated download attempt returned {unauthorized.status_code}; expected 401/403."))

            verify_original = await client.post(
                f"{base_url}/files/{uploaded_file_id}/verify-integrity",
                headers=headers,
            )
            verify_original_ok = (
                verify_original.status_code == 200
                and verify_original.json().get("data", {}).get("integrity_status") == "passed"
            )
            checks.append(verify_original_ok)
            logs.append(log_line(protected(verify_original_ok), f"Original file integrity verification returned {verify_original.status_code}; expected passed."))

            with Session(engine) as db:
                db.execute(
                    text("UPDATE secure_files SET encrypted_sha256 = :tampered WHERE id = :file_id"),
                    {"tampered": "0" * 64, "file_id": uploaded_file_id},
                )
                db.commit()
            logs.append(log_line("INFO", f"Tampered simulation metadata for file #{uploaded_file_id} to force encrypted SHA-256 mismatch."))

            verify_tampered = await client.post(
                f"{base_url}/files/{uploaded_file_id}/verify-integrity",
                headers=headers,
            )
            verify_tampered_ok = (
                verify_tampered.status_code == 200
                and verify_tampered.json().get("data", {}).get("integrity_status") == "failed"
            )
            checks.append(verify_tampered_ok)
            logs.append(log_line(protected(verify_tampered_ok), f"Tampered encrypted-file integrity check returned {verify_tampered.status_code}; expected failed status."))

            await client.delete(f"{base_url}/files/{uploaded_file_id}", headers=headers)
        else:
            checks.extend([False, False, False])
            logs.append(log_line("FAIL", "Skipped download, original integrity, and tamper checks because valid upload did not create a file id."))

    mitigated = all(checks)
    findings = (
        "Protected: Secure File Vault controls validated for allowed upload, dangerous extension blocking, size limits, access control, and SHA-256 integrity mismatch detection."
        if mitigated
        else "Vulnerable: One or more Secure File Vault protections did not return the expected defensive result. Review diagnostic PASS/FAIL lines."
    )

    with Session(engine) as db:
        update_run(run_id, db, findings, mitigated, logs)
