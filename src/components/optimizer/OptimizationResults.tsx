import React from 'react';
import { BuildResult, Relic } from '../../optimizer/types';
import { RelicThumbnail } from '../RelicThumbnail';
import { getCatBadgeIconUrl, getSkillCategory, getSkillDescription } from '../../utils/relicUtils';
import { calculateBuildDamage } from '../../utils/buildUtils';
import { PostGenerationFilter } from './PostGenerationFilter';

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
    totalResults: number;
    skillSortBy: 'lvl' | 'type';
    postSkillFilters: Record<string, number>;
    setPostSkillFilters: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    categorizedSkills: Record<string, string[]>;
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
    setSelectedRelicInResults,
    totalResults,
    skillSortBy,
    postSkillFilters,
    setPostSkillFilters,
    categorizedSkills
}: OptimizationResultsProps) {
    const [expandedSkillKeys, setExpandedSkillKeys] = React.useState<Set<string>>(new Set());
    const [isFilterOpen, setIsFilterOpen] = React.useState<boolean>(false);

    return (
        <section className="results-section">
            <div className="results-header" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>Results ({totalResults} found)</h2>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button
                            className="glow-btn"
                            style={{
                                padding: '0.4rem 1rem',
                                background: isFilterOpen ? 'var(--accent-glow)' : 'white',
                                color: isFilterOpen ? 'inherit' : 'black'
                            }}
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                        >
                            Filter
                        </button>
                        <button className="export-btn" onClick={handleExportJSON}>
                            ⬇ Export to JSON
                        </button>
                    </div>
                </div>
                {isFilterOpen && (
                    <PostGenerationFilter
                        postSkillFilters={postSkillFilters}
                        setPostSkillFilters={setPostSkillFilters}
                        categorizedSkills={categorizedSkills}
                    />
                )}
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
                            <div className="stats-row" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
                                {showDamageSimulation && (
                                    <div style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', marginTop: '0.5rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Skills</div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                                    {Object.entries(res.effectiveSkillLevels)
                                        .sort((a, b) => {
                                            if (skillSortBy === 'lvl') {
                                                if (b[1] !== a[1]) return b[1] - a[1];
                                                return a[0].localeCompare(b[0]);
                                            } else {
                                                const catA = getSkillCategory(a[0]);
                                                const catB = getSkillCategory(b[0]);

                                                const counts: Record<string, number> = {};
                                                Object.keys(res.effectiveSkillLevels).forEach(k => {
                                                    const c = getSkillCategory(k);
                                                    counts[c] = (counts[c] || 0) + 1;
                                                });

                                                if (counts[catA] !== counts[catB]) {
                                                    return counts[catB] - counts[catA];
                                                }
                                                if (catA !== catB) return catA.localeCompare(catB);
                                                return b[1] - a[1];
                                            }
                                        })
                                        .map(([skill, lvl]) => (
                                            <div key={skill} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 'var(--radius)', outline: getSkillCategory(skill) !== 'Unknown' ? `1px solid var(--cat-${getSkillCategory(skill).toLowerCase()})` : 'none', cursor: 'pointer' }}
                                                    onClick={() => setExpandedSkillKeys(prev => { const next = new Set(prev); const key = `${i}-${skill}`; next.has(key) ? next.delete(key) : next.add(key); return next; })}
                                                >
                                                    <span style={{ color: 'var(--text-secondary)' }}>{skill}</span>
                                                    <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>Lv. {lvl}</span>
                                                </div>
                                                {expandedSkillKeys.has(`${i}-${skill}`) && (
                                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: 'var(--radius)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>
                                                        {getSkillDescription(skill, lvl)}
                                                    </div>
                                                )}
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
                                            hideEquippedIcon={true}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {
                results.length > resultsPerPage && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius)' }}>
                        <button
                            className="glow-btn"
                            disabled={resultPage === 0}
                            onClick={() => setResultPage(Math.max(0, resultPage - 1))}
                            style={{ padding: '0.4rem 1rem' }}
                        >
                            ← Previous
                        </button>
                        <span style={{ color: 'var(--text-secondary)' }}>
                            Page {resultPage + 1} of {Math.ceil(totalResults / resultsPerPage)} (Showing {resultPage * resultsPerPage + 1} - {Math.min((resultPage + 1) * resultsPerPage, totalResults)} of {totalResults})
                        </span>
                        <button
                            className="glow-btn"
                            disabled={resultPage >= Math.ceil(totalResults / resultsPerPage) - 1}
                            onClick={() => setResultPage(Math.min(Math.ceil(totalResults / resultsPerPage) - 1, resultPage + 1))}
                            style={{ padding: '0.4rem 1rem' }}
                        >
                            Next →
                        </button>
                    </div>
                )
            }
        </section >
    );
}

