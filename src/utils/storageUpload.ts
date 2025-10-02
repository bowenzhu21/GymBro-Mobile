import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/firebase';

export async function uploadProfilePhoto(uid, fileUri, opts) {
  if (!uid) throw new Error('Missing user id for profile photo upload');
  if (!fileUri) throw new Error('Missing file URI for profile photo upload');

  const res = await fetch(fileUri);
  if (!res.ok) {
    throw new Error(`Failed to read local file data (${res.status})`);
  }

  const arrayBuffer = typeof res.arrayBuffer === 'function'
    ? await res.arrayBuffer()
    : await (await res.blob()).arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  if (!bytes.length) {
    throw new Error('Local image appears to be empty or unreadable.');
  }

  const storageRef = ref(storage, `users/${uid}/profile.jpg`);
  const metadata = { contentType: 'image/jpeg' };

  try {
    const task = uploadBytesResumable(storageRef, arrayBuffer, metadata);
    await new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        snap => {
          if (opts?.onProgress) {
            const progress = snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0;
            opts.onProgress(progress);
          }
        },
        err => reject(err),
        () => resolve(task.snapshot)
      );
    });

    const url = await getDownloadURL(storageRef);
    return { path: `users/${uid}/profile.jpg`, url };
  } catch (error) {
    console.log('Upload failed', {
      code: error?.code,
      message: error?.message,
      serverResponse: error?.customData?.serverResponse,
      path: `users/${uid}/profile.jpg`,
      contentType: 'image/jpeg',
      error,
    });
    console.error(error);
    throw error;
  }
}
