from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean
from shared.database import Base
import datetime

class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id = Column(Integer, primary_key=True, index=True)
    scenario_id = Column(String(50), nullable=False)
    status = Column(String(20)) # success, failed
    findings = Column(String(500))
    mitigated = Column(Boolean) # True if security controls blocked the attack
    logs = Column(JSON, default=[])
    created_at = Column(DateTime, default=datetime.datetime.utcnow)