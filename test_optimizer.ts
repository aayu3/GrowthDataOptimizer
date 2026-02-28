import fs from 'fs';
import { RelicSolver } from './src/optimizer/solver.js';
import skillsData from './src/data/skills.json' assert { type: "json" };
import relicInfo from './src/data/relicinfo.json' assert { type: "json" };

const rawInventory = JSON.parse(fs.readFileSync('./src/data/inventory.json', 'utf-8'));

const constraints: OptimizerConstraints = {
    targetCategoryLevels: {
        "Bulwark": 12,
        "Support": 8
    },
    targetSkillLevels: {
        "HP Boost": 6,
        "Defense Boost": 4
    },
    allowedSlots: {
        "Support": 4,
        "Bulwark": 2
    }
};

const solver = new RelicSolver(rawInventory, constraints, skillsData, relicInfo);
console.time('solver');
const results = solver.solve();
console.timeEnd('solver');

console.log(`Found ${results.length} builds!`);
if (results.length > 0) {
    console.log("Top Build Category Levels:", results[0].rawCategoryLevels);
    console.log("Top Build Effective Skills:", results[0].effectiveSkillLevels);
}
