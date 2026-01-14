#!/usr/bin/env node

/**
 * Parse GW2 Wiki wikitext infoboxes to extract competitive split data
 */

// Standard icons for common boons/conditions from GW2 API
const BUFF_ICONS = {
  // Boons
  'aegis': 'https://render.guildwars2.com/file/DFB4D1B50AE4D6A275B349E15B179261A7F0F528/102854.png',
  'alacrity': 'https://render.guildwars2.com/file/4FDAC2113B500104121753EF7E026E45C141E94D/1938787.png',
  'fury': 'https://render.guildwars2.com/file/96D90DF84CAFE008233DD1C2606A12C1A0E68048/102842.png',
  'might': 'https://render.guildwars2.com/file/2FA9DF9D6BC17839BBEA14723F1C53D645DDB5E1/102852.png',
  'protection': 'https://render.guildwars2.com/file/CD77D1FAB7B270223538A8F8ECDA1CFB044D65F4/102834.png',
  'quickness': 'https://render.guildwars2.com/file/D4AB6401A6D6917C3D4F230764452BCCE1035B0D/1012835.png',
  'regeneration': 'https://render.guildwars2.com/file/F69996772B9E18FD18AD0AABBD24E9B7BFAB01B6/102835.png',
  'resistance': 'https://render.guildwars2.com/file/50BAC1B8E10CFAB9E749A5D910D4A9DCF29EBB7C/961398.png',
  'resolution': 'https://render.guildwars2.com/file/D104A6B9344A2E2096424A3C300E46BC2926E4D7/2440718.png',
  'stability': 'https://render.guildwars2.com/file/3D3A1C2D6D791C05179AB871902D28782C65C244/415959.png',
  'swiftness': 'https://render.guildwars2.com/file/20CFC14967E67F7A3FD4A4B8722B4CF5B8565E11/102836.png',
  'vigor': 'https://render.guildwars2.com/file/58E92EBAF0DB4DA7C4AC04D9B22BCA5ECF0100DE/102843.png',
  // Conditions
  'bleeding': 'https://render.guildwars2.com/file/79FF0046A5F9ADA3B4C4EC19F4DB1B1A092A2F50/102848.png',
  'blind': 'https://render.guildwars2.com/file/09770136BB76FD0DBE1CC4267DEED54774CB20F6/102837.png',
  'burning': 'https://render.guildwars2.com/file/B47BF5803FED2718D7474EAF9617629AD068EE10/102849.png',
  'chilled': 'https://render.guildwars2.com/file/28C4EC547A3516AF0242E826772DA43A5EAC3DF3/102839.png',
  'confusion': 'https://render.guildwars2.com/file/289AA0A4644F0E044DED3D3F39CED958E1DDFF53/102880.png',
  'crippled': 'https://render.guildwars2.com/file/070325E519C178D502A8160523766070D30C0C19/102838.png',
  'fear': 'https://render.guildwars2.com/file/30307A117E0576C09D75FD3E7B7D4A4E6D7E06AF/102869.png',
  'immobile': 'https://render.guildwars2.com/file/397A613651BFCA2832B6469CE34735580A2C120E/102844.png',
  'poison': 'https://render.guildwars2.com/file/559B0AF9FB5E1243D2649FAAE660CCB338AACC19/102840.png',
  'slow': 'https://render.guildwars2.com/file/F60D1EF5271D7B9319610855676D320CD25F01C6/961397.png',
  'taunt': 'https://render.guildwars2.com/file/02EED459AD65FAF7DF32A260E479C625070841B9/1228472.png',
  'torment': 'https://render.guildwars2.com/file/10BABF2708CA3575730AC662A2E72EC292565B08/598887.png',
  'vulnerability': 'https://render.guildwars2.com/file/3A394C1A0A3257EB27A44842DDEEF0DF000E1241/102850.png',
  'weakness': 'https://render.guildwars2.com/file/6CB0E64AF9AA292E332A38C1770CE577E2CDE0E8/102853.png',
};

/**
 * Parse a wikitext infobox (skill or trait)
 * @param {string} wikitext - Raw wikitext content
 * @returns {object|null} Parsed infobox parameters
 */
export function parseInfobox(wikitext) {
  // Match {{Skill infobox ... }} or {{Trait infobox ... }}
  const infoboxMatch = wikitext.match(/\{\{(?:Skill|Trait) infobox\s*([\s\S]*?)\n\}\}/);
  if (!infoboxMatch) return null;

  const infoboxContent = infoboxMatch[1];
  const params = {};

  let currentKey = null;
  let currentValue = [];
  const lines = infoboxContent.split('\n');

  for (const line of lines) {
    // Check if this is a new parameter line
    const paramMatch = line.match(/^\|\s*([^=]+?)\s*=\s*(.*)$/);

    if (paramMatch) {
      // Save previous parameter if exists
      if (currentKey !== null) {
        params[currentKey] = currentValue.join('\n').trim();
      }

      // Start new parameter
      currentKey = paramMatch[1].trim();
      currentValue = [paramMatch[2]];
    } else if (currentKey !== null) {
      // Continuation of previous parameter
      currentValue.push(line);
    }
  }

  // Save last parameter
  if (currentKey !== null) {
    params[currentKey] = currentValue.join('\n').trim();
  }

  return params;
}

/**
 * Parse skill facts from wikitext
 * @param {string} factsText - The value of the "facts" parameter
 * @returns {object} Facts grouped by game mode
 */
export function parseSkillFacts(factsText) {
  if (!factsText) return {};

  const facts = { default: [], pve: [], pvp: [], wvw: [] };

  // Match {{skill fact|...}} patterns
  const factPattern = /\{\{skill fact\|([^}]+)\}\}/g;
  let match;

  while ((match = factPattern.exec(factsText)) !== null) {
    const factParams = parseFactParams(match[1]);
    const rawGameMode = factParams['game mode'];

    const fact = buildFactObject(factParams);
    if (!fact) continue;

    // Handle game mode - can be single mode or multiple (e.g., "pvp wvw")
    if (rawGameMode) {
      const normalized = rawGameMode.toLowerCase().trim();
      const modes = [];

      if (normalized.includes('pve')) modes.push('pve');
      if (normalized.includes('pvp')) modes.push('pvp');
      if (normalized.includes('wvw')) modes.push('wvw');

      // Add fact to each matching mode
      if (modes.length > 0) {
        for (const mode of modes) {
          facts[mode].push({ ...fact }); // Clone fact for each mode
        }
      } else {
        // Unknown game mode format, treat as default
        facts.default.push(fact);
      }
    } else {
      // No game mode specified, treat as default
      facts.default.push(fact);
    }
  }

  return facts;
}

/**
 * Parse parameters from a skill fact
 * @param {string} paramString - The parameter string from {{skill fact|...}}
 * @returns {object} Parsed parameters
 */
function parseFactParams(paramString) {
  const params = { _positional: [] };
  const parts = paramString.split('|');

  for (const part of parts) {
    const trimmed = part.trim();
    const eqIndex = trimmed.indexOf('=');

    if (eqIndex !== -1) {
      // Named parameter: key=value
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      params[key] = value;
    } else {
      // Positional parameter
      params._positional.push(trimmed);
    }
  }

  return params;
}

/**
 * Build a fact object from parsed parameters
 * @param {object} params - Parsed fact parameters
 * @returns {object|null} Fact object compatible with GW2 API format
 */
function buildFactObject(params) {
  const pos = params._positional;

  // First positional is usually the fact type/name
  const factName = pos[0];
  if (!factName) return null;

  const fact = { text: factName };

  // Map common fact types
  const factTypeLower = factName.toLowerCase();

  // Use alt parameter as text if provided (e.g., alt=Jagged Horror Summon Recharge)
  if (params.alt) {
    fact.text = params.alt;
  }

  if (factTypeLower === 'recharge' || factTypeLower === 'recharge time') {
    fact.type = 'Time';
    fact.text = params.alt || 'Recharge';
    fact.duration = parseFloat(pos[1] || params.value || 0);
  } else if (factTypeLower === 'range') {
    fact.type = 'Range';
    fact.value = parseInt(pos[1] || params.value || 0, 10);
  } else if (factTypeLower === 'radius') {
    fact.type = 'Radius';
    fact.value = parseInt(pos[1] || params.value || 0, 10);
  } else if (factTypeLower === 'damage') {
    fact.type = 'Damage';
    fact.hit_count = parseInt(params.strikes || 1, 10);
    fact.dmg_multiplier = parseFloat(params.coefficient || 0);
  } else if (factTypeLower === 'duration' || factTypeLower === 'time') {
    fact.type = 'Time';
    fact.text = params.alt || factName;
    fact.duration = parseFloat(pos[1] || params.value || 0);
  } else if (factTypeLower === 'targets' || factTypeLower === 'number of targets') {
    fact.type = 'Number';
    fact.text = 'Number of Targets';
    fact.value = parseInt(pos[1] || params.value || 0, 10);
  } else if (factTypeLower === 'percent' || factTypeLower.includes('percent') || factTypeLower.includes('increase') || factTypeLower.includes('reduction')) {
    fact.type = 'Percent';
    fact.text = params.alt || factName;
    fact.percent = parseFloat(pos[1] || params.value || 0);
  } else if (factTypeLower === 'attribute') {
    // Handle attribute adjustments (e.g., +100 Concentration)
    // Format: {{skill fact|attribute|AttributeName|Value|game mode=...}}
    fact.type = 'AttributeAdjust';

    // Map wiki attribute names to API target names
    const attributeName = pos[1]?.toLowerCase();
    const attributeMap = {
      'concentration': 'BoonDuration',
      'expertise': 'ConditionDuration',
      'power': 'Power',
      'precision': 'Precision',
      'ferocity': 'CritDamage',
      'toughness': 'Toughness',
      'vitality': 'Vitality',
      'condition damage': 'ConditionDamage',
      'healing power': 'Healing',
    };

    fact.target = attributeMap[attributeName] || pos[1]; // Fallback to original name if not in map
    fact.value = parseInt(pos[2] || params.value || 0, 10);
    delete fact.text; // AttributeAdjust facts don't have text field
  } else {
    // For buffs/conditions, first positional is the buff name
    // Check if this is a linked skill (PrefixedBuff)
    if (params['linked skill']) {
      fact.type = 'PrefixedBuff';
      fact.status = factName;
      fact.duration = parseFloat(pos[1] || 0);
      fact.prefix = {
        status: params['linked skill'],
      };

      if (params.stacks) {
        fact.apply_count = parseInt(params.stacks, 10);
      }

      // Add icon for the buff if available
      const iconKey = factName.toLowerCase();
      if (BUFF_ICONS[iconKey]) {
        fact.icon = BUFF_ICONS[iconKey];
      }
    } else {
      // Regular buff
      fact.type = 'Buff';
      fact.status = factName;
      fact.duration = parseFloat(pos[1] || 0);

      if (params.stacks) {
        fact.apply_count = parseInt(params.stacks, 10);
      }

      // Add icon for the buff if available
      const iconKey = factName.toLowerCase();
      if (BUFF_ICONS[iconKey]) {
        fact.icon = BUFF_ICONS[iconKey];
      }
    }
  }

  return fact;
}

/**
 * Extract mode-specific overrides from infobox params
 * @param {object} params - Parsed infobox parameters
 * @returns {object} Mode overrides { pve, pvp, wvw }
 */
export function extractModeOverrides(params) {
  const overrides = {};

  // Helper to create override for a mode
  const addOverride = (mode, factType, value) => {
    if (!overrides[mode]) {
      overrides[mode] = { facts: [] };
    }
    overrides[mode].facts.push({ type: factType, value });
  };

  // Check for recharge overrides
  const baseRecharge = parseFloat(params.recharge);

  if (params['recharge wvw']) {
    const wvwRecharge = parseFloat(params['recharge wvw']);
    if (wvwRecharge !== baseRecharge) {
      addOverride('wvw', 'Recharge', wvwRecharge);
    }
  }

  if (params['recharge pvp']) {
    const pvpRecharge = parseFloat(params['recharge pvp']);
    if (pvpRecharge !== baseRecharge) {
      addOverride('pvp', 'Recharge', pvpRecharge);
    }
  }

  // Check for activation overrides
  const baseActivation = parseFloat(params.activation);

  if (params['activation wvw']) {
    const wvwActivation = parseFloat(params['activation wvw']);
    if (wvwActivation !== baseActivation) {
      if (!overrides.wvw) overrides.wvw = { facts: [] };
      // Activation is not a fact in the API, but we can note it
    }
  }

  if (params['activation pvp']) {
    const pvpActivation = parseFloat(params['activation pvp']);
    if (pvpActivation !== baseActivation) {
      if (!overrides.pvp) overrides.pvp = { facts: [] };
    }
  }

  // Check for range overrides
  const baseRange = parseInt(params.range, 10);

  if (params['range wvw']) {
    const wvwRange = parseInt(params['range wvw'], 10);
    if (wvwRange !== baseRange) {
      addOverride('wvw', 'Range', wvwRange);
    }
  }

  if (params['range pvp']) {
    const pvpRange = parseInt(params['range pvp'], 10);
    if (pvpRange !== baseRange) {
      addOverride('pvp', 'Range', pvpRange);
    }
  }

  return overrides;
}

/**
 * Parse skill IDs from the id parameter
 * @param {string} idParam - Comma-separated skill IDs
 * @returns {number[]} Array of skill IDs
 */
export function parseSkillIds(idParam) {
  if (!idParam) return [];

  return idParam
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id));
}

/**
 * Main function to extract competitive split data from wikitext
 * @param {string} wikitext - Raw wikitext
 * @returns {object|null} Structured competitive split data
 */
export function extractCompetitiveSplits(wikitext) {
  const infobox = parseInfobox(wikitext);
  if (!infobox) return null;

  const skillIds = parseSkillIds(infobox.id);
  const facts = parseSkillFacts(infobox.facts);
  const overrides = extractModeOverrides(infobox);

  // Merge facts from parsed skill facts with overrides
  ['pve', 'pvp', 'wvw'].forEach(mode => {
    if (facts[mode] && facts[mode].length > 0) {
      if (!overrides[mode]) {
        overrides[mode] = { facts: [] };
      }
      overrides[mode].facts.push(...facts[mode]);
    }
  });

  return {
    ids: skillIds,
    split: infobox.split,
    overrides,
  };
}
