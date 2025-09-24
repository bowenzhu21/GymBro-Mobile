import AsyncStorage from '@react-native-async-storage/async-storage';

const resolveScope = (options) => {
  if (!options) return undefined;
  if (typeof options === 'string') return options;
  return options.scope;
};

const scopedKey = (key, options) => {
  const scope = resolveScope(options);
  return scope ? `${scope}:${key}` : key;
};

export async function getJSON(key, fallback, options) {
  const storeKey = scopedKey(key, options);
  try {
    const v = await AsyncStorage.getItem(storeKey);
    return v ? JSON.parse(v) : fallback;
  } catch (_) {
    return fallback;
  }
}

export async function setJSON(key, value, options) {
  const storeKey = scopedKey(key, options);
  try {
    await AsyncStorage.setItem(storeKey, JSON.stringify(value));
  } catch (_) {}
}

export async function remove(key, options) {
  const storeKey = scopedKey(key, options);
  try {
    await AsyncStorage.removeItem(storeKey);
  } catch (_) {}
}

export async function getArray(key, options) {
  const v = await getJSON(key, [], options);
  return Array.isArray(v) ? v : [];
}

export async function addUnique(key, value, options) {
  const arr = await getArray(key, options);
  if (!arr.some((x) => JSON.stringify(x) === JSON.stringify(value))) {
    arr.push(value);
    await setJSON(key, arr, options);
  }
  return arr;
}

export async function removeItem(key, predicate, options) {
  const arr = await getArray(key, options);
  const next = arr.filter((x) => !predicate(x));
  await setJSON(key, next, options);
  return next;
}

export { scopedKey };
