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
    const [rawResults, setRawResults] = useState<Uint32Array>(new Uint32Array(0));
    const [resultPage, setResultPage] = useState(0);
    const resultsPerPage = 50;
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [hasOptimized, setHasOptimized] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedRelicInResults, setSelectedRelicInResults] = useState<Relic | null>(null);
    const [optimizationTime, setOptimizationTime] = useState<number | null>(null);

    const workerPoolRef = useRef<Worker[]>([]);

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
        setOptimizationTime(null);

        const startTime = performance.now();

        if (workerPoolRef.current.length > 0) {
            workerPoolRef.current.forEach(w => w.terminate());
        }

        const concurrency = navigator.hardwareConcurrency || 4;
        const workers: Worker[] = [];
        workerPoolRef.current = workers;

        let completedWorkers = 0;
        let allBuffers: Uint32Array[] = [];
        let totalCount = 0;
        let hasError = false;

        let filteredRelics = relics;
        if (!includeOtherEquipped) {
            filteredRelics = relics.filter(r => !r.equipped || r.equipped === selectedDoll);
        }

        // We need a map to reverse integers back to Relic objects for UI display
        const intToRelic = new Map<number, Relic>();
        filteredRelics.forEach((r, idx) => {
            if (r.id) intToRelic.set(idx + 1, r);
        });

        for (let i = 0; i < concurrency; i++) {
            const worker = new OptimizerWorker();
            worker.onmessage = (e) => {
                if (hasError) return;

                if (e.data.type === 'DONE') {
                    const { buffer, count } = e.data.results as { buffer: Uint32Array, count: number };
                    allBuffers.push(buffer);
                    totalCount += count;
                    completedWorkers++;

                    if (completedWorkers === concurrency) {
                        const endTime = performance.now();
                        setOptimizationTime(endTime - startTime);

                        // Merge all buffers into one large array
                        const INTS_PER_BUILD = 7;
                        let mergedBuffer = new Uint32Array(totalCount * INTS_PER_BUILD);
                        let offset = 0;
                        for (const b of allBuffers) {
                            mergedBuffer.set(b, offset);
                            offset += b.length;
                        }

                        // We can't use Array.prototype.sort on a typed array grouped by 7 integers
                        // Instead, we create an index array to sort just the indices based on the score (index 6)
                        const indices = new Uint32Array(totalCount);
                        for (let i = 0; i < totalCount; i++) indices[i] = i;

                        // Sort indices descending using the score metric stored at index 6 of every build
                        indices.sort((a, b) => {
                            const scoreA = mergedBuffer[a * INTS_PER_BUILD + 6];
                            const scoreB = mergedBuffer[b * INTS_PER_BUILD + 6];
                            return scoreB - scoreA;
                        });

                        // Keep up to 2,000,000 builds
                        const maxToKeep = Math.min(totalCount, 2000000);
                        const finalBuffer = new Uint32Array(maxToKeep * INTS_PER_BUILD);
                        for (let i = 0; i < maxToKeep; i++) {
                            const srcIdx = indices[i] * INTS_PER_BUILD;
                            const dstIdx = i * INTS_PER_BUILD;
                            for (let j = 0; j < INTS_PER_BUILD; j++) {
                                finalBuffer[dstIdx + j] = mergedBuffer[srcIdx + j];
                            }
                        }

                        setRawResults(finalBuffer);
                        setResultPage(0);
                        setHasOptimized(true);
                        setIsOptimizing(false);
                    }
                } else if (e.data.type === 'ERROR') {
                    if (!hasError) {
                        hasError = true;
                        setErrorMsg(e.data.message);
                        setIsOptimizing(false);
                        setHasOptimized(true);
                        setOptimizationTime(performance.now() - startTime);
                        workers.forEach(w => w.terminate());
                    }
                }
            };

            worker.postMessage({
                relics: filteredRelics,
                constraints: {
                    ...constraints,
                    allowedSlots: selectedDollData?.allowed_slots
                },
                skillsData,
                relicInfo,
                partition: { id: i, total: concurrency }
            });
            workers.push(worker);
        }
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

    const addSkillFilter = (skill?: string) => {
        const filterVal = skill || selectedSkillForFilter;
        if (filterVal && !activeSkillFilters.includes(filterVal)) {
            setActiveSkillFilters(prev => [...prev, filterVal]);
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

    // We can compute categorizedSkills outside so it's ready for the effect
    const categorizedSkills = useMemo(() => {
        const cats: Record<string, string[]> = {};
        if (relicInfo && relicInfo.RELIC_TYPES) {
            for (const [catName, catData] of Object.entries<any>(relicInfo.RELIC_TYPES)) {
                cats[catName] = [];
                if (catData.main_skills) {
                    catData.main_skills.forEach((skill: string) => cats[catName].push(skill));
                }
                if (catData.aux_skills) {
                    for (const skillTemplate of Object.keys(catData.aux_skills)) {
                        if (skillTemplate.includes('{Element}')) {
                            relicInfo.ELEMENTS?.forEach((el: string) => cats[catName].push(skillTemplate.replace('{Element}', el)));
                        } else {
                            cats[catName].push(skillTemplate);
                        }
                    }
                }
            }
        }
        return cats;
    }, [relicInfo]);

    // --- LAZY RECONSTRUCTION OF UI BUILDS VIA PAGINATION ---
    useEffect(() => {
        if (!rawResults || rawResults.length === 0) {
            setResults([]);
            return;
        }

        const buildObjects: BuildResult[] = [];
        const startIdx = resultPage * resultsPerPage;
        const endIdx = Math.min(startIdx + resultsPerPage, rawResults.length / 7);

        // Helper maps
        const intToRelic = new Map<number, Relic>();
        relics.forEach((r, idx) => {
            if (r.id) intToRelic.set(idx + 1, r);
        });

        // Reconstruct just the relics for the current page
        for (let i = startIdx; i < endIdx; i++) {
            const offset = i * 7;
            const buildRelics: Relic[] = [];
            for (let j = 0; j < 6; j++) {
                const relicIdInt = rawResults[offset + j];
                if (relicIdInt > 0 && intToRelic.has(relicIdInt)) {
                    buildRelics.push(intToRelic.get(relicIdInt)!);
                }
            }

            // The UI expects `rawSkillLevels`, `rawCategoryLevels`, `effectiveSkillLevels` 
            // We unfortunately have to re-compute these here purely for UI rendering 
            // since we threw them away to save RAM.
            const rawSkillLevels: Record<string, number> = {};
            const rawCategoryLevels: Record<string, number> = {};
            const effectiveSkillLevels: Record<string, number> = {};

            const getSkillMax = (skillName: string) => {
                let max = 6;
                // Check if the skill name exists in any of the categories in the skillsData
                const foundSkillEntry = Object.entries(skillsData).find(([name]) => name === skillName);
                if (foundSkillEntry) max = (foundSkillEntry[1] as any).maxlevel || 6;
                return max;
            };

            for (const relic of buildRelics) {
                const skills = [relic.main_skill, ...relic.aux_skills];
                for (const skill of skills) {
                    if (!skill || !skill.name) continue;

                    rawSkillLevels[skill.name] = (rawSkillLevels[skill.name] || 0) + skill.level;

                    // Recompute category based on the categorizedSkills array map we generated
                    let foundCat = '';
                    for (const [catName, catSkills] of Object.entries(categorizedSkills)) {
                        if (catSkills.includes(skill.name)) {
                            foundCat = catName;
                            break;
                        }
                    }
                    if (!foundCat) {
                        const directMatch = Object.entries(skillsData).find(([name]) => name === skill.name);
                        if (directMatch) foundCat = (directMatch[1] as any).type;
                    }
                    if (foundCat) {
                        rawCategoryLevels[foundCat] = (rawCategoryLevels[foundCat] || 0) + skill.level;
                    }
                }
            }

            for (const [skill, rawLvl] of Object.entries(rawSkillLevels)) {
                effectiveSkillLevels[skill] = Math.min(rawLvl, getSkillMax(skill));
            }

            buildObjects.push({
                relics: buildRelics,
                rawCategoryLevels,
                rawSkillLevels,
                effectiveSkillLevels
            });
        }

        setResults(buildObjects);
    }, [rawResults, resultPage, relics, categorizedSkills]);

    // Debounced automatic optimization trigger
    useEffect(() => {
        if (!selectedDoll || relics.length === 0) return;

        const timer = setTimeout(() => {
            startOptimization();
        }, 500);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [constraints, selectedDoll, includeOtherEquipped]);

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
            <div className="optimizer-page glassmorphism">
                <h2>No Doll Selected</h2>
                <p>Please select a doll from the Dolls tab first.</p>
                <div style={{ marginTop: '1rem' }}>
                    <Link to="/dolls" className="glow-btn">Go to Dolls</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="optimizer-page" style={{ padding: '2rem 5%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <h1 className="glow-text" style={{ fontSize: '2.5rem', margin: 0, paddingLeft: "10px" }}>Data Tuning</h1>

            {/* Constraints Card */}
            <div className="glassmorphism build-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'slideUp 0.3s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                    <Link to="/" className="back-btn" style={{ textDecoration: 'none' }}>← Back</Link>
                    <h1>Configuring <span>{selectedDoll}</span></h1>
                </div>
                <p className="subtitle">
                    Allowed Slots: {Object.entries(selectedDollData.allowed_slots).map(([type, count]) => `${count}x ${type}`).join(', ')}
                </p>
                {errorMsg && <p className="error">{errorMsg}</p>}

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
                    {optimizationTime !== null && hasOptimized && (
                        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-color)', opacity: 0.8, fontSize: '0.9rem', marginLeft: '1rem' }}>
                            Calculated {(rawResults.length / 7).toLocaleString()} valid builds in {(optimizationTime / 1000).toFixed(2)}s using {navigator.hardwareConcurrency || 4} threads
                        </div>
                    )}
                    <button
                        className={`glow-btn`}
                        style={{ background: showDamageSimulation ? 'var(--accent-glow)' : '', marginLeft: 'auto' }}
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

                {rawResults.length > 0 && (
                    <OptimizationResults
                        results={results}
                        resultPage={resultPage}
                        setResultPage={setResultPage}
                        resultsPerPage={resultsPerPage}
                        totalResults={rawResults.length / 7}
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

                {hasOptimized && rawResults.length === 0 && !errorMsg && (
                    <section className="results-section result-empty glassmorphism" style={{ marginTop: '2rem' }}>
                        <h2>No Builds Found</h2>
                        <p>No valid combination of 6 relics matched your exact constraints.</p>
                        <p className="hint">Try lowering the category constraints or checking if you have enough allowed slot types for this character.</p>
                    </section>
                )}

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
        </div>
    );
}

export default Optimizer;
