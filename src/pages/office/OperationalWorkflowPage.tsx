import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardList } from 'lucide-react';

export interface WorkflowAction {
    label: string;
    description: string;
    path: string;
}

interface OperationalWorkflowPageProps {
    eyebrow?: string;
    title: string;
    description: string;
    actions: WorkflowAction[];
}

export default function OperationalWorkflowPage({
    eyebrow = '업무 허브',
    title,
    description,
    actions,
}: OperationalWorkflowPageProps) {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
            <div className="mx-auto max-w-5xl">
                <div className="mb-5">
                    <div className="flex items-center gap-2 text-sm font-bold text-cyan-700">
                        <ClipboardList className="h-4 w-4" />
                        {eyebrow}
                    </div>
                    <h1 className="mt-1 text-2xl font-black text-slate-900">{title}</h1>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{description}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    {actions.map((action) => (
                        <button
                            key={action.path}
                            type="button"
                            onClick={() => navigate(action.path)}
                            className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            <span className="min-w-0">
                                <span className="block text-sm font-black text-slate-900">{action.label}</span>
                                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{action.description}</span>
                            </span>
                            <ArrowRight className="h-4 w-4 shrink-0 text-cyan-600" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
