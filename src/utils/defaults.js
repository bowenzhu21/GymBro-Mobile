import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/firebase';

let cache = {};

export async function getDefaultUrl(kind) {
  if (cache[kind]) return cache[kind];
  const path = kind === 'user' ? 'defaults/user.jpg' : 'defaults/match.jpg';
  try {
    const url = await getDownloadURL(ref(storage, path));
    cache[kind] = url;
    return url;
  } catch (_) {
    return null;
  }
}

