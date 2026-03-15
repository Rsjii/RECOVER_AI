// EngineeringOS Phase 1 — Onboarding Wizard (6 steps)
import { useQuery } from '@tanstack/react-query';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from '../../config/axios';
import Step1GitHub from './Step1GitHub';
import Step2Jira from './Step2Jira';
import Step3TeamMapping from './Step3TeamMapping';
import Step4Configure from './Step4Configure';
import Step5Preview from './Step5Preview';
import Step6Done from './Step6Done';

const STEPS = [
  { id: 1, label: 'GitHub',   path: 'github' },
  { id: 2, label: 'Jira',     path: 'jira' },
  { id: 3, label: 'Team',     path: 'team' },
  { id: 4, label: 'Configure',path: 'configure' },
  { id: 5, label: 'Preview',  path: 'preview' },
  { id: 6, label: 'Done',     path: 'done' },
];

function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all ${
            step.id < current
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : step.id === current
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-slate-800 border-slate-700 text-slate-600'
          }`}>
            {step.id < current ? '✓' : step.id}
          </div>
          <span className={`mx-1.5 text-xs hidden sm:block ${
            step.id === current ? 'text-indigo-300' : 'text-slate-600'
          }`}>{step.label}</span>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-0.5 mx-1 ${step.id < current ? 'bg-indigo-600' : 'bg-slate-800'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();

  const { data: status } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: () => axios.get('/api/onboarding/status').then(r => r.data),
    refetchInterval: 5000,
  });

  // If onboarding is complete, redirect to dashboard
  if (status?.completed) {
    return <Navigate to="/dashboard" replace />;
  }

  const currentStep =
    !status?.step_github ? 1
    : !status?.step_jira ? 2
    : !status?.step_team_mapped ? 3
    : !status?.step_configured ? 4
    : !status?.step_previewed ? 5
    : 6;

  return (
    <div className="min-h-screen bg-[#060910] flex flex-col items-center justify-start pt-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-xl">⚡</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Set up EngineeringOS</h1>
          <p className="text-slate-500 text-sm mt-1">Connect your tools. Get your first brief in minutes.</p>
        </div>

        <StepProgress current={currentStep} />

        <div className="bg-[#0d1117] rounded-2xl border border-slate-800 p-8">
          <Routes>
            <Route path="/" element={<Navigate to="github" replace />} />
            <Route path="github"    element={<Step1GitHub onNext={() => navigate('/onboarding/jira')} status={status} />} />
            <Route path="jira"      element={<Step2Jira onNext={() => navigate('/onboarding/team')} status={status} />} />
            <Route path="team"      element={<Step3TeamMapping onNext={() => navigate('/onboarding/configure')} />} />
            <Route path="configure" element={<Step4Configure onNext={() => navigate('/onboarding/preview')} />} />
            <Route path="preview"   element={<Step5Preview onNext={() => navigate('/onboarding/done')} />} />
            <Route path="done"      element={<Step6Done />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
