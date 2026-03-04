import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import OptimizerWorker from '../worker/optimizer.worker?worker';
import skillsData from '../data/skills.json';
import dollsData from '../data/dolls.json';
import relicInfo from '../data/relicinfo.json';
import { OptimizerConstraints, BuildResult, Relic, HistoryAction, EquipChange, DollDefinition } from '../optimizer/types';
import { ConfirmUnequipModal } from '../components/modals/ConfirmUnequipModal';
import { RelicModal } from '../components/RelicModal';
import { TargetConstraints } from '../components/optimizer/TargetConstraints';
import { CurrentlyEquipped } from '../components/optimizer/CurrentlyEquipped';
import { CharacterPassives } from '../components/optimizer/CharacterPassives';
import { DamageSimulationSettings } from '../components/optimizer/DamageSimulationSettings';
import { OptimizationResults } from '../components/optimizer/OptimizationResults';

const defaultConstraints: OptimizerConstraints = { targetCategoryLevels: {}, targetSkillLevels: {} };

export function Optimizer() {
    const { dollName } = useParams<{ dollName: string }>();
    const selectedDoll = dollName || '';
    const relics = useLiveQuery(() => db.relics.toArray(), []) || [];

    const selectedDollData = (dollsData as Record<string, DollDefinition>)[selectedDoll];

    // Filters and constraints
    const [constraints, setConstraints] = useState<OptimizerConstraints>(defaultConstraints);
    const [activeSkillFilters, setActiveSkillFilters] = useState<string[]>([]);
    const [selectedCategoryForFilter, setSelectedCategoryForFilter] = useState<string>('Bulwark');
    const [selectedSkillForFilter, setSelectedSkillForFilter] = useState<string>('');
    const [includeOtherEquipped, setIncludeOtherEquipped] = useState(true);

    // Results state
    const [results, setResults] = useState<BuildResult[]>([]);
    const [resultPage, setResultPage] = useState(0);
    const resultsPerPage = 50;
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [hasOptimized, setHasOptimized] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedRelicInResults, setSelectedRelicInResults] = useState<Relic | null>(null);

    const workerRef = useRef<Worker | null>(null);

    // History Actions
    const [undoStack, setUndoStack] = useState<HistoryAction[]>([]);
    const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);
    const [relicToUnequip, setRelicToUnequip] = useState<Relic | null>(null);

    // Simulation
    const [showDamageSimulation, setShowDamageSimulation] = useState(false);
    const [simStats, setSimStats] = useState({ ATK: 1000, DEF: 500, HP: 5000, CRIT_RATE: 10, CRIT_DMG: 150, EnemyDEF: 0 });
    const [simIgnoredSkills, setSimIgnoredSkills] = useState<string[]>([]);

    useEffect(() => {
        if (selectedDoll) {
            const dData = selectedDollData;
            const dollElement = dData?.element || 'Physical';
            const ignored: string[] = [];
            const allSkills = {
                ...((skillsData as any).Sentinel || {}),
                ...((skillsData as any).Vanguard || {}),
                ...((skillsData as any).Support || {})
            };

            for (const [skillName, skillDef] of Object.entries<any>(allSkills)) {
                if (skillDef.element && skillDef.element !== "none" && skillDef.element !== dollElement) {
                    ignored.push(skillName);
                }
            }
            setSimIgnoredSkills(ignored);
        } else {
            setSimIgnoredSkills([]);
        }
    }, [selectedDoll, selectedDollData]);

    const pushAction = (action: HistoryAction) => {
        setUndoStack(prev => [...prev, action]);
        setRedoStack([]);
    };

    const handleUndo = async () => {
        if (undoStack.length === 0) return;
        const action = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));

        if (action.type === 'EQUIP') {
            for (const change of action.changes) {
                await db.relics.update(change.relicId, { equipped: change.prevEquipped });
            }
        }
        setRedoStack(prev => [...prev, action]);
    };

    const handleRedo = async () => {
        if (redoStack.length === 0) return;
        const action = redoStack[redoStack.length - 1];
        setRedoStack(prev => prev.slice(0, -1));

        if (action.type === 'EQUIP') {
            for (const change of action.changes) {
                await db.relics.update(change.relicId, { equipped: change.newEquipped });
            }
        }
        setUndoStack(prev => [...prev, action]);
    };

    useEffect(() => {
        setUndoStack([]);
        setRedoStack([]);
    }, [selectedDoll]);

    const startOptimization = () => {
        if (relics.length === 0) {
            setErrorMsg('Please upload an inventory first.');
            return;
        }

        setIsOptimizing(true);
        setHasOptimized(false);
        setResults([]);
        setResultPage(0);
        setErrorMsg('');

        if (workerRef.current) {
            workerRef.current.terminate();
        }

        workerRef.current = new OptimizerWorker();
        workerRef.current.onmessage = (e) => {
            if (e.data.type === 'DONE') {
                setResults(e.data.results);
                setHasOptimized(true);
                setIsOptimizing(false);
            } else if (e.data.type === 'ERROR') {
                setErrorMsg(e.data.message);
                setIsOptimizing(false);
                setHasOptimized(true);
            }
        };

        let filteredRelics = relics;
        if (!includeOtherEquipped) {
            filteredRelics = relics.filter(r => !r.equipped || r.equipped === selectedDoll);
        }

        workerRef.current!.postMessage({
            relics: filteredRelics,
            constraints: {
                ...constraints,
                allowedSlots: selectedDollData?.allowed_slots
            },
            skillsData,
            relicInfo
        });
    };

    const handleExportJSON = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "optimized_builds.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleCategoryConstraintChange = (category: string, value: string) => {
        const num = parseInt(value, 10);
        setConstraints(prev => {
            const updated = { ...prev.targetCategoryLevels };
            if (isNaN(num) || num <= 0) {
                delete updated[category];
            } else {
                updated[category] = num;
            }
            return { ...prev, targetCategoryLevels: updated };
        });
    };

    const handleTargetSkillChange = (skillName: string, value: string) => {
        const num = parseInt(value, 10);
        setConstraints(prev => {
            const updated = { ...prev.targetSkillLevels };
            if (isNaN(num) || num <= 0) {
                delete updated[skillName];
            } else {
                updated[skillName] = num;
            }
            return { ...prev, targetSkillLevels: updated };
        });
    };

    const addSkillFilter = () => {
        if (selectedSkillForFilter && !activeSkillFilters.includes(selectedSkillForFilter)) {
            setActiveSkillFilters(prev => [...prev, selectedSkillForFilter]);
        }
        setSelectedSkillForFilter('');
    };

    const removeSkillFilter = (skill: string) => {
        setActiveSkillFilters(prev => prev.filter(s => s !== skill));
        setConstraints(prev => {
            const updated = { ...prev.targetSkillLevels };
            delete updated[skill];
            return { ...prev, targetSkillLevels: updated };
        });
    };

    const applyBonusRequirements = (bonus: any) => {
        const newTargets: Record<string, number> = {};
        for (const [key, val] of Object.entries(bonus)) {
            if (key !== 'tier' && key !== 'description') {
                newTargets[key] = val as number;
            }
        }
        setConstraints(prev => ({
            ...prev,
            targetCategoryLevels: newTargets
        }));
    };

    // Debounced automatic optimization trigger
    useEffect(() => {
        if (!selectedDoll || relics.length === 0) return;

        const timer = setTimeout(() => {
            startOptimization();
        }, 500);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [constraints, selectedDoll, includeOtherEquipped]);

    const categorizedSkills: Record<string, string[]> = useMemo(() => {
        const categorized: Record<string, string[]> = {
            Bulwark: [],
            Vanguard: [],
            Support: [],
            Sentinel: []
        };
        if (relicInfo && relicInfo.RELIC_TYPES) {
            for (const [catName, catData] of Object.entries<any>(relicInfo.RELIC_TYPES)) {
                if (categorized[catName]) {
                    const skillsForCat = new Set<string>();
                    if (catData.main_skills) catData.main_skills.forEach((s: string) => skillsForCat.add(s));
                    if (catData.aux_skills) {
                        for (const rawName of Object.keys(catData.aux_skills)) {
                            if (rawName.includes('{Element}')) {
                                relicInfo.ELEMENTS?.forEach((el: string) => skillsForCat.add(rawName.replace('{Element}', el)));
                            } else {
                                skillsForCat.add(rawName);
                            }
                        }
                    }
                    categorized[catName] = Array.from(skillsForCat);
                }
            }
        }
        return categorized;
    }, []);

    const handleConfirmUnequip = async (r: Relic) => {
        if (r.id) {
            const fullRelic = relics.find(x => x.id === r.id);
            pushAction({
                type: 'EQUIP',
                changes: [{ relicId: r.id, prevEquipped: fullRelic?.equipped, newEquipped: undefined }]
            });
            await db.relics.update(r.id, { equipped: undefined });
        }
        setRelicToUnequip(null);
    };

    const handleEquipBuild = async (res: BuildResult) => {
        const changes: EquipChange[] = [];
        const currentEquipped = relics.filter(r => r.equipped === selectedDoll);
        for (const r of currentEquipped) {
            if (r.id) {
                await db.relics.update(r.id, { equipped: undefined });
                changes.push({ relicId: r.id, prevEquipped: r.equipped, newEquipped: undefined });
            }
        }
        for (const r of res.relics) {
            if (r.id) {
                const fullRelic = relics.find(x => x.id === r.id);
                await db.relics.update(r.id, { equipped: selectedDoll });
                const existingChange = changes.find(c => c.relicId === r.id);
                if (existingChange) {
                    existingChange.newEquipped = selectedDoll;
                } else {
                    changes.push({ relicId: r.id, prevEquipped: fullRelic ? fullRelic.equipped : r.equipped, newEquipped: selectedDoll });
                }
            }
        }
        pushAction({ type: 'EQUIP', changes });
    };

    if (!selectedDollData) {
        return (
            <div className="app-container">
                <header className="header-glow">
                    <h1>Character Not Found</h1>
                    <Link to="/" className="back-btn">Go Back</Link>
                </header>
            </div>
        );
    }

    return (
        <div className="app-container">
            <header className="header-glow">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                    <Link to="/" className="back-btn" style={{ textDecoration: 'none' }}>← Back</Link>
                    <h1>Configuring <span>{selectedDoll}</span></h1>
                </div>
                <p className="subtitle">
                    Allowed Slots: {Object.entries(selectedDollData.allowed_slots).map(([type, count]) => `${count}x ${type}`).join(', ')}
                </p>
                {errorMsg && <p className="error">{errorMsg}</p>}
            </header>

            <main className="main-content">
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 350px 350px', gap: '2rem', alignItems: 'start' }}>
                    <TargetConstraints
                        constraints={constraints}
                        handleCategoryConstraintChange={handleCategoryConstraintChange}
                        handleTargetSkillChange={handleTargetSkillChange}
                        categorizedSkills={categorizedSkills}
                        activeSkillFilters={activeSkillFilters}
                        selectedCategoryForFilter={selectedCategoryForFilter}
                        setSelectedCategoryForFilter={setSelectedCategoryForFilter}
                        selectedSkillForFilter={selectedSkillForFilter}
                        setSelectedSkillForFilter={setSelectedSkillForFilter}
                        addSkillFilter={addSkillFilter}
                        removeSkillFilter={removeSkillFilter}
                        includeOtherEquipped={includeOtherEquipped}
                        setIncludeOtherEquipped={setIncludeOtherEquipped}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'sticky', top: '2rem' }}>
                        <CurrentlyEquipped
                            selectedDoll={selectedDoll}
                            relics={relics}
                            undoStack={undoStack}
                            redoStack={redoStack}
                            handleUndo={handleUndo}
                            handleRedo={handleRedo}
                            pushAction={pushAction}
                            setRelicToUnequip={setRelicToUnequip}
                            showDamageSimulation={showDamageSimulation}
                            simStats={simStats}
                            simIgnoredSkills={simIgnoredSkills}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'sticky', top: '2rem' }}>
                        <CharacterPassives
                            selectedDollData={selectedDollData}
                            constraints={constraints}
                            applyBonusRequirements={applyBonusRequirements}
                        />
                    </div>
                </div>

                <div className="action-row" style={{ justifyContent: 'flex-start', gap: '1rem', marginTop: '2rem' }}>
                    <button
                        className={`glow-btn ${isOptimizing ? 'loading' : ''}`}
                        onClick={startOptimization}
                    >
                        {isOptimizing ? 'Optimizing...' : 'Run Optimizer'}
                    </button>
                    <button
                        className={`glow-btn`}
                        style={{ background: showDamageSimulation ? 'var(--accent-glow)' : '' }}
                        onClick={() => setShowDamageSimulation(!showDamageSimulation)}
                    >
                        {showDamageSimulation ? 'Hide Simulation' : 'Damage Simulation (Beta)'}
                    </button>
                </div>

                {showDamageSimulation && (
                    <DamageSimulationSettings
                        simStats={simStats}
                        setSimStats={setSimStats}
                        simIgnoredSkills={simIgnoredSkills}
                        setSimIgnoredSkills={setSimIgnoredSkills}
                    />
                )}

                {results.length > 0 && (
                    <OptimizationResults
                        results={results}
                        resultPage={resultPage}
                        setResultPage={setResultPage}
                        resultsPerPage={resultsPerPage}
                        showDamageSimulation={showDamageSimulation}
                        simStats={simStats}
                        simIgnoredSkills={simIgnoredSkills}
                        handleExportJSON={handleExportJSON}
                        onEquipBuild={handleEquipBuild}
                        selectedDoll={selectedDoll}
                        selectedRelicInResults={selectedRelicInResults}
                        setSelectedRelicInResults={setSelectedRelicInResults}
                    />
                )}

                {hasOptimized && results.length === 0 && !errorMsg && (
                    <section className="results-section result-empty glassmorphism" style={{ marginTop: '2rem' }}>
                        <h2>No Builds Found</h2>
                        <p>No valid combination of 6 relics matched your exact constraints.</p>
                        <p className="hint">Try lowering the category constraints or checking if you have enough allowed slot types for this character.</p>
                    </section>
                )}
            </main>

            {relicToUnequip && (
                <ConfirmUnequipModal
                    relic={relicToUnequip}
                    onConfirm={handleConfirmUnequip}
                    onCancel={() => setRelicToUnequip(null)}
                />
            )}
            {selectedRelicInResults && (
                <RelicModal
                    relic={selectedRelicInResults}
                    onClose={() => setSelectedRelicInResults(null)}
                />
            )}
        </div>
    );
}
