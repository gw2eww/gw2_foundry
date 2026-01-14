import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const traitsPath = path.join(__dirname, '..', 'public', 'data', 'traits.json');
const skillsPath = path.join(__dirname, '..', 'public', 'data', 'skills.json');

const traits = JSON.parse(fs.readFileSync(traitsPath, 'utf-8'));
const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf-8'));

function findDupes(facts, name, mode) {
  if (!facts || facts.length === 0) return [];

  const dupes = [];
  const seen = new Map();

  for (const fact of facts) {
    let key;
    if (fact.type === 'PrefixedBuff') {
      key = 'PrefixedBuff:' + (fact.prefix?.status || '') + ':' + fact.status;
    } else if (fact.type === 'Buff') {
      key = 'Buff:' + fact.status;
    } else if (fact.type === 'Time' && fact.text) {
      key = 'Time:' + fact.text;
    } else if (fact.type === 'Percent' && fact.text) {
      key = 'Percent:' + fact.text;
    } else if (fact.type === 'AttributeAdjust') {
      key = 'AttributeAdjust:' + (fact.target || fact.text);
    } else {
      continue;
    }

    const val = fact.duration ?? fact.percent ?? fact.value;
    if (seen.has(key)) {
      seen.get(key).push(val);
    } else {
      seen.set(key, [val]);
    }
  }

  for (const [key, values] of seen) {
    if (values.length > 1) {
      dupes.push({ name, mode, key, values });
    }
  }
  return dupes;
}

console.log('=== TRAITS WITH DUPLICATE FACTS ===\n');
let traitDupes = 0;
for (const trait of traits) {
  for (const mode of ['wvw', 'pvp', 'pve']) {
    if (trait[mode]?.facts) {
      const dupes = findDupes(trait[mode].facts, trait.name, mode);
      dupes.forEach(d => {
        console.log(`${d.name} [${d.mode}]: ${d.key}`);
        console.log(`  Values: ${d.values.join(', ')}`);
        traitDupes++;
      });
    }
  }
}
if (traitDupes === 0) console.log('None found.');

console.log('\n=== SKILLS WITH DUPLICATE FACTS ===\n');
let skillDupes = 0;
for (const [prof, profSkills] of Object.entries(skills)) {
  for (const skill of profSkills) {
    for (const mode of ['wvw', 'pvp', 'pve']) {
      if (skill[mode]?.facts) {
        const dupes = findDupes(skill[mode].facts, `${skill.name} (${prof})`, mode);
        dupes.forEach(d => {
          console.log(`${d.name} [${d.mode}]: ${d.key}`);
          console.log(`  Values: ${d.values.join(', ')}`);
          skillDupes++;
        });
      }
    }
  }
}
if (skillDupes === 0) console.log('None found.');

console.log(`\n=== SUMMARY ===`);
console.log(`Trait duplicates: ${traitDupes}`);
console.log(`Skill duplicates: ${skillDupes}`);
