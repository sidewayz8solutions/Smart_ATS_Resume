import { NextRequest, NextResponse } from 'next/server';

import { createClientFromRequest } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/resumes/[id]   -> the stored ResumeData document
 * PUT /api/resumes/[id]   -> overwrite it
 * DELETE /api/resumes/[id]
 *
 * Ownership is enforced twice: the query filters on user_id and the RLS
 * policies on `resumes` do the same, so a wrong id is a 404 rather than a
 * leak of someone else's document.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid resume id' }, { status: 400 });
    }

    const { supabase } = createClientFromRequest(req);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('resumes')
      .select('id, title, template_id, content, data, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    return NextResponse.json(data.content ?? data.data ?? {}, { status: 200 });
  } catch (error) {
    console.error('Unexpected error loading resume:', error);
    return NextResponse.json({ error: 'Failed to load resume' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid resume id' }, { status: 400 });
    }

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
      .update({
        title,
        template_id: resumeData?.templateId || 'professional',
        content: resumeData,
        data: resumeData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    return NextResponse.json({ id: data.id }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error updating resume:', error);
    return NextResponse.json({ error: 'Failed to save resume' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid resume id' }, { status: 400 });
    }

    const { supabase } = createClientFromRequest(req);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { error } = await supabase.from('resumes').delete().eq('id', id).eq('user_id', user.id);

    if (error) {
      console.error('Failed to delete resume:', error);
      return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error deleting resume:', error);
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 });
  }
}
