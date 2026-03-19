'use server';

import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { signIn } from '@/lib/auth';
import { AuthError } from 'next-auth';
import { convertPreview } from './convert-preview';

export interface ActionResult {
  error?: string;
  success?: boolean;
  projectId?: string;
}

export async function register(
  name: string,
  email: string,
  password: string,
  preferredLocale: string = 'en',
  previewId?: string,
): Promise<ActionResult> {
  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return { error: 'Email already registered' };

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: { name, email, hashedPassword, preferredLocale },
    });

    await signIn('credentials', { email, password, redirect: false });

    if (previewId) {
      try {
        const { projectId } = await convertPreview(user.id, previewId);
        return { success: true, projectId };
      } catch {
        // Don't fail registration if preview conversion fails
      }
    }

    return { success: true };
  } catch {
    return { error: 'Registration failed. Please try again.' };
  }
}

export async function loginWithCredentials(
  email: string,
  password: string,
): Promise<ActionResult> {
  try {
    await signIn('credentials', { email, password, redirect: false });
    return { success: true };
  } catch (err) {
    if (err instanceof AuthError) return { error: 'Invalid email or password' };
    return { error: 'Login failed. Please try again.' };
  }
}
