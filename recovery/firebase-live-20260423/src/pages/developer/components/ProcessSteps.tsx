import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheckCircle,
    faSpinner,
    faClock,
    faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

export type StepStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface ProcessStep {
    id: string;
    label: string;
    status: StepStatus;
    message?: string;
    startTime?: Date;
    endTime?: Date;
}

interface ProcessStepsProps {
    steps: ProcessStep[];
    currentStepIndex?: number;
}

const ProcessSteps: React.FC<ProcessStepsProps> = ({ steps, currentStepIndex }) => {
    const getStepIcon = (status: StepStatus) => {
        switch (status) {
            case 'completed':
                return faCheckCircle;
            case 'processing':
                return faSpinner;
            case 'error':
                return faExclamationTriangle;
            default:
                return faClock;
        }
    };

    const getStepColor = (status: StepStatus) => {
        switch (status) {
            case 'completed':
                return 'text-green-400';
            case 'processing':
                return 'text-blue-400';
            case 'error':
                return 'text-red-400';
            default:
                return 'text-slate-500';
        }
    };

    const getStepBorderColor = (status: StepStatus) => {
        switch (status) {
            case 'completed':
                return 'border-green-400';
            case 'processing':
                return 'border-blue-400';
            case 'error':
                return 'border-red-400';
            default:
                return 'border-slate-700';
        }
    };

    const formatDuration = (start?: Date, end?: Date) => {
        if (!start) return '';
        const endTime = end || new Date();
        const duration = endTime.getTime() - start.getTime();
        return `${(duration / 1000).toFixed(1)}s`;
    };

    return (
        <div className="space-y-3">
            {steps.map((step, index) => (
                <div key={step.id} className="flex items-start gap-3">
                    {/* Connection Line */}
                    <div className="flex flex-col items-center">
                        {/* Icon */}
                        <div
                            className={`w-8 h-8 rounded-full border-2 ${getStepBorderColor(
                                step.status
                            )} bg-slate-800 flex items-center justify-center z-10`}
                        >
                            <FontAwesomeIcon
                                icon={getStepIcon(step.status)}
                                className={`${getStepColor(step.status)} text-sm ${step.status === 'processing' ? 'animate-spin' : ''
                                    }`}
                            />
                        </div>

                        {/* Vertical Line */}
                        {index < steps.length - 1 && (
                            <div
                                className={`w-0.5 h-8 ${step.status === 'completed'
                                        ? 'bg-green-400/30'
                                        : 'bg-slate-700'
                                    }`}
                            />
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                            <h4
                                className={`font-medium ${step.status === 'processing'
                                        ? 'text-white'
                                        : 'text-slate-300'
                                    }`}
                            >
                                {step.label}
                            </h4>
                            {step.startTime && (
                                <span className="text-xs text-slate-500">
                                    {formatDuration(step.startTime, step.endTime)}
                                </span>
                            )}
                        </div>
                        {step.message && (
                            <p className="text-sm text-slate-400 mt-1">{step.message}</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProcessSteps;
