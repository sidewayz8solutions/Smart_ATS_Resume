import { NextRequest, NextResponse } from 'next/server';

import { createClientFromRequest } from '@/lib/supabase/server';

/**
 * POST /api/resumes/new
 *
 * The builder saves through this endpoint (see src/store/resumeStore.ts).
 * It stores the whole ResumeData document in `content`, which is what
 * /builder/[id] reads back, and mirrors a human-readable title/template.
 */
export async function POST(req: NextRequest) {
  try {
    const { supabase } = createClientFromRequest(req);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const resumeData = await req.json().catch(() => null);
    if (!resumeData || typeof resumeData !== 'object') {
      return NextResponse.json({ error: 'Resume data is required' }, { status: 400 });
    }

    const fullName = resumeData?.personalInfo?.fullName?.trim();
    const jobTitle = resumeData?.personalInfo?.title?.trim();
    const title = [fullName, jobTitle].filter(Boolean).join(' — ') || 'Untitled Resume';

    const { data, error } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        title,
        template_id: resumeData?.templateId || 'professional',
        content: resumeData,
        data: resumeData,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create resume:', error);
      return NextResponse.json(
        { error: 'Failed to save resume', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error creating resume:', error);
    return NextResponse.json({ error: 'Failed to save resume' }, { status: 500 });
  }
}
