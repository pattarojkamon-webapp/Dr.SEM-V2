
import React, { useState, useEffect } from 'react';
import { Theme } from '../types';
import { CheckSquare, Square, ChevronDown, ChevronRight, PieChart, RefreshCw } from 'lucide-react';

interface SemChecklistProps {
    theme: Theme;
}

interface ChecklistItem {
    id: string;
    label: string;
    description?: string;
}

interface ChecklistSection {
    id: string;
    title: string;
    items: ChecklistItem[];
}

const SEM_SECTIONS: ChecklistSection[] = [
    {
        id: 'phase1',
        title: 'Phase 1: Conceptualization',
        items: [
            { id: '1.1', label: 'Literature Review Completed', description: 'Theoretical framework is solidly based on existing literature.' },
            { id: '1.2', label: 'Hypotheses Defined', description: 'Directional relationships between Latent variables are clearly stated.' },
            { id: '1.3', label: 'Model Specification', description: 'Distinction between Exogenous and Endogenous variables is clear.' }
        ]
    },
    {
        id: 'phase2',
        title: 'Phase 2: Data Preparation',
        items: [
            { id: '2.1', label: 'Instrument Validity (IOC)', description: 'Item-Objective Congruence checked by experts.' },
            { id: '2.2', label: 'Pilot Test Reliability', description: 'Cronbach’s Alpha > 0.70 for all scales.' },
            { id: '2.3', label: 'Sample Size Sufficiency', description: 'N > 200 or 10-20x parameters (Kline, 2023).' },
            { id: '2.4', label: 'Normality Check', description: 'Skewness/Kurtosis within range (+-3).' },
            { id: '2.5', label: 'Outliers & Missing Data', description: 'Mahalanobis distance check and imputation handled.' }
        ]
    },
    {
        id: 'phase3',
        title: 'Phase 3: Measurement Model (CFA)',
        items: [
            { id: '3.1', label: 'Factor Loadings > 0.50', description: 'Ideally > 0.70 for strong indicators.' },
            { id: '3.2', label: 'Model Fit Indices Acceptable', description: 'CFI/TLI > 0.90, RMSEA < 0.08, SRMR < 0.08.' },
            { id: '3.3', label: 'Convergent Validity (AVE/CR)', description: 'AVE > 0.50 and CR > 0.70.' },
            { id: '3.4', label: 'Discriminant Validity', description: 'Fornell-Larcker criterion or HTMT < 0.85.' }
        ]
    },
    {
        id: 'phase4',
        title: 'Phase 4: Structural Model',
        items: [
            { id: '4.1', label: 'Structural Path Significance', description: 'P-values < 0.05 for hypothesized paths.' },
            { id: '4.2', label: 'R-Squared (R²)', description: 'Variance explained for endogenous variables reported.' },
            { id: '4.3', label: 'Mediation/Moderation Analysis', description: 'Indirect effects tested (if applicable).' }
        ]
    },
    {
        id: 'phase5',
        title: 'Phase 5: Reporting',
        items: [
            { id: '5.1', label: 'APA Style Tables', description: 'Format tables according to APA 7th edition.' },
            { id: '5.2', label: 'Discussion of Findings', description: 'Results tied back to literature and theory.' },
            { id: '5.3', label: 'Limitations & Suggestions', description: 'Acknowledged constraints and future research.' }
        ]
    }
];

const SemChecklist: React.FC<SemChecklistProps> = ({ theme }) => {
    const isDark = theme === 'dark';
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ 'phase1': true });

    useEffect(() => {
        const saved = localStorage.getItem('drsem_checklist');
        if (saved) {
            try { setCheckedItems(JSON.parse(saved)); } catch (e) {}
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('drsem_checklist', JSON.stringify(checkedItems));
    }, [checkedItems]);

    const toggleItem = (id: string) => {
        setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleSection = (id: string) => {
        setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const resetChecklist = () => {
        if(window.confirm("Reset all progress?")) {
            setCheckedItems({});
        }
    };

    const totalItems = SEM_SECTIONS.reduce((acc, sec) => acc + sec.items.length, 0);
    const completedItems = Object.values(checkedItems).filter(Boolean).length;
    const progress = Math.round((completedItems / totalItems) * 100);

    const getStyles = () => {
        switch(theme) {
            case 'dark': return { 
                bg: 'bg-slate-950', card: 'bg-slate-900 border-slate-800', text: 'text-slate-100', 
                barBg: 'bg-slate-800', barFill: 'bg-cyan-500', 
                header: 'text-slate-300 hover:bg-slate-800/50'
            };
            case 'corporate': return { 
                bg: 'bg-white', card: 'bg-white border-blue-100', text: 'text-slate-800', 
                barBg: 'bg-blue-100', barFill: 'bg-blue-600',
                header: 'text-slate-700 hover:bg-blue-50'
            };
            case 'academic': return { 
                bg: 'bg-[#fdfbf7]', card: 'bg-[#fffefb] border-[#e5e0d8]', text: 'text-[#333]', 
                barBg: 'bg-[#efebe9]', barFill: 'bg-[#5d4037]',
                header: 'text-[#5d4037] hover:bg-[#efebe9]'
            };
            default: return { 
                bg: 'bg-slate-50', card: 'bg-white border-gray-200', text: 'text-slate-900', 
                barBg: 'bg-gray-200', barFill: 'bg-cyan-500',
                header: 'text-slate-700 hover:bg-gray-100'
            };
        }
    };
    const s = getStyles();

    return (
        <div className={`p-6 h-full overflow-y-auto ${s.bg}`}>
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className={`text-xl font-bold font-serif mb-2 ${s.text}`}>SEM Research Roadmap</h3>
                    <p className={`text-sm opacity-70 ${s.text}`}>Quality assurance checklist for your research journey.</p>
                </div>
                <button 
                    onClick={resetChecklist} 
                    className={`p-2 rounded-full hover:bg-opacity-80 transition-all opacity-50 hover:opacity-100 ${s.text}`} 
                    title="Reset Checklist"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {/* Progress Bar */}
            <div className={`mb-8 p-4 rounded-xl border flex items-center gap-4 ${s.card}`}>
                <PieChart size={32} className={progress === 100 ? 'text-green-500' : (theme === 'corporate' ? 'text-blue-500' : (theme === 'academic' ? 'text-[#5d4037]' : 'text-cyan-500'))} />
                <div className="flex-1">
                    <div className="flex justify-between text-xs font-bold mb-1 opacity-80">
                        <span className={s.text}>Overall Progress</span>
                        <span className={s.text}>{progress}%</span>
                    </div>
                    <div className={`w-full h-2.5 rounded-full ${s.barBg}`}>
                        <div 
                            className={`h-2.5 rounded-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : s.barFill}`} 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {SEM_SECTIONS.map((section) => {
                    const sectionTotal = section.items.length;
                    const sectionCompleted = section.items.filter(i => checkedItems[i.id]).length;
                    const isComplete = sectionTotal === sectionCompleted;

                    return (
                        <div key={section.id} className={`border rounded-xl overflow-hidden shadow-sm transition-all ${s.card} ${isComplete ? 'opacity-75' : ''}`}>
                            <button 
                                onClick={() => toggleSection(section.id)}
                                className={`w-full p-4 flex items-center justify-between text-left font-bold transition-colors ${s.header}`}
                            >
                                <div className="flex items-center gap-2">
                                    {isComplete ? <span className="text-green-500">✔</span> : null}
                                    <span>{section.title}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs opacity-60 font-normal">{sectionCompleted}/{sectionTotal}</span>
                                    {expandedSections[section.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                            </button>
                            
                            {expandedSections[section.id] && (
                                <div className={`p-4 pt-0 space-y-3 border-t border-dashed ${isDark ? 'border-slate-800' : (theme === 'academic' ? 'border-[#e5e0d8]' : 'border-gray-100')}`}>
                                    {section.items.map((item) => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => toggleItem(item.id)}
                                            className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-opacity-50 ${
                                                checkedItems[item.id] ? 'opacity-50' : ''
                                            } ${isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-50'}`}
                                        >
                                            <div className={`mt-0.5 ${checkedItems[item.id] ? 'text-green-500' : 'opacity-40'}`}>
                                                {checkedItems[item.id] ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </div>
                                            <div>
                                                <div className={`text-sm font-medium ${checkedItems[item.id] ? 'line-through opacity-70' : ''} ${s.text}`}>
                                                    {item.label}
                                                </div>
                                                {item.description && (
                                                    <div className={`text-xs mt-0.5 opacity-60 ${s.text}`}>
                                                        {item.description}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            <div className={`mt-8 text-center text-xs opacity-50 ${s.text}`}>
                Dr.SEM Guide: Complete each phase sequentially to ensure rigorous academic standards.
            </div>
        </div>
    );
};

export default SemChecklist;
