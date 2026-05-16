import { request, ApiResponse } from './client';
import { SimulationResult } from '../types/simulation';

// Fallback logic for local development if the Vite environment variable isn't injected
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const simulationApi = {
  // Triggers a specific attack scenario
  runScenario: async (scenarioId: string): Promise<ApiResponse<SimulationResult>> => {
    return request<ApiResponse<SimulationResult>>(`/simulations/run/${scenarioId}`, {
      method: 'POST',
    });
  },

  getHistory: async (): Promise<ApiResponse<SimulationResult[]>> => {
    return request<ApiResponse<SimulationResult[]>>('/simulations/history', {
      method: 'GET',
    });
  }
};