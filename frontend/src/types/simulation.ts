export type SimulationStatus = 'idle' | 'running' | 'success' | 'failed';

export interface SimulationResult {
  id: number;
  scenario_id: string;
  // UPDATED: Added 'running' and 'completed' to match all possible states 
  // used by your component conditional classes
  status: 'running' | 'completed' | 'failed' | 'success' | 'pending';
  findings?: string;
  mitigated: boolean;
  logs: string[];
  // UPDATED: Kept as created_at since your SQLAlchemy model defines it as created_at
  created_at: string; 
}