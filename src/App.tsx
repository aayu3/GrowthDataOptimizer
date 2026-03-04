import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/database';
import './index.css';
import OptimizerWorker from './worker/optimizer.worker?worker';
import skillsData from './data/skills.json';
import dollsData from './data/dolls.json';
import relicInfo from './data/relicinfo.json';
import { OptimizerConstraints, BuildResult, DollDefinition } from './optimizer/types';
import { RelicDatabaseViewer } from './components/RelicDatabaseViewer';
import { RelicThumbnail } from './components/RelicThumbnail';
import { RelicModal } from './components/RelicModal';
import { RelicInventoryModal } from './components/RelicInventoryModal';
import { getSkillMaxLevel, getCatBadgeIconUrl, getSkillCategory } from './utils/relicUtils';
import { Relic } from './optimizer/types';

type EquipChange = { relicId: string; prevEquipped: string | null | undefined; newEquipped: string | null | undefined };
type HistoryAction =
    | { type: 'EQUIP', changes: EquipChange[] };

const defaultConstraints: OptimizerConstraints = { targetCategoryLevels: {}, targetSkillLevels: {} };

function App() {
    const [activeTab, setActiveTab] = useState<'optimizer' | 'database'>('optimizer');
    const [selectedDoll, setSelectedDoll] = useState<string | null>(null);
    const relics = useLiveQuery(() => db.relics.toArray(), []) || [];
    const [perDollFilters, setPerDollFilters] = useState<Record<string, { constraints: OptimizerConstraints, activeSkillFilters: string[] }>>({});

    const constraints = selectedDoll && perDollFilters[selectedDoll] ? perDollFilters[selectedDoll].constraints : defaultConstraints;
    const activeSkillFilters = selectedDoll && perDollFilters[selectedDoll] ? perDollFilters[selectedDoll].activeSkillFilters : [];

    const setConstraints = (action: React.SetStateAction<OptimizerConstraints>) => {
        setPerDollFilters(prev => {
            if (!selectedDoll) return prev;
            const current = prev[selectedDoll] || { constraints: defaultConstraints, activeSkillFilters: [] };
            const updated = typeof action === 'function' ? action(current.constraints) : action;
            return { ...prev, [selectedDoll]: { ...current, constraints: updated } };
        });
    };

    const setActiveSkillFilters = (action: React.SetStateAction<string[]>) => {
        setPerDollFilters(prev => {
            if (!selectedDoll) return prev;
            const current = prev[selectedDoll] || { constraints: defaultConstraints, activeSkillFilters: [] };
            const updated = typeof action === 'function' ? action(current.activeSkillFilters) : action;
            return { ...prev, [selectedDoll]: { ...current, activeSkillFilters: updated } };
        });
    };

    const [results, setResults] = useState<BuildResult[]>([]);
    const [resultPage, setResultPage] = useState(0);
    const resultsPerPage = 50;
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [hasOptimized, setHasOptimized] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedCategoryForFilter, setSelectedCategoryForFilter] = useState<string>('Bulwark');
    const [selectedSkillForFilter, setSelectedSkillForFilter] = useState<string>('');
    const [includeOtherEquipped, setIncludeOtherEquipped] = useState(true);
    const [selectedRelicInResults, setSelectedRelicInResults] = useState<Relic | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEquippedRelic, setSelectedEquippedRelic] = useState<Relic | null>(null);
    const [isEditingEquip, setIsEditingEquip] = useState(false);
    const [pendingImport, setPendingImport] = useState<any[] | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFileName, setImportFileName] = useState('');
    const [showExportModal, setShowExportModal] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [relicToUnequip, setRelicToUnequip] = useState<Relic | null>(null);
    const [undoStack, setUndoStack] = useState<HistoryAction[]>([]);
    const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);

    // --- Simulation State ---
    const [showDamageSimulation, setShowDamageSimulation] = useState(false);
    const [simStats, setSimStats] = useState({ ATK: 1000, DEF: 500, HP: 5000, CRIT_RATE: 10, CRIT_DMG: 150, EnemyDEF: 0 });
    const [simIgnoredSkills, setSimIgnoredSkills] = useState<string[]>([]);

    useEffect(() => {
        if (selectedDoll) {
            const dData = (dollsData as any)[selectedDoll];
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
    }, [selectedDoll]);

    const workerRef = useRef<Worker | null>(null);

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

    const processFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (Array.isArray(json)) {
                    let skippedCount = 0;
                    const validRelics = [];

                    for (const r of json) {
                        const hasUnknownType = r.type === "Unknown" || !r.type;
                        const hasNoMainSkill = !r.main_skill || !r.main_skill.name || r.main_skill.name.toLowerCase() === 'unknown';
                        const hasNullAuxSkill = !r.aux_skills;
                        const hasInvalidAuxSkills = r.aux_skills && r.aux_skills.some((s: any) => !s || !s.name || s.name.toLowerCase() === 'unknown');

                        if (hasUnknownType || hasNoMainSkill || hasNullAuxSkill || hasInvalidAuxSkills) {
                            skippedCount++;
                            continue;
                        }

                        const { id, ...rest } = r;
                        validRelics.push({ ...rest, createdAt: Date.now() });
                    }

                    setPendingImport(validRelics);
                    setImportFileName(file.name);
                    if (skippedCount > 0) {
                        setErrorMsg(`Skipped ${skippedCount} relics with unknown/missing types or skills.`);
                    } else {
                        setErrorMsg('');
                    }
                } else {
                    setErrorMsg('Invalid inventory format. Expected an array of relics.');
                }
            } catch (err) {
                setErrorMsg('Failed to parse JSON file.');
            }
        };
        reader.readAsText(file);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const handleExportInventory = async () => {
        const allRelics = await db.relics.toArray();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allRelics, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "relic_inventory.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

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
                allowedSlots: (dollsData as Record<string, DollDefinition>)[selectedDoll!]?.allowed_slots
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
        document.body.appendChild(downloadAnchorNode); // required for firefox
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

    const calculateBuildStats = (buildRelics: Relic[]) => {
        const rawCategoryLevels: Record<string, number> = {};
        const rawSkillLevels: Record<string, number> = {};
        const effectiveSkillLevels: Record<string, number> = {};

        for (const relic of buildRelics) {
            const skills = [relic.main_skill, ...relic.aux_skills].filter(Boolean) as { name: string, level: number }[];
            for (const skill of skills) {
                rawSkillLevels[skill.name] = (rawSkillLevels[skill.name] || 0) + skill.level;
                const cat = getSkillCategory(skill.name);
                if (cat) rawCategoryLevels[cat] = (rawCategoryLevels[cat] || 0) + skill.level;
            }
        }

        for (const [skill, rawLvl] of Object.entries(rawSkillLevels)) {
            effectiveSkillLevels[skill] = Math.min(rawLvl, getSkillMaxLevel(skill));
        }

        return { rawCategoryLevels, effectiveSkillLevels };
    };

    const calculateBuildDamage = (build: BuildResult, stats: typeof simStats, ignoredSkills: string[], logDetails: boolean = false) => {
        let totalAtkBuff = 0;
        let totalCritRateBuff = 0;
        let totalCritDmgBuff = 0;
        let totalDamageBuff = 0;

        const activeSkillsLog: string[] = [];

        for (const [skillName, level] of Object.entries(build.effectiveSkillLevels)) {
            if (level <= 0) continue;
            if (ignoredSkills.includes(skillName)) continue;

            let skillDef = (skillsData as any).Sentinel?.[skillName] || (skillsData as any).Vanguard?.[skillName] || (skillsData as any).Support?.[skillName];
            if (!skillDef) continue;

            const effectValue = skillDef.x[level - 1]; // level is 1-indexed
            if (effectValue === undefined) continue;

            const multiplier = effectValue / 100.0;

            if (skillDef.stat === "ATK") {
                if (skillDef.scaling === "HP") {
                    totalAtkBuff += (stats.HP * multiplier) / stats.ATK; // Express HP-based ATK boost as % of ATK for simplicity later
                } else {
                    totalAtkBuff += multiplier;
                }
            } else if (skillDef.stat === "DMG") {
                totalDamageBuff += multiplier;
            } else if (skillDef.stat === "CRIT_RATE") {
                totalCritRateBuff += effectValue; // Add as whole number percentage
            } else if (skillDef.stat === "CRIT_DMG") {
                totalCritDmgBuff += effectValue; // Add as whole number percentage
            }

            if (logDetails) {
                activeSkillsLog.push(`${skillName} (Lv. ${level})`);
            }
        }

        const finalAtk = stats.ATK * (1 + totalAtkBuff);
        const finalCritRate = Math.min(100, stats.CRIT_RATE + totalCritRateBuff) / 100.0;
        const finalCritDmg = (stats.CRIT_DMG + totalCritDmgBuff) / 100.0; // 150 = 1.5x

        const baseDamage = finalAtk / (1 + (stats.EnemyDEF / finalAtk)) * (1 + totalDamageBuff);
        const averageDamage = ((1 - finalCritRate) * baseDamage) + (finalCritRate * baseDamage * (1 + finalCritDmg));

        // if (logDetails) {
        //     console.log(`[Damage Sim] Equipped Build Calculation:`);
        //     console.log(`- Global Ignored Skills:`, ignoredSkills);
        //     console.log(`- Skills actively factored in:`, activeSkillsLog.length > 0 ? activeSkillsLog : "None");
        //     console.log(`- Stat Buffs Applied -> ATK: +${(totalAtkBuff * 100).toFixed(1)}%, DMG: +${(totalDamageBuff * 100).toFixed(1)}%, Crit Rate: +${totalCritRateBuff}%, Crit DMG: +${totalCritDmgBuff}%`);
        //     console.log(`- Final Stats -> ATK: ${finalAtk.toFixed(1)}, Crit Rate: ${(finalCritRate * 100).toFixed(1)}%, Crit DMG: ${(finalCritDmg * 100).toFixed(1)}%`);
        //     console.log(`- Base DMG: ${baseDamage.toFixed(1)} | Avg DMG: ${averageDamage.toFixed(1)}`);
        // }

        return averageDamage;
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
        setSelectedSkillForFilter(''); // reset
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

    // Group skills by category for UI
    const categorizedSkills: Record<string, string[]> = {
        Bulwark: [],
        Vanguard: [],
        Support: [],
        Sentinel: []
    };

    if (relicInfo && relicInfo.RELIC_TYPES) {
        for (const [catName, catData] of Object.entries<any>(relicInfo.RELIC_TYPES)) {
            if (categorizedSkills[catName]) {
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
                categorizedSkills[catName] = Array.from(skillsForCat);
            }
        }
    }

    const renderModals = () => (
        <>
            {showImportModal && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}
                    onClick={() => {
                        setPendingImport(null);
                        setImportFileName('');
                        setShowImportModal(false);
                    }}
                >
                    <div
                        className="card glassmorphism"
                        style={{ width: '400px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: 0 }}>Import Relics</h3>
                        <p>Upload a JSON file containing relics to import.</p>

                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '1rem',
                                border: `2px dashed ${isDragging ? 'var(--accent-color)' : 'rgba(255,255,255,0.2)'}`,
                                borderRadius: '8px',
                                padding: '2rem 1rem',
                                background: isDragging ? 'rgba(242, 108, 21, 0.1)' : 'rgba(0,0,0,0.2)',
                                transition: 'all 0.3s ease'
                            }}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                Drag and drop your JSON file here, or
                            </span>
                            <label className="glow-btn" style={{ cursor: 'pointer', padding: '0.4rem 0.8rem', fontSize: '0.9rem', flexShrink: 0 }}>
                                Browse Files
                                <input type="file" accept=".json" onChange={handleFileUpload} hidden />
                            </label>
                            <span style={{ fontSize: '0.9rem', color: 'var(--accent-glow)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', marginTop: '0.5rem' }}>
                                {importFileName}
                            </span>
                        </div>

                        {pendingImport && (
                            <p style={{ margin: 0, color: 'var(--accent-glow)' }}>Loaded {pendingImport.length} relics.</p>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                            <button
                                className="glow-btn"
                                disabled={!pendingImport}
                                style={{ opacity: pendingImport ? 1 : 0.5, cursor: pendingImport ? 'pointer' : 'not-allowed' }}
                                onClick={async () => {
                                    if (!pendingImport) return;
                                    await db.relics.clear();
                                    await db.relics.bulkAdd(pendingImport);
                                    setPendingImport(null);
                                    setImportFileName('');
                                    setShowImportModal(false);
                                }}>
                                Replace Inventory
                            </button>
                            <button
                                className="glow-btn"
                                disabled={!pendingImport}
                                style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'var(--success)', color: 'var(--success)', opacity: pendingImport ? 1 : 0.5, cursor: pendingImport ? 'pointer' : 'not-allowed' }}
                                onClick={async () => {
                                    if (!pendingImport) return;
                                    await db.relics.bulkAdd(pendingImport);
                                    setPendingImport(null);
                                    setImportFileName('');
                                    setShowImportModal(false);
                                }}>
                                Merge Current
                            </button>
                            <button className="glow-btn" style={{ background: 'rgba(255, 60, 60, 0.1)', borderColor: '#ff4c4c', color: '#ff4c4c' }} onClick={() => {
                                setPendingImport(null);
                                setImportFileName('');
                                setShowImportModal(false);
                            }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showExportModal && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}
                    onClick={() => setShowExportModal(false)}
                >
                    <div
                        className="card glassmorphism"
                        style={{ width: '400px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: 0 }}>Export Relics</h3>
                        <p>What would you like to export?</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button className="glow-btn" onClick={() => {
                                handleExportInventory();
                                setShowExportModal(false);
                            }}>
                                Export All Relics
                            </button>
                            <button className="glow-btn" onClick={() => {
                                const equippedRelics = relics.filter(r => r.equipped);
                                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(equippedRelics, null, 2));
                                const downloadAnchorNode = document.createElement('a');
                                downloadAnchorNode.setAttribute("href", dataStr);
                                downloadAnchorNode.setAttribute("download", "equipped_relics_all.json");
                                document.body.appendChild(downloadAnchorNode);
                                downloadAnchorNode.click();
                                downloadAnchorNode.remove();
                                setShowExportModal(false);
                            }}>
                                Export All Equipped Relics
                            </button>
                            <button className="glow-btn" style={{ background: 'rgba(255, 60, 60, 0.1)', borderColor: '#ff4c4c', color: '#ff4c4c' }} onClick={() => setShowExportModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {relicToUnequip && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}
                    onClick={() => setRelicToUnequip(null)}
                >
                    <div
                        className="card glassmorphism"
                        style={{ width: '350px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', textAlign: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: 0, color: '#ff4757' }}>Unequip Relic?</h3>
                        <p>Are you sure you want to unequip this relic?</p>
                        <div style={{ display: 'flex', width: '100%', gap: '1rem' }}>
                            <button
                                className="glow-btn"
                                style={{ flex: 1, background: 'rgba(255, 60, 60, 0.1)', borderColor: '#ff4c4c', color: '#ff4c4c' }}
                                onClick={async () => {
                                    if (relicToUnequip.id) {
                                        const fullRelic = relics.find(r => r.id === relicToUnequip.id);
                                        pushAction({
                                            type: 'EQUIP',
                                            changes: [{ relicId: relicToUnequip.id, prevEquipped: fullRelic?.equipped, newEquipped: undefined }]
                                        });
                                        await db.relics.update(relicToUnequip.id, { equipped: undefined });
                                        if (selectedEquippedRelic?.id === relicToUnequip.id) {
                                            setSelectedEquippedRelic(null);
                                        }
                                    }
                                    setRelicToUnequip(null);
                                }}
                            >
                                Confirm
                            </button>
                            <button
                                className="glow-btn"
                                style={{ flex: 1 }}
                                onClick={() => setRelicToUnequip(null)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    if (activeTab === 'database') {
        return (
            <div className="app-container">
                <header className="header-glow">
                    <h1>GF2 <span>Relic Optimizer</span></h1>
                    <div className="nav-tabs" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                        <button className="back-btn" style={{ position: 'relative' }} onClick={() => setActiveTab('optimizer')}>Go to Optimizer</button>
                    </div>
                </header>
                <main className="main-content">
                    <RelicDatabaseViewer />
                </main>
                {renderModals()}
            </div>
        );
    }

    if (!selectedDoll) {
        const availableDolls = Object.keys(dollsData).filter(doll =>
            doll.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return (
            <div className="app-container">
                <header className="header-glow">
                    <h1>GF2 <span>Relic Optimizer</span></h1>
                    <p className="subtitle">Import Inventory or Select a Character</p>
                    <div className="nav-tabs" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                        <button className="back-btn" style={{ position: 'relative' }} onClick={() => setActiveTab('database')}>Browse Database</button>
                        <button className="glow-btn" style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => setShowImportModal(true)}>
                            Upload Inventory
                        </button>
                        <button className="glow-btn" style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => setShowExportModal(true)}>
                            Export Inventory
                        </button>
                    </div>
                    <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {relics.length > 0 ? <span className="success">✓ Database holds {relics.length} Relics</span> : <span>No relics loaded.</span>}
                        {errorMsg && <span className="error" style={{ marginLeft: '1rem' }}>{errorMsg}</span>}
                    </div>
                </header>

                <main className="main-content">
                    <section className="card glassmorphism">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ margin: 0 }}>Available Dolls</h2>
                            <input
                                type="text"
                                placeholder="Search dolls..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', width: '250px' }}
                            />
                        </div>
                        <div className="doll-grid">
                            {availableDolls.map(doll => {
                                // Determine image path (adjusting for special chars if needed)
                                const imgPath = new URL(`./assets/doll_images/${doll}.png`, import.meta.url).href;
                                return (
                                    <button
                                        key={doll}
                                        className="doll-btn"
                                        onClick={() => setSelectedDoll(doll)}
                                    >
                                        <div className="doll-img-container">
                                            <img src={imgPath} alt={doll} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        </div>
                                        <span>{doll}</span>
                                        {relics.filter(r => r.equipped === doll).length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginTop: '4px' }}>
                                                {relics.filter(r => r.equipped === doll).map(r => (
                                                    <div key={r.id} style={{ width: '24px', height: '24px' }}>
                                                        <RelicThumbnail relic={r} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </main>
                {renderModals()}
            </div>
        );
    }

    const selectedDollData = (dollsData as Record<string, DollDefinition>)[selectedDoll];

    return (
        <>
            <div className="app-container">
                <header className="header-glow">
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                        <button className="back-btn" onClick={() => { setSelectedDoll(null); setResults([]); setHasOptimized(false); setShowDamageSimulation(false); }}>← Back</button>
                        <h1>Configuring <span>{selectedDoll}</span></h1>
                    </div>
                    <p className="subtitle">
                        Allowed Slots: {Object.entries(selectedDollData.allowed_slots).map(([type, count]) => `${count}x ${type}`).join(', ')}
                    </p>
                </header>

                <main className="main-content">
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 350px 350px', gap: '2rem', alignItems: 'start' }}>
                        <section className="card glassmorphism">
                            <h2>1. Target Constraints</h2>
                            <p className="hint">Select minimum category points (e.g., Bulwark: 12)</p>
                            <div className="constraints-grid">
                                {['Bulwark', 'Vanguard', 'Support', 'Sentinel'].map(cat => (
                                    <div key={cat} className="input-group">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <img src={getCatBadgeIconUrl(cat)} alt={cat} style={{ width: '16px', height: '16px' }} />
                                            Min {cat} Points
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={constraints.targetCategoryLevels[cat] || ''}
                                            onChange={(e) => handleCategoryConstraintChange(cat, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>

                            <h3 style={{ marginTop: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Specific Skill Targets</h3>
                            <p className="hint">Optionally require minimum levels of specific skills (e.g. 6 levels of HP Boost)</p>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'flex-end', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label>Category</label>
                                    <select
                                        value={selectedCategoryForFilter}
                                        onChange={(e) => {
                                            setSelectedCategoryForFilter(e.target.value);
                                            setSelectedSkillForFilter('');
                                        }}
                                        className="bg-dropdown"
                                    >
                                        {Object.keys(categorizedSkills).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="input-group" style={{ flex: 2 }}>
                                    <label>Skill</label>
                                    <select
                                        value={selectedSkillForFilter}
                                        onChange={(e) => setSelectedSkillForFilter(e.target.value)}
                                        className="bg-dropdown"
                                    >
                                        <option value="">-- Select a Skill --</option>
                                        {categorizedSkills[selectedCategoryForFilter]?.map(skill => (
                                            <option key={skill} value={skill} disabled={activeSkillFilters.includes(skill)}>{skill}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    className="glow-btn"
                                    style={{ padding: '0.6rem 1.5rem', height: 'max-content' }}
                                    onClick={addSkillFilter}
                                    disabled={!selectedSkillForFilter}
                                >
                                    + Add Filter
                                </button>
                            </div>

                            {activeSkillFilters.length > 0 && (
                                <div className="constraints-grid" style={{ marginTop: '1.5rem' }}>
                                    {activeSkillFilters.map(skill => (
                                        <div key={skill} className="input-group" style={{ position: 'relative' }}>
                                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <img src={getCatBadgeIconUrl(getSkillCategory(skill))} alt="cat" style={{ width: '14px', height: '14px' }} />
                                                    <span>Min {skill} Lvl</span>
                                                </div>
                                                <button
                                                    onClick={() => removeSkillFilter(skill)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--error, #ff4c4c)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                                                    title="Remove Filter"
                                                >×</button>
                                            </label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', marginTop: '0.5rem' }}>
                                                {(() => {
                                                    const skillMax = getSkillMaxLevel(skill);
                                                    const currentVal = constraints.targetSkillLevels[skill] || 0;
                                                    const pct = skillMax > 0 ? (currentVal / skillMax) * 100 : 0;
                                                    return (
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max={skillMax}
                                                            value={currentVal}
                                                            onChange={(e) => handleTargetSkillChange(skill, e.target.value)}
                                                            style={{
                                                                flex: 1,
                                                                accentColor: 'var(--accent-color)',
                                                                margin: 0,
                                                                background: `linear-gradient(to right, var(--accent-color) ${pct}%, rgba(0, 0, 0, 0.4) ${pct}%)`
                                                            }}
                                                        />
                                                    );
                                                })()}
                                                <span style={{ minWidth: '20px', textAlign: 'right', fontWeight: 'bold' }}>{constraints.targetSkillLevels[skill] || 0}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <input
                                    type="checkbox"
                                    id="includeEquipped"
                                    checked={includeOtherEquipped}
                                    onChange={(e) => setIncludeOtherEquipped(e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                                />
                                <label htmlFor="includeEquipped" style={{ cursor: 'pointer', fontSize: '0.95rem' }}>
                                    Include relics equipped by other characters
                                </label>
                            </div>
                        </section>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'sticky', top: '2rem' }}>
                            <section className="card glassmorphism">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Currently Equipped</h2>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <button
                                            className="glow-btn"
                                            style={{ padding: '0.2rem 0.4rem', fontSize: '1rem', opacity: undoStack.length === 0 ? 0.5 : 1, cursor: undoStack.length === 0 ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none', boxShadow: 'none', color: undoStack.length === 0 ? 'rgba(255, 255, 255, 0.3)' : 'var(--accent-color)' }}
                                            disabled={undoStack.length === 0}
                                            onClick={handleUndo}
                                            title="Undo last equip/unequip action"
                                        >
                                            ↶
                                        </button>
                                        <button
                                            className="glow-btn"
                                            style={{ padding: '0.2rem 0.4rem', fontSize: '1rem', opacity: redoStack.length === 0 ? 0.5 : 1, cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none', boxShadow: 'none', color: redoStack.length === 0 ? 'rgba(255, 255, 255, 0.3)' : 'var(--accent-color)' }}
                                            disabled={redoStack.length === 0}
                                            onClick={handleRedo}
                                            title="Redo last undone action"
                                        >
                                            ↷
                                        </button>
                                        {relics.filter(r => r.equipped === selectedDoll).length > 0 && (
                                            <button
                                                className="export-btn"
                                                title="Export equipped relics to share this build"
                                                onClick={() => {
                                                    const equipped = relics.filter(r => r.equipped === selectedDoll);
                                                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(equipped, null, 2));
                                                    const dlAnchorElem = document.createElement('a');
                                                    dlAnchorElem.setAttribute("href", dataStr);
                                                    dlAnchorElem.setAttribute("download", `equipped_relics_${selectedDoll}.json`);
                                                    dlAnchorElem.click();
                                                }}
                                                style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                            >
                                                Export Build
                                            </button>
                                        )}
                                        <button
                                            className="glow-btn"
                                            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                                            onClick={() => {
                                                setIsEditingEquip(true);
                                                setSelectedEquippedRelic(null);
                                            }}
                                        >
                                            + Equip Relic
                                        </button>
                                    </div>
                                </div>

                                {relics.filter(r => r.equipped === selectedDoll).length > 0 ? (
                                    <>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '1rem' }}>
                                            {relics.filter(r => r.equipped === selectedDoll).map(r => (
                                                <div key={r.id} style={{ width: '64px', height: '64px' }}>
                                                    <RelicThumbnail
                                                        relic={r}
                                                        isSelected={selectedEquippedRelic?.id === r.id}
                                                        onClick={() => setSelectedEquippedRelic(r)}
                                                        onUnequip={() => setRelicToUnequip(r)}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {(() => {
                                            const equippedStats = calculateBuildStats(relics.filter(r => r.equipped === selectedDoll));
                                            return (
                                                <div className="stats-row" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                                        {Object.entries(equippedStats.rawCategoryLevels).map(([cat, lvl]) => (
                                                            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                                                                <img src={getCatBadgeIconUrl(cat)} alt={cat} style={{ width: '20px', height: '20px' }} />
                                                                <span style={{ color: 'var(--text-primary)' }}>{lvl}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr)', gap: '0.5rem', fontSize: '0.85rem' }}>
                                                        {Object.entries(equippedStats.effectiveSkillLevels)
                                                            .sort(([, a], [, b]) => b - a)
                                                            .map(([skill, lvl]) => (
                                                                <div key={skill} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                                                                    <span style={{ color: 'var(--text-secondary)' }}>{skill}</span>
                                                                    <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>Lv. {lvl}</span>
                                                                </div>
                                                            ))}
                                                    </div>
                                                    {showDamageSimulation && (
                                                        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '4px' }}>Simulated Average Damage</div>
                                                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent-glow)', textShadow: '0 0 10px rgba(242, 108, 21, 0.5)' }}>
                                                                {Math.round(calculateBuildDamage(
                                                                    {
                                                                        relics: relics.filter(r => r.equipped === selectedDoll),
                                                                        rawCategoryLevels: equippedStats.rawCategoryLevels,
                                                                        effectiveSkillLevels: equippedStats.effectiveSkillLevels
                                                                    } as BuildResult,
                                                                    simStats,
                                                                    simIgnoredSkills,
                                                                    true // log Details
                                                                )).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <p className="hint" style={{ margin: '1rem 0 0 0' }}>No relics equipped.</p>
                                )}

                                {selectedEquippedRelic && (
                                    <RelicModal
                                        relic={selectedEquippedRelic}
                                        onClose={() => setSelectedEquippedRelic(null)}
                                    />
                                )}

                                {isEditingEquip && selectedDoll && (
                                    <RelicInventoryModal
                                        selectedDoll={selectedDoll}
                                        onClose={() => setIsEditingEquip(false)}
                                        onEquip={async (r) => {
                                            if (r.id) {
                                                const fullRelic = relics.find(x => x.id === r.id);
                                                pushAction({
                                                    type: 'EQUIP',
                                                    changes: [{ relicId: r.id, prevEquipped: fullRelic?.equipped, newEquipped: selectedDoll }]
                                                });
                                                await db.relics.update(r.id, { equipped: selectedDoll });
                                            }
                                        }}
                                    />
                                )}
                            </section>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'sticky', top: '2rem' }}>

                            <section className="card glassmorphism">
                                <h2 style={{ fontSize: '1.25rem' }}>Character Passives</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {selectedDollData.bonuses && selectedDollData.bonuses.map((bonus: any, idx: number) => {
                                        // Determine if passive is active based on current USER TARGET constraints
                                        let isActive = true;
                                        const requirements: Record<string, number> = {};

                                        for (const [key, val] of Object.entries(bonus)) {
                                            if (key !== 'tier' && key !== 'description') {
                                                requirements[key] = val as number;
                                                const targetLvl = constraints.targetCategoryLevels[key] || 0;
                                                if (targetLvl < (val as number)) {
                                                    isActive = false;
                                                }
                                            }
                                        }

                                        return (
                                            <div
                                                key={idx}
                                                className="bonus-tier-card"
                                                onClick={() => applyBonusRequirements(bonus)}
                                                style={{
                                                    padding: '1rem',
                                                    background: isActive ? 'rgba(242, 108, 21, 0.1)' : 'rgba(0,0,0,0.3)',
                                                    border: `1px solid ${isActive ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)'}`,
                                                    borderRadius: '8px',
                                                    transition: 'all 0.3s ease',
                                                    cursor: 'pointer',
                                                    position: 'relative'
                                                }}
                                                title="Click to set as Optimizer Target"
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <strong style={{ color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)' }}>Bonus Tier {bonus.tier}</strong>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        {Object.entries(requirements).map(([cat, req]) => (
                                                            <span key={cat} style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.3rem', color: (constraints.targetCategoryLevels[cat] || 0) >= req ? 'var(--success)' : 'var(--text-secondary)' }}>
                                                                <img src={getCatBadgeIconUrl(cat)} alt={cat} style={{ width: '14px', height: '14px' }} />
                                                                {req}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '0.9rem', color: isActive ? 'white' : 'var(--text-secondary)' }}>{bonus.description}</div>
                                                <div className="bonus-hover-hint">Apply Targets</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    </div>

                    <div className="action-row" style={{ justifyContent: 'flex-start', gap: '1rem' }}>
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

                    {
                        showDamageSimulation && (
                            <section className="results-section glassmorphism" style={{ marginTop: '2rem' }}>
                                <h2>Damage Simulation Settings</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                                    {Object.entries(simStats).map(([stat, val]) => (
                                        <div key={stat} className="input-group">
                                            <label>{stat}</label>
                                            <input
                                                type="number"
                                                value={val}
                                                onChange={(e) => setSimStats(prev => ({ ...prev, [stat]: parseFloat(e.target.value) || 0 }))}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <h3>Ignored Skills in Calculation</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                                    {simIgnoredSkills.map(skill => (
                                        <span key={skill} style={{ background: 'rgba(255,60,60,0.2)', color: '#ffaaaa', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {skill}
                                            <button
                                                onClick={() => setSimIgnoredSkills(prev => prev.filter(s => s !== skill))}
                                                style={{ background: 'none', border: 'none', color: 'var(--error, #ff4c4c)', cursor: 'pointer', lineHeight: 1 }}
                                            >×</button>
                                        </span>
                                    ))}
                                </div>
                                <div className="input-group" style={{ maxWidth: '300px' }}>
                                    <select
                                        className="bg-dropdown"
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val && !simIgnoredSkills.includes(val)) {
                                                console.log("[Damage Sim] User manually ignoring skill:", val);
                                                setSimIgnoredSkills(prev => [...prev, val].filter(Boolean));
                                            }
                                            e.target.value = '';
                                        }}
                                        value=""
                                    >
                                        <option value="" disabled>Add Skill to Ignore...</option>
                                        {[
                                            ...Object.keys((skillsData as any).Sentinel || {}),
                                            ...Object.keys((skillsData as any).Vanguard || {}),
                                            ...Object.keys((skillsData as any).Support || {})
                                        ].filter(s => !simIgnoredSkills.includes(s)).map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </section>
                        )
                    }

                    {
                        results.length > 0 && (
                            <section className="results-section">
                                <div className="results-header">
                                    <h2>Results ({results.length} found)</h2>
                                    <button className="export-btn" onClick={handleExportJSON}>
                                        ⬇ Export to JSON
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr)', gap: '2rem', alignItems: 'start' }}>
                                    <div className="results-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))' }}>
                                        {results.map(r => {
                                            if (showDamageSimulation) {
                                                r.simulatedDamage = calculateBuildDamage(r, simStats, simIgnoredSkills);
                                            }
                                            return r;
                                        }).sort((a, b) => {
                                            if (showDamageSimulation && a.simulatedDamage && b.simulatedDamage) {
                                                return b.simulatedDamage - a.simulatedDamage;
                                            }
                                            return 0; // maintain original optimize sorting if not simulating
                                        }).slice(resultPage * resultsPerPage, (resultPage + 1) * resultsPerPage).map((res, i) => (
                                            <div key={i} className="result-card glassmorphism">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                    <h3 style={{ margin: 0 }}>Build #{resultPage * resultsPerPage + i + 1}</h3>
                                                    {selectedDoll && (
                                                        <button
                                                            className="glow-btn"
                                                            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                                                            onClick={async () => {
                                                                // Unequip currently equipped
                                                                const changes: EquipChange[] = [];
                                                                const currentEquipped = relics.filter(r => r.equipped === selectedDoll);
                                                                for (const r of currentEquipped) {
                                                                    if (r.id) {
                                                                        await db.relics.update(r.id, { equipped: undefined });
                                                                        changes.push({ relicId: r.id, prevEquipped: r.equipped, newEquipped: undefined });
                                                                    }
                                                                }
                                                                // Equip new build elements
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
                                                                // Cleanly unselect inspector if it was open to avoid confusion
                                                                setSelectedEquippedRelic(null);
                                                            }}
                                                            title={`Equip this combination to ${selectedDoll}`}
                                                        >
                                                            Equip to {selectedDoll}
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="stats-row" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                                    {showDamageSimulation && (
                                                        <div style={{ color: 'var(--accent-glow)', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                                                            Avg DMG: {Math.round(res.simulatedDamage || 0).toLocaleString()}
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                                        {Object.entries(res.rawCategoryLevels).map(([cat, lvl]) => (
                                                            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                                                                <img src={getCatBadgeIconUrl(cat)} alt={cat} style={{ width: '20px', height: '20px' }} />
                                                                <span style={{ color: 'var(--text-primary)' }}>{lvl}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                                                        {Object.entries(res.effectiveSkillLevels)
                                                            .sort(([, a], [, b]) => b - a)
                                                            .map(([skill, lvl]) => (
                                                                <div key={skill} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                                                                    <span style={{ color: 'var(--text-secondary)' }}>{skill}</span>
                                                                    <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>Lv. {lvl}</span>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>
                                                <div className="relic-list" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.5rem', background: 'none', padding: 0 }}>
                                                    {res.relics.map((r, ri) => (
                                                        <div key={ri} style={{ width: '80px', height: '80px' }}>
                                                            <RelicThumbnail
                                                                relic={r}
                                                                isSelected={selectedRelicInResults?.id === r.id && selectedRelicInResults?.id !== undefined}
                                                                onClick={() => setSelectedRelicInResults(r)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {results.length > resultsPerPage && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                                        <button
                                            className="glow-btn"
                                            disabled={resultPage === 0}
                                            onClick={() => setResultPage(Math.max(0, resultPage - 1))}
                                            style={{ padding: '0.4rem 1rem' }}
                                        >
                                            ← Previous
                                        </button>
                                        <span style={{ color: 'var(--text-secondary)' }}>
                                            Page {resultPage + 1} of {Math.ceil(results.length / resultsPerPage)} (Showing {resultPage * resultsPerPage + 1} - {Math.min((resultPage + 1) * resultsPerPage, results.length)} of {results.length})
                                        </span>
                                        <button
                                            className="glow-btn"
                                            disabled={resultPage >= Math.ceil(results.length / resultsPerPage) - 1}
                                            onClick={() => setResultPage(Math.min(Math.ceil(results.length / resultsPerPage) - 1, resultPage + 1))}
                                            style={{ padding: '0.4rem 1rem' }}
                                        >
                                            Next →
                                        </button>
                                    </div>
                                )}

                            </section>
                        )
                    }

                    {
                        hasOptimized && results.length === 0 && !errorMsg && (
                            <section className="results-section result-empty glassmorphism">
                                <h2>No Builds Found</h2>
                                <p>No valid combination of 6 relics matched your exact constraints.</p>
                                <p className="hint">Try lowering the category constraints or checking if you have enough allowed slot types for this character.</p>
                            </section>
                        )
                    }
                </main>
            </div >

            {
                selectedRelicInResults && (
                    <RelicModal
                        relic={selectedRelicInResults}
                        onClose={() => setSelectedRelicInResults(null)}
                    />
                )
            }
            {renderModals()}
        </>
    );


}

export default App;
