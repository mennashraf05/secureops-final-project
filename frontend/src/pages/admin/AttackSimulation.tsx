import { useState, useEffect } from 'react';
import { ShieldAlert, Swords, Loader2, CheckCircle2, XCircle, RefreshCw, Clock, ChevronDown, ChevronUp, Terminal, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { Button } from '../../components/ui/Button';
import { simulationApi } from '../../api/simulation';
import type { SimulationResult } from '../../types/simulation';

const SCENARIOS = [
  { id: 'auth-abuse', name: 'Authentication abuse checks', icon: 'swords' },
  { id: 'authz-bypass', name: 'Authorization bypass attempts', icon: 'swords' },
  { id: 'rate-limit', name: 'Rate limiting validation', icon: 'swords' },
  { id: 'internal-svc', name: 'Internal service protection checks', icon: 'swords' },
  { id: 'file-security', name: 'File Security Validation', icon: 'shield' },
];

export default function AttackSimulation() {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [results, setResults] = useState<Record<string, 'success' | 'failed' | null>>({});
  const [history, setHistory] = useState<SimulationResult[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  // NEW: Track which specific log rows are toggled/expanded in the UI
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const getScenarioName = (id: string) => {
    return SCENARIOS.find(s => s.id === id)?.name || id;
  };

  const toggleRow = (id: number) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isRunPending = (run: SimulationResult) => run.status === 'running' || run.mitigated === null || run.mitigated === undefined;

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await simulationApi.getHistory();
      if (response.success && response.data) {
        setHistory(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch simulation logs:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const waitForRunCompletion = async (runId?: number) => {
    if (!runId) return null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise(resolve => window.setTimeout(resolve, 1000));
      const response = await simulationApi.getHistory();
      const run = response.data?.find(item => item.id === runId);
      if (run && run.status !== 'running') {
        setHistory(response.data);
        return run;
      }
    }

    await fetchHistory();
    return null;
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (!history.some(run => isRunPending(run))) return;

    const timeout = window.setTimeout(() => {
      void fetchHistory();
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [history]);

  const handleRunSimulation = async (id: string) => {
    setRunningId(id);
    try {
      const response = await simulationApi.runScenario(id);
      if (response.success) {
        setResults(prev => ({ ...prev, [id]: 'success' }));
      }
    } catch (error) {
      console.error("Simulation failed:", error);
      setResults(prev => ({ ...prev, [id]: 'failed' }));
    } finally {
      setRunningId(null);
      fetchHistory();
    }
  };

  const handleRunAllScenarios = async () => {
    if (isRunningAll || runningId) return;
    setIsRunningAll(true);
    setResults({});

    try {
      for (const scenario of SCENARIOS) {
        setRunningId(scenario.id);
        try {
          const response = await simulationApi.runScenario(scenario.id);
          const completedRun = await waitForRunCompletion(response.data?.id);
          setResults(prev => ({ ...prev, [scenario.id]: response.success && completedRun?.mitigated !== false ? 'success' : 'failed' }));
        } catch (error) {
          console.error(`Simulation ${scenario.id} failed:`, error);
          setResults(prev => ({ ...prev, [scenario.id]: 'failed' }));
        }
      }
    } finally {
      setRunningId(null);
      setIsRunningAll(false);
      fetchHistory();
    }
  };

  const handleClearHistory = async () => {
    if (runningId || isRunningAll || isClearingHistory) return;
    if (!window.confirm('Clear all simulation execution history?')) return;

    setIsClearingHistory(true);
    try {
      await simulationApi.clearHistory();
      setHistory([]);
      setExpandedRows({});
      setResults({});
    } catch (error) {
      console.error("Failed to clear simulation logs:", error);
    } finally {
      setIsClearingHistory(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Attack Simulation Lab"
        subtitle="Validate security controls by executing controlled, safe attack patterns against the infrastructure."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <SectionCard title="Command Center" dark>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-cyan-100/70">
                Select a scenario below to begin real-time security validation.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" onClick={handleRunAllScenarios} disabled={!!runningId || isRunningAll}>
                  {isRunningAll ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running {getScenarioName(runningId || '')}</>
                  ) : 'Run All Scenarios'}
                </Button>
                <Button variant="dark" onClick={() => setResults({})}>Reset Lab</Button>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-2">
          <SectionCard
            title="Lab Execution History"
            subtitle="Real-time persistent audit logs directly from the backend security engine."
          >
            <div className="mb-4 flex justify-end gap-2">
              <Button variant="ghost" className="text-xs" onClick={fetchHistory} disabled={loadingHistory}>
                {loadingHistory ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3 w-3" />
                )}
                Refresh Logs
              </Button>
              <Button
                variant="danger"
                className="text-xs"
                onClick={handleClearHistory}
                disabled={isClearingHistory || !!runningId || isRunningAll || history.length === 0}
              >
                {isClearingHistory ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="mr-1 h-3 w-3" />
                )}
                Clear Logs
              </Button>
            </div>

            {/* Expanded layout frame constraints to handle dynamic nested console windows */}
            <div className="overflow-x-auto rounded-xl border border-slate-100 max-h-[400px] overflow-y-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 w-8"></th>
                    <th className="px-4 py-3">Run ID</th>
                    <th className="px-4 py-3">Scenario</th>
                    <th className="px-4 py-3">Mitigation Control</th>
                    <th className="px-4 py-3">Executed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No simulation runs detected in database. Trigger an execution below.
                      </td>
                    </tr>
                  ) : (
                    // Sorts history by ID descending (highest/newest runs first) before mapping
                    [...history]
                      .sort((a, b) => b.id - a.id)
                      .map((run) => (
                        <>
                          {/* Parent Row Toggle Trigger */}
                          <tr
                            key={run.id}
                            className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                            onClick={() => toggleRow(run.id)}
                          >
                            <td className="px-4 py-3 text-slate-400">
                              {expandedRows[run.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-400">#{run.id}</td>
                            <td className="px-4 py-3 font-medium text-slate-700">{getScenarioName(run.scenario_id)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${isRunPending(run)
                                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20'
                                  : run.mitigated
                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                                    : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
                                }`}>
                                {isRunPending(run) ? (
                                  <><Loader2 className="h-3 w-3 animate-spin" /> Running</>
                                ) : run.mitigated ? 'Protected' : 'Vulnerable'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400 inline-flex items-center gap-1">
                              <Clock size={12} />
                              {run.created_at ? new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}
                            </td>
                          </tr>

                          {/* Expandable Box containing JSON logs and backend structural findings string */}
                          {expandedRows[run.id] && (
                            <tr className="bg-slate-50/60" key={`expanded-${run.id}`}>
                              <td colSpan={5} className="px-6 py-4">
                                <div className="flex flex-col gap-3 rounded-lg border border-slate-200/80 bg-slate-900 p-4 font-mono text-xs text-slate-200 shadow-inner">
                                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-cyan-400 font-semibold">
                                    <Terminal size={14} />
                                    <span>Simulation Engine Diagnostics Output</span>
                                  </div>

                                  <div className="space-y-1">
                                    <span className="text-slate-400 block mb-1 font-bold">// Summary Finding Matrix:</span>
                                    <p className={`${isRunPending(run) ? 'text-blue-300' : run.mitigated ? 'text-emerald-400' : 'text-rose-400'} italic whitespace-normal`}>
                                      {run.findings || (isRunPending(run) ? "Simulation is still running. Results will appear when the backend finishes validation." : "No findings recorded for this simulation loop run.")}
                                    </p>
                                  </div>

                                  <div className="space-y-1 mt-2">
                                    <span className="text-slate-400 block mb-1 font-bold">// Engine Action Stack Logs:</span>
                                    {Array.isArray(run.logs) && run.logs.length > 0 ? (
                                      run.logs.map((logStr, index) => (
                                        <div key={index} className="text-slate-300 whitespace-pre-wrap border-l-2 border-slate-700 pl-2 py-0.5">
                                          {logStr}
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-slate-500 italic">{isRunPending(run) ? 'Waiting for structured step-by-step logs...' : 'No structured step-by-step logs parsed.'}</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>

      <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {SCENARIOS.map((scenario) => (
          <SectionCard
            key={scenario.id}
            title={scenario.name}
            subtitle={runningId === scenario.id ? "Executing..." : "Ready for validation"}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className={`rounded-2xl p-3 ring-1 ${results[scenario.id] === 'success' ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' :
                    results[scenario.id] === 'failed' ? 'bg-red-50 text-red-600 ring-red-100' :
                      'bg-blue-50 text-blue-700 ring-blue-100'
                  }`}>
                  {scenario.icon === 'shield' ? <ShieldAlert size={22} /> : <Swords size={22} />}
                </div>
                <div className="text-sm leading-6 text-slate-500">
                  {results[scenario.id] === 'success' ? 'Control Validated' : 'Status: Inactive'}
                </div>
              </div>

              {results[scenario.id] === 'success' && <CheckCircle2 className="text-emerald-500" size={20} />}
              {results[scenario.id] === 'failed' && <XCircle className="text-red-500" size={20} />}
            </div>

            <Button
              className="mt-4 w-full"
              variant={results[scenario.id] ? "ghost" : "primary"}
              disabled={!!runningId}
              onClick={() => handleRunSimulation(scenario.id)}
            >
              {runningId === scenario.id ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running</>
              ) : results[scenario.id] ? 'Run Again' : 'Execute Simulation'}
            </Button>
          </SectionCard>
        ))}
      </section>
    </>
  );
}
