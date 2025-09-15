export const INVALID_IG = 'this-handle_is_invalid-and_too_long_0123456789';

export const sampleUsers = [
  { id: 1, name: 'Alex', gender: 'Male', height: 178, weight: 180, benchPress: 225, squat: 315, legPress: 500, gym: 'Anytime Fitness', city: 'San Jose', goal: 'Hypertrophy', experience: 'Intermediate', preferredTime: 'Evening', instagram: INVALID_IG },
  { id: 2, name: 'Sam', gender: 'Male', height: 185, weight: 200, benchPress: 245, squat: 335, legPress: 520, gym: "Gold's Gym", city: 'San Jose', goal: 'Strength', experience: 'Advanced', preferredTime: 'Morning', instagram: INVALID_IG },
  { id: 3, name: 'Jordan', gender: 'Female', height: 165, weight: 140, benchPress: 115, squat: 185, legPress: 300, gym: 'Planet Fitness', city: 'Santa Clara', goal: 'Cutting', experience: 'Beginner', preferredTime: 'Afternoon', instagram: INVALID_IG },
  { id: 4, name: 'Taylor', gender: 'Female', height: 170, weight: 150, benchPress: 135, squat: 205, legPress: 350, gym: 'LA Fitness', city: 'San Jose', goal: 'Hypertrophy', experience: 'Intermediate', preferredTime: 'Evening', instagram: INVALID_IG },
  { id: 5, name: 'Chris', gender: 'Male', height: 172, weight: 165, benchPress: 205, squat: 295, legPress: 480, gym: 'Equinox', city: 'San Francisco', goal: 'Cutting', experience: 'Intermediate', preferredTime: 'Morning', instagram: INVALID_IG },
  { id: 6, name: 'Morgan', gender: 'Female', height: 160, weight: 130, benchPress: 95, squat: 165, legPress: 280, gym: 'Crunch', city: 'Cupertino', goal: 'General Fitness', experience: 'Beginner', preferredTime: 'Morning', instagram: INVALID_IG },
  { id: 7, name: 'Drew', gender: 'Male', height: 180, weight: 190, benchPress: 235, squat: 325, legPress: 510, gym: '24 Hour Fitness', city: 'Sunnyvale', goal: 'Strength', experience: 'Advanced', preferredTime: 'Evening', instagram: INVALID_IG },
  { id: 8, name: 'Riley', gender: 'Female', height: 175, weight: 155, benchPress: 125, squat: 195, legPress: 320, gym: 'Anytime Fitness', city: 'San Jose', goal: 'Hypertrophy', experience: 'Intermediate', preferredTime: 'Afternoon', instagram: INVALID_IG },
  { id: 9, name: 'Jamie', gender: 'Male', height: 168, weight: 160, benchPress: 185, squat: 265, legPress: 430, gym: "Gold's Gym", city: 'Santa Clara', goal: 'Bulking', experience: 'Intermediate', preferredTime: 'Evening', instagram: INVALID_IG },
  { id: 10, name: 'Casey', gender: 'Female', height: 168, weight: 135, benchPress: 105, squat: 175, legPress: 270, gym: 'Planet Fitness', city: 'San Jose', goal: 'General Fitness', experience: 'Beginner', preferredTime: 'Afternoon', instagram: INVALID_IG },
];

const scales = { height: 200, weight: 300, benchPress: 400, squat: 500, legPress: 800 };
const asNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function computeDistance(a, b, weights) {
  const keys = Object.keys(scales);
  let sum = 0;
  let used = 0;
  for (const k of keys) {
    const av = asNumber(a?.[k]);
    const bv = asNumber(b?.[k]);
    if (av !== undefined && bv !== undefined) {
      const d = (av - bv) / scales[k];
      const w = weights?.[k] ?? 1;
      sum += w * d * d;
      used += 1;
    }
  }
  if (used === 0) return Infinity;
  return Math.sqrt(sum / used);
}

export const percent = (distance) => Math.max(0, Math.min(100, Math.round(100 * (1 - distance))));

