import httpx
import asyncio
from sqlalchemy.orm import Session
from shared.database import engine  # Fixed typo from 'engin'
from models import SimulationRun

def update_run(run_id, db, findings, mitigated, logs):
    run = db.query(SimulationRun).filter(SimulationRun.id == run_id).first()
    if run:
        run.status = "success"
        run.findings = findings
        run.mitigated = mitigated
        run.logs = logs
        db.commit()

async def simulate_rate_limiting(run_id: int):
    logs = ["Initiating Rate Limit Test on /auth/login"]
    mitigated = False
    target = "http://nginx/auth/login"
    
    async with httpx.AsyncClient() as client:
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


async def simulate_authz_bypass(run_id: int):
    logs = ["Attempting Unauthorized Access to /auth/users"]
    target = "http://nginx/auth/users"
    
    async with httpx.AsyncClient() as client:
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


async def simulate_auth_abuse(run_id: int):
    logs = ["Initiating high-frequency Brute-Force Credential Stuffing simulation..."]
    target = "http://nginx/auth/login"
    status_codes = []
    
    total_attempts = 30
    fake_users = [f"test_attacker_{i}@company.local" for i in range(total_attempts)]
    
    async with httpx.AsyncClient() as client:
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
async def simulate_internal_svc(run_id: int):
    logs = ["Probing perimeter vulnerabilities for unexposed services..."]
    # We attempt to hit Nginx on paths that should only be accessible internally or completely blocked
    target_private_route = "http://nginx/internal-status"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(target_private_route)
        logs.append(f"Probed internal context route. Status: {response.status_code}")
        
        if response.status_code in [403, 404]:
            mitigated = True
            findings = "Control Validated: Internal service mesh routes and configuration contexts are correctly isolated from upstream reverse-proxy configurations."
        else:
            mitigated = False
            findings = "CRITICAL VULNERABILITY: Exposed system topology discovered! Private infrastructure data leaked outside container boundaries."

    with Session(engine) as db:
        update_run(run_id, db, findings, mitigated, logs)