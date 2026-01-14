#!/usr/bin/env node

/**
 * Apply manual overrides to skill/trait data.
 * Used for balance changes not yet reflected on the wiki.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'public', 'data');
const overridesPath = path.join(__dirname, 'manual-overrides.json');

/**
 * Apply overwriteFacts rules to a facts array
 */
function applyOverwriteFacts(facts, overwriteRules) {
  if (!facts || !overwriteRules) return facts;

  return facts.map(fact => {
    for (const rule of overwriteRules) {
      const match = rule.match;

      // Check if this fact matches the rule
      let matches = true;
      if (match.type && fact.type !== match.type) matches = false;
      if (match.text && fact.text !== match.text) matches = false;
      if (match.status && fact.status !== match.status) matches = false;
      if (match.target && fact.target !== match.target) matches = false;
      if (match.prefix && fact.prefix?.status !== match.prefix) matches = false;

      if (matches) {
        // Apply the override
        return { ...fact, ...rule.set };
      }
    }
    return fact;
  });
}

/**
 * Apply a mode override to an item
 */
function applyModeOverride(item, mode, override) {
  if (!item[mode]) {
    item[mode] = { facts: item.facts ? [...item.facts] : [] };
  }

  if (override.facts) {
    // Replace entire facts array
    item[mode].facts = override.facts.map(f => {
      // Find matching base fact to get icon
      const baseFact = item.facts?.find(bf =>
        bf.type === f.type && (bf.text === f.text || bf.status === f.status)
      );
      return baseFact ? { ...baseFact, ...f } : f;
    });
  }

  if (override.overwriteFacts) {
    // Apply specific fact overwrites
    item[mode].facts = applyOverwriteFacts(item[mode].facts, override.overwriteFacts);
  }
}

export function applyManualOverrides(traits, skills) {
  if (!fs.existsSync(overridesPath)) {
    console.log('  No manual overrides file found, skipping...');
    return { traits, skills };
  }

  const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'));
  let traitsModified = 0;
  let skillsModified = 0;

  // Apply trait overrides
  if (overrides.traits) {
    for (const [traitName, traitOverrides] of Object.entries(overrides.traits)) {
      const trait = traits.find(t => t.name === traitName);
      if (!trait) {
        console.log(`  ⚠️  Trait not found: ${traitName}`);
        continue;
      }

      for (const mode of ['pve', 'pvp', 'wvw']) {
        if (traitOverrides[mode]) {
          applyModeOverride(trait, mode, traitOverrides[mode]);
        }
      }
      traitsModified++;
    }
  }

  // Apply skill overrides
  if (overrides.skills) {
    for (const [skillName, skillOverrides] of Object.entries(overrides.skills)) {
      // Skills are organized by profession
      let found = false;
      for (const [profession, profSkills] of Object.entries(skills)) {
        const skill = profSkills.find(s => s.name === skillName);
        if (skill) {
          for (const mode of ['pve', 'pvp', 'wvw']) {
            if (skillOverrides[mode]) {
              applyModeOverride(skill, mode, skillOverrides[mode]);
            }
          }
          skillsModified++;
          found = true;
          break;
        }
      }
      if (!found) {
        console.log(`  ⚠️  Skill not found: ${skillName}`);
      }
    }
  }

  console.log(`  ✓ Applied manual overrides (${traitsModified} traits, ${skillsModified} skills)`);
  return { traits, skills };
}

// If run directly, apply overrides to existing data files
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Applying manual overrides to data files...\n');

  const traitsPath = path.join(dataDir, 'traits.json');
  const skillsPath = path.join(dataDir, 'skills.json');

  const traits = JSON.parse(fs.readFileSync(traitsPath, 'utf-8'));
  const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf-8'));

  applyManualOverrides(traits, skills);

  fs.writeFileSync(traitsPath, JSON.stringify(traits, null, 2));
  fs.writeFileSync(skillsPath, JSON.stringify(skills, null, 2));

  console.log('\n✅ Manual overrides applied!');
}
