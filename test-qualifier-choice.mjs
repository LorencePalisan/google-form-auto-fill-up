import { randomInt } from 'node:crypto';

export function parseSocialWeights(value) {
  const weights = value.split(',').map(part => part.trim() === '' ? NaN : Number(part));
  if (weights.length !== 3 || weights.some(weight => !Number.isInteger(weight) || weight < 0)
    || weights.reduce((sum, weight) => sum + weight, 0) !== 100) {
    throw new Error('--social-weights must be three whole percentages totaling 100: Facebook,Instagram,TikTok (e.g. 40,30,30).');
  }
  return weights;
}

export function selectTestQualifier(labels, socialWeights, draw = randomInt) {
  const consent = labels.find(label => label.startsWith('I Agree'));
  if (consent) return consent;

  if (socialWeights && labels.some(label => /^facebook$/i.test(label.trim()))) {
    const platforms = ['facebook', 'instagram', 'tiktok'].map(platform =>
      labels.find(label => label.trim().toLowerCase() === platform));
    if (platforms.some(label => !label)) throw new Error('Missing expected social media option.');
    const roll = draw(100);
    let threshold = 0;
    for (let i = 0; i < platforms.length; i++) {
      threshold += socialWeights[i];
      if (roll < threshold) return platforms[i];
    }
    throw new Error('Invalid social media weights.');
  }

  if (!labels.includes('Facebook') && !labels.includes('GadgetPro Repair Services-Main')) {
    throw new Error('Unknown non-scored question; configure a test value first.');
  }
  const eligible = labels.filter(label => label.trim() && !/^none(?: of the above)?$/i.test(label.trim()));
  if (!eligible.length) throw new Error('No eligible qualifier choices.');
  return eligible[randomInt(eligible.length)];
}
