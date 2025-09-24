const { initializeTestEnvironment, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, collection, query, where, orderBy, getDocs, Timestamp } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

(async () => {
  const projectId = 'gymbro-21-test';
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '../firebase/firestore.rules'), 'utf8'),
    },
  });

  const adminContext = testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'matches', 'test_match'), {
      participants: ['pzZTNQKvytVzEJ6gXfvwZwXC1hH2', 'YpUhwY7lpGa7vB5emiCR1wdet8I2'],
      status: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
  await adminContext;

  const user = testEnv.authenticatedContext('pzZTNQKvytVzEJ6gXfvwZwXC1hH2');
  const db = user.firestore();

  const q = query(
    collection(db, 'matches'),
    where('participants', 'array-contains', 'pzZTNQKvytVzEJ6gXfvwZwXC1hH2'),
    orderBy('updatedAt', 'desc'),
  );

  try {
    await assertSucceeds(getDocs(q));
    console.log('Query succeeded under rules.');
  } catch (error) {
    console.error('Query failed under rules:', error);
  }

  await testEnv.cleanup();
})();
