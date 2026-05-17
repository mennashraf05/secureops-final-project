from fastapi import FastAPI, Depends, BackgroundTasks, HTTPException, Header, status
from sqlalchemy.orm import Session
import httpx  # Added for internal service-to-service communication
from shared.database import get_db, Base, engine
from shared.responses import success_response
from models import SimulationRun
import engine as simulator

app = FastAPI(title="SecureOps Simulation Lab")

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

# Delegated Validation: Completely decoupled from JWT parsing and database syncing
async def require_admin(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid authentication scheme"
        )
    
    # Interrogate the secureops-auth-service container across the bridge network
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "http://secureops-auth-service:8000/auth/me",
                headers={"Authorization": authorization}
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service is currently unreachable"
            )

    # If the auth-service says 401 or 422, match and pass that failure along
    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail="Authentication failed or session expired"
        )

    user_wrapper = response.json()
    
    # Extract structural role from user_response schema out of your auth-service
    # Checks both wrapped data structures and flat structures safely
    user_data = user_wrapper.get("data", user_wrapper) if isinstance(user_wrapper, dict) else {}
    role = user_data.get("role")
    
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Admin privileges required"
        )
        
    return user_data

@app.post("/simulations/run/{scenario_id}")
async def run_simulation(
    scenario_id: str,
    background_tasks: BackgroundTasks,
    authorization: str = Header(...),
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    new_run = SimulationRun(scenario_id=scenario_id, status="running")
    db.add(new_run)
    db.commit()
    db.refresh(new_run)

    scenarios = {
        "rate-limit": simulator.simulate_rate_limiting,
        "authz-bypass": simulator.simulate_authz_bypass,
        "auth-abuse": simulator.simulate_auth_abuse,       
        "internal-svc": simulator.simulate_internal_svc,
        "file-security": simulator.simulate_file_security_validation,
    }

    if scenario_id not in scenarios:
        raise HTTPException(status_code=404, detail="Scenario not found")

    background_tasks.add_task(scenarios[scenario_id], new_run.id, authorization)
    return success_response(f"Simulation {scenario_id} started.", {"id": new_run.id})

@app.get("/simulations/history")
async def get_history(db: Session = Depends(get_db), current_user = Depends(require_admin)):
    history = db.query(SimulationRun).order_by(SimulationRun.created_at.desc()).all()
    return success_response("History retrieved.", history)


@app.delete("/simulations/history")
async def clear_history(db: Session = Depends(get_db), current_user = Depends(require_admin)):
    deleted_count = db.query(SimulationRun).delete(synchronize_session=False)
    db.commit()
    return success_response("Simulation history cleared.", {"deleted_count": deleted_count})
