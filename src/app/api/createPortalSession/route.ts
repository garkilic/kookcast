import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

export async function POST(request: Request) {
  try {
    const { returnUrl } = await request.json();

    if (!returnUrl) {
      return NextResponse.json(
        { error: 'Missing required field: returnUrl' },
        { status: 400 }
      );
    }

    const functions = getFunctions();
    const createPortalSession = httpsCallable(functions, 'createPortalSession');
    const { data } = await createPortalSession({
      returnUrl,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 