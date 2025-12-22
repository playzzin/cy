
import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faCode, faPalette, faCheck, faSave, faTrash, faPlus } from '@fortawesome/free-solid-svg-icons';
import Button from '../../components/ui/Button';

const ComponentGalleryPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('buttons');

    const renderButtons = () => (
        <div className="space-y-8">
            {/* Variants */}
            <section>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faPalette} className="text-indigo-500" /> Variants
                </h3>
                <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4">
                    <Button variant="primary">Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="danger">Danger</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                </div>
            </section>

            {/* Sizes */}
            <section>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faCube} className="text-indigo-500" /> Sizes
                </h3>
                <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
                    <Button size="sm" variant="primary">Small</Button>
                    <Button size="md" variant="primary">Medium</Button>
                    <Button size="lg" variant="primary">Large</Button>
                </div>
            </section>

            {/* States */}
            <section>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faCheck} className="text-indigo-500" /> States & Icons
                </h3>
                <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4">
                    <Button variant="primary" icon={faSave}>Save</Button>
                    <Button variant="danger" icon={faTrash}>Delete</Button>
                    <Button variant="primary" isLoading>Loading</Button>
                    <Button variant="secondary" disabled>Disabled</Button>
                </div>
            </section>

            {/* Usage Code */}
            <section>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faCode} className="text-indigo-500" /> Usage
                </h3>
                <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto text-slate-300 font-mono text-sm shadow-inner">
                    <pre>{`import Button from '../../components/ui/Button';
import { faSave } from '@fortawesome/free-solid-svg-icons';

<Button variant="primary" icon={faSave} onClick={handleSave}>
    저장하기
</Button>`}
                    </pre>
                </div>
            </section>
        </div>
    );

    return (
        <div className="max-w-[1600px] mx-auto p-6 min-h-screen bg-slate-50">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                    <span className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                        <FontAwesomeIcon icon={faCube} />
                    </span>
                    컴포넌트 라이브러리 (Design System)
                </h1>
                <p className="text-slate-500 mt-2 ml-16">
                    프로젝트에서 공통으로 사용되는 재사용 가능한 컴포넌트들을 관리하고 미리볼 수 있습니다.
                </p>
            </div>

            <div className="grid grid-cols-12 gap-8">
                {/* Sidebar */}
                <div className="col-span-12 md:col-span-3 lg:col-span-2">
                    <nav className="space-y-1">
                        <button
                            onClick={() => setActiveTab('buttons')}
                            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === 'buttons' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/50'}`}
                        >
                            Buttons
                        </button>
                        <button
                            disabled
                            className="w-full text-left px-4 py-3 rounded-lg font-medium text-slate-400 cursor-not-allowed flex justify-between items-center"
                        >
                            Inputs <span className="text-[10px] bg-slate-200 px-1.5 rounded">Coming Soon</span>
                        </button>
                        <button
                            disabled
                            className="w-full text-left px-4 py-3 rounded-lg font-medium text-slate-400 cursor-not-allowed flex justify-between items-center"
                        >
                            Cards <span className="text-[10px] bg-slate-200 px-1.5 rounded">Coming Soon</span>
                        </button>
                    </nav>
                </div>

                {/* Content */}
                <div className="col-span-12 md:col-span-9 lg:col-span-10">
                    {activeTab === 'buttons' && renderButtons()}
                </div>
            </div>
        </div>
    );
};

export default ComponentGalleryPage;
