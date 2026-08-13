import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/authGuard';

/* A troubleshooting endpoint that dumps the exercise library. Kept, because the
   coach's tooling reads it, but no longer answering the open internet. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const exercises = await prisma.exercises.findMany({ select: { id: true, name_ar: true } });
    return NextResponse.json(exercises);
  } catch (error: unknown) {
    console.error('Dump exercises error:', error);
    /* The raw message used to be handed back to the caller; it can name tables
       and columns, which is not something an error response should teach. */
    return NextResponse.json({ error: 'تعذّر جلب التمارين' }, { status: 500 });
  }
}
