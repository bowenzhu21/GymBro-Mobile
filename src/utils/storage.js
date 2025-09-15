import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getJSON(key, fallback) {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (_) {
    return fallback;
  }
}

export async function setJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

export async function getArray(key) {
  const v = await getJSON(key, []);
  return Array.isArray(v) ? v : [];
}

export async function addUnique(key, value) {
  const arr = await getArray(key);
  if (!arr.some((x) => JSON.stringify(x) === JSON.stringify(value))) {
    arr.push(value);
    await setJSON(key, arr);
  }
  return arr;
}

export async function removeItem(key, predicate) {
  const arr = await getArray(key);
  const next = arr.filter((x) => !predicate(x));
  await setJSON(key, next);
  return next;
}
