import { useState, useRef } from 'react';
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
import { RelicInspector } from './components/RelicInspector';
import { getSkillMaxLevel, getCatBadgeIconUrl, getSkillCategory } from './utils/relicUtils';
import { Relic } from './optimizer/types';

function App() {
    const [activeTab, setActiveTab] = useState<'optimizer' | 'database'>('optimizer');
    const [selectedDoll, setSelectedDoll] = useState<string | null>(null);
    const relics = useLiveQuery(() => db.relics.toArray(), []) || [];
    const [constraints, setConstraints] = useState<OptimizerConstraints>({
        targetCategoryLevels: {},
        targetSkillLevels: {}
    });
    const [results, setResults] = useState<BuildResult[]>([]);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [hasOptimized, setHasOptimized] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedCategoryForFilter, setSelectedCategoryForFilter] = useState<string>('Bulwark');
    const [selectedSkillForFilter, setSelectedSkillForFilter] = useState<string>('');
    const [activeSkillFilters, setActiveSkillFilters] = useState<string[]>([]);
    const [includeOtherEquipped, setIncludeOtherEquipped] = useState(true);
    const [selectedRelicInResults, setSelectedRelicInResults] = useState<Relic | null>(null);

    const workerRef = useRef<Worker | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (Array.isArray(json)) {
                    // Make sure relics don't have overlapping predefined IDs if inserting raw
                    await db.relics.clear(); // Clear old inventory
                    // Optionally strip ID if json has them to let auto-increment handle it, or just bulkAdd
                    await db.relics.bulkAdd(json.map((r: any) => {
                        const { id, ...rest } = r; // remove static ids if present
                        return rest;
                    }));
                    setErrorMsg('');
                } else {
                    setErrorMsg('Invalid inventory format. Expected an array of relics.');
                }
            } catch (err) {
                setErrorMsg('Failed to parse JSON file.');
            }
        };
        reader.readAsText(file);
    };

    const startOptimization = () => {
        if (relics.length === 0) {
            setErrorMsg('Please upload an inventory first.');
            return;
        }

        setIsOptimizing(true);
        setHasOptimized(false);
        setResults([]);
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
            </div>
        );
    }

    if (!selectedDoll) {
        const availableDolls = Object.keys(dollsData);
        return (
            <div className="app-container">
                <header className="header-glow">
                    <h1>GF2 <span>Relic Optimizer</span></h1>
                    <p className="subtitle">Import Inventory or Select a Character</p>
                    <div className="nav-tabs" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                        <button className="back-btn" style={{ position: 'relative' }} onClick={() => setActiveTab('database')}>Browse Database</button>
                        <label className="glow-btn" style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                            Upload inventory.json
                            <input type="file" accept=".json" onChange={handleFileUpload} hidden />
                        </label>
                    </div>
                    <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {relics.length > 0 ? <span className="success">✓ Database holds {relics.length} Relics</span> : <span>No relics loaded.</span>}
                        {errorMsg && <span className="error" style={{ marginLeft: '1rem' }}>{errorMsg}</span>}
                    </div>
                </header>

                <main className="main-content">
                    <section className="card glassmorphism">
                        <h2>Available Dolls</h2>
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
                                    </button>
                                );
                            })}
                        </div>
                        <p className="hint" style={{ marginTop: '1rem' }}>
                            Currently, functional slot configurations are primarily loaded for Suomi. Other characters will become fully functional as data is added.
                        </p>
                    </section>
                </main>
            </div>
        );
    }

    const selectedDollData = (dollsData as Record<string, DollDefinition>)[selectedDoll];

    return (
        <div className="app-container">
            <header className="header-glow">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                    <button className="back-btn" onClick={() => { setSelectedDoll(null); setResults([]); setHasOptimized(false); }}>← Back</button>
                    <h1>Configuring <span>{selectedDoll}</span></h1>
                </div>
                <p className="subtitle">
                    Allowed Slots: {Object.entries(selectedDollData.allowed_slots).map(([type, count]) => `${count}x ${type}`).join(', ')}
                </p>
            </header>

            <main className="main-content">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', alignItems: 'start' }}>
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
                                        <input
                                            type="number"
                                            min="0"
                                            max={getSkillMaxLevel(skill)}
                                            placeholder="0"
                                            value={constraints.targetSkillLevels[skill] || ''}
                                            onChange={(e) => handleTargetSkillChange(skill, e.target.value)}
                                        />
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
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <label htmlFor="includeEquipped" style={{ cursor: 'pointer', fontSize: '0.95rem' }}>
                                Include relics equipped by other characters
                            </label>
                        </div>
                    </section>

                    <section className="card glassmorphism" style={{ position: 'sticky', top: '2rem' }}>
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
                                            background: isActive ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0,0,0,0.3)',
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

                <div className="action-row">
                    <button
                        className={`glow-btn ${isOptimizing ? 'loading' : ''}`}
                        onClick={startOptimization}
                    >
                        {isOptimizing ? 'Optimizing...' : 'Run Optimizer'}
                    </button>
                </div>

                {results.length > 0 && (
                    <section className="results-section">
                        <div className="results-header">
                            <h2>Results ({results.length} found)</h2>
                            <button className="export-btn" onClick={handleExportJSON}>
                                ⬇ Export to JSON
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: selectedRelicInResults ? '1fr 350px' : '1fr', gap: '2rem', alignItems: 'start' }}>
                            <div className="results-grid" style={{ gridTemplateColumns: selectedRelicInResults ? '1fr' : 'repeat(auto-fill, minmax(400px, 1fr))' }}>
                                {results.slice(0, 50).map((res, i) => (
                                    <div key={i} className="result-card glassmorphism">
                                        <h3>Build #{i + 1}</h3>
                                        <div className="stats-row" style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                            {Object.entries(res.rawCategoryLevels).map(([cat, lvl]) => (
                                                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                                                    <img src={getCatBadgeIconUrl(cat)} alt={cat} style={{ width: '20px', height: '20px' }} />
                                                    <span style={{ color: 'var(--text-primary)' }}>{lvl}</span>
                                                </div>
                                            ))}
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

                            {selectedRelicInResults && (
                                <aside className="card glassmorphism" style={{ position: 'sticky', top: '2rem' }}>
                                    <RelicInspector
                                        selectedRelic={selectedRelicInResults}
                                        onClose={() => setSelectedRelicInResults(null)}
                                    />
                                </aside>
                            )}
                        </div>
                        {results.length > 50 && <p className="hint">Showing top 50 results...</p>}
                    </section>
                )}

                {hasOptimized && results.length === 0 && !errorMsg && (
                    <section className="results-section result-empty glassmorphism">
                        <h2>No Builds Found</h2>
                        <p>No valid combination of 6 relics matched your exact constraints.</p>
                        <p className="hint">Try lowering the category constraints or checking if you have enough allowed slot types for this character.</p>
                    </section>
                )}
            </main>
        </div>
    );
}

export default App;
