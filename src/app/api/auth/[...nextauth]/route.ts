import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { NextAuthOptions } from 'next-auth';
import type { User } from 'next-auth';
import { NextResponse } from 'next/server';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { 
          label: "Email", 
          type: "text",
          placeholder: "example@example.com"
        },
        password: { 
          label: "Password", 
          type: "password" 
        }
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            credentials.email.trim(),
            credentials.password
          );
          
          if (!userCredential.user) {
            throw new Error('Invalid credentials');
          }

          return {
            id: userCredential.user.uid,
            email: userCredential.user.email || '',
            name: userCredential.user.displayName || '',
          };
        } catch (error: any) {
          console.error('Authentication error:', error);
          // Handle specific Firebase error codes
          if (error.code === 'auth/invalid-credential' || 
              error.code === 'auth/wrong-password' || 
              error.code === 'auth/user-not-found') {
            throw new Error('Invalid email or password');
          } else if (error.code === 'auth/too-many-requests') {
            throw new Error('Too many failed attempts. Please try again later');
          } else if (error.code === 'auth/invalid-email') {
            throw new Error('Invalid email format');
          } else {
            throw new Error('Authentication failed. Please try again.');
          }
        }
      }
    })
  ],
  pages: {
    signIn: '/',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    }
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 