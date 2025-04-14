import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST() {
  try {
    const user = auth.currentUser;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's data from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user's premium status in Firestore
    await updateDoc(doc(db, 'users', user.uid), {
      isPremium: false,
      subscriptionEndDate: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 