import React from 'react';
import { BuildResult, Relic } from '../../optimizer/types';
import { RelicThumbnail } from '../RelicThumbnail';
import { getCatBadgeIconUrl } from '../../utils/relicUtils';
import { calculateBuildDamage } from '../../utils/buildUtils';

interface OptimizationResultsProps {
    results: BuildResult[];
    resultPage: number;
    setResultPage: React.Dispatch<React.SetStateAction<number>>;
    resultsPerPage: number;
    showDamageSimulation: boolean;
    simStats: any;
    simIgnoredSkills: string[];
    handleExportJSON: () => void;
    onEquipBuild: (build: BuildResult) => void;
    selectedDoll: string;
    selectedRelicInResults: Relic | null;
    setSelectedRelicInResults: React.Dispatch<React.SetStateAction<Relic | null>>;
}

export function OptimizationResults({
    results,
    resultPage,
    setResultPage,
    resultsPerPage,
    showDamageSimulation,
    simStats,
    simIgnoredSkills,
    handleExportJSON,
    onEquipBuild,
    selectedDoll,
    selectedRelicInResults,
    setSelectedRelicInResults
}: OptimizationResultsProps) {
    if (results.length === 0) return null;

    return (
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
                                        onClick={() => onEquipBuild(res)}
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
    );
}
