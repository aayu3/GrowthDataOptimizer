import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import { Relic, RelicSkill } from '../optimizer/types';
import relicInfo from '../data/relicinfo.json';
import { RelicThumbnail } from './RelicThumbnail';

interface AuxSkillState {
    category: string;
    skill: RelicSkill;
}

interface Props {
    relicToEdit?: Relic | null;
    onClose: () => void;
}

export const RelicEditorModal: React.FC<Props> = ({ relicToEdit, onClose }) => {
    const [type, setType] = useState<string>('Bulwark');
    const [rarity, setRarity] = useState<string>('T4');
    const [mainSkill, setMainSkill] = useState<RelicSkill>({ name: '', level: 1 });
    const [auxSkills, setAuxSkills] = useState<AuxSkillState[]>([]);
    const [equipped] = useState<string | null>(relicToEdit?.equipped || null);

    // Derived options from relicInfo
    const relTypes = Object.keys(relicInfo.RELIC_TYPES || {});
    const rarities = Object.keys(relicInfo.RARITIES || {});

    const getTypeData = (t: string) => (relicInfo.RELIC_TYPES as any)[t];

    const getAvailableMainSkills = (t: string) => {
        const data = getTypeData(t);
        return data ? data.main_skills || [] : [];
    };

    const getAvailableAuxSkills = (t: string) => {
        const data = getTypeData(t);
        if (!data || !data.aux_skills) return [];
        const skills: string[] = [];
        for (const rawName of Object.keys(data.aux_skills)) {
            if (rawName.includes('{Element}')) {
                relicInfo.ELEMENTS?.forEach((el: string) => skills.push(rawName.replace('{Element}', el)));
            } else {
                skills.push(rawName);
            }
        }
        return skills;
    };

    const getMaxAuxSkillLevel = (t: string, skillName: string) => {
        const data = getTypeData(t);
        if (!data || !data.aux_skills) return 6;
        for (const [rawName, lvl] of Object.entries<number>(data.aux_skills)) {
            if (skillName === rawName || (rawName.includes('{Element}') && relicInfo.ELEMENTS?.some((el: string) => rawName.replace('{Element}', el) === skillName))) {
                return lvl;
            }
        }
        return 6;
    };

    const getCategoryForAuxSkill = (skillName: string): string => {
        for (const cat of relTypes) {
            const options = getAvailableAuxSkills(cat);
            if (options.includes(skillName)) return cat;
        }
        return 'Bulwark'; // fallback
    };

    useEffect(() => {
        if (relicToEdit) {
            setType(relicToEdit.type);
            setRarity(relicToEdit.rarity);
            setMainSkill(relicToEdit.main_skill);

            // Map the simple RelicSkill array to the new AuxSkillState array
            const mappedAux = relicToEdit.aux_skills.map(s => ({
                category: getCategoryForAuxSkill(s.name),
                skill: { ...s }
            }));
            setAuxSkills(mappedAux);
        } else {
            // Default
            const defaultType = relTypes[0] || 'Bulwark';
            setType(defaultType);
            const mainOptions = getAvailableMainSkills(defaultType);
            setMainSkill({ name: mainOptions[0] || '', level: 1 });
            setAuxSkills([]);
        }
    }, [relicToEdit]);

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value;
        setType(newType);
        const mainOptions = getAvailableMainSkills(newType);
        setMainSkill({ name: mainOptions[0] || '', level: 1 });
        setAuxSkills([]); // Reset aux skills as they are type specific
    };

    const addAuxSkill = () => {
        if (auxSkills.length >= 2) return; // Max 2 aux skills
        const cat = relTypes[0]; // Default to first category
        const options = getAvailableAuxSkills(cat);
        if (options.length > 0) {
            setAuxSkills([...auxSkills, { category: cat, skill: { name: options[0], level: 1 } }]);
        }
    };

    const removeAuxSkill = (idx: number) => {
        const newArr = [...auxSkills];
        newArr.splice(idx, 1);
        setAuxSkills(newArr);
    };

    const updateAuxCategory = (idx: number, category: string) => {
        const newArr = [...auxSkills];
        newArr[idx].category = category;
        const options = getAvailableAuxSkills(category);
        newArr[idx].skill = { name: options[0] || '', level: 1 };
        setAuxSkills(newArr);
    };

    const updateAuxSkill = (idx: number, field: keyof RelicSkill, val: any) => {
        const newArr = [...auxSkills];
        if (field === 'name') {
            newArr[idx].skill.name = val;
            // Cap the level if the new skill has a lower max
            const maxLvl = getMaxAuxSkillLevel(newArr[idx].category, val);
            if (newArr[idx].skill.level > maxLvl) newArr[idx].skill.level = maxLvl;
        } else if (field === 'level') {
            newArr[idx].skill.level = parseInt(val) || 1;
        }
        setAuxSkills(newArr);
    };

    const handleSave = async () => {
        const cleanAuxSkills = auxSkills.map(a => a.skill);
        const total_level = mainSkill.level + cleanAuxSkills.reduce((sum, s) => sum + s.level, 0);
        const relicData: Relic = {
            type,
            rarity,
            main_skill: mainSkill,
            aux_skills: cleanAuxSkills,
            total_level,
            equipped,
            createdAt: relicToEdit?.createdAt || Date.now()
        };

        if (relicToEdit?.id) {
            relicData.id = relicToEdit.id;
            await db.relics.put(relicData);
        } else {
            await db.relics.add(relicData);
        }
        onClose();
    };

    const mainOptions = getAvailableMainSkills(type);

    return (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card glassmorphism" style={{ width: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 style={{ marginTop: 0 }}>{relicToEdit ? 'Edit Relic' : 'Add Custom Relic'}</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    <div className="input-group">
                        <label>Category</label>
                        <select value={type} onChange={handleTypeChange} className="bg-dropdown">
                            {relTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div className="input-group">
                        <label>Rarity</label>
                        <select value={rarity} onChange={e => setRarity(e.target.value)} className="bg-dropdown">
                            {rarities.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0' }}>Main Skill</h4>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <select
                                value={mainSkill.name}
                                onChange={e => setMainSkill({ ...mainSkill, name: e.target.value })}
                                className="bg-dropdown"
                                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', color: 'white' }}
                            >
                                {mainOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <select
                                value={mainSkill.level}
                                onChange={e => setMainSkill({ ...mainSkill, level: parseInt(e.target.value) || 1 })}
                                className="bg-dropdown"
                                style={{ width: '80px', backgroundColor: 'rgba(0,0,0,0.8)', color: 'white' }}
                            >
                                {[1, 2, 3, 4, 5, 6].map(lvl => (
                                    <option key={lvl} value={lvl}>{lvl}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h4 style={{ margin: 0 }}>Auxiliary Skills ({auxSkills.length}/2)</h4>
                            <button
                                onClick={addAuxSkill}
                                className="glow-btn"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', opacity: auxSkills.length >= 2 ? 0.5 : 1, cursor: auxSkills.length >= 2 ? 'not-allowed' : 'pointer' }}
                                disabled={auxSkills.length >= 2}
                            >+ Add Aux</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {auxSkills.map((aux, idx) => {
                                const maxLvl = getMaxAuxSkillLevel(aux.category, aux.skill.name);
                                const auxOptionsForCat = getAvailableAuxSkills(aux.category);
                                return (
                                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <select
                                            value={aux.category}
                                            onChange={e => updateAuxCategory(idx, e.target.value)}
                                            className="bg-dropdown"
                                            style={{ width: '110px', backgroundColor: 'rgba(0,0,0,0.8)', color: 'white' }}
                                        >
                                            {relTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <select
                                            value={aux.skill.name}
                                            onChange={e => updateAuxSkill(idx, 'name', e.target.value)}
                                            className="bg-dropdown"
                                            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', color: 'white' }}
                                        >
                                            {auxOptionsForCat.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                        <select
                                            value={aux.skill.level}
                                            onChange={e => updateAuxSkill(idx, 'level', e.target.value)}
                                            className="bg-dropdown"
                                            style={{ width: '60px', backgroundColor: 'rgba(0,0,0,0.8)', color: 'white' }}
                                        >
                                            {Array.from({ length: maxLvl }, (_, i) => i + 1).map(lvl => (
                                                <option key={lvl} value={lvl}>{lvl}</option>
                                            ))}
                                        </select>
                                        <button onClick={() => removeAuxSkill(idx)} style={{ background: 'none', border: 'none', color: '#ff4c4c', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.2rem' }}>×</button>
                                    </div>
                                );
                            })}
                            {auxSkills.length === 0 && <div className="hint">No aux skills added.</div>}
                        </div>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Preview</h4>
                        <div style={{ width: '64px', height: '64px' }}>
                            <RelicThumbnail relic={{
                                type,
                                rarity,
                                main_skill: mainSkill,
                                aux_skills: auxSkills.map(a => a.skill),
                                total_level: mainSkill.level + auxSkills.reduce((sum, a) => sum + a.skill.level, 0),
                                equipped: null,
                                createdAt: Date.now()
                            }} />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                    <button className="back-btn" onClick={onClose} style={{ position: 'relative', padding: '0.5rem 1rem' }}>Cancel</button>
                    <button className="glow-btn" onClick={handleSave} style={{ padding: '0.5rem 1rem' }}>Save Relic</button>
                </div>
            </div>
        </div>
    );
};
