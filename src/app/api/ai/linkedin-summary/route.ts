import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/provider';

export async function POST(req: NextRequest) {
  try {
    // Basic auth check (AI features require a logged-in user)
    const { createClientFromRequest } = await import('@/lib/supabase/server');
    const { supabase } = createClientFromRequest(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required to use AI features' }, { status: 401 });
    }

    const body = await req.json();
    const resume = body?.resume;

    if (!resume) {
      return NextResponse.json({ error: 'Resume content is required' }, { status: 400 });
    }

    const ai = getAIProvider();
    if (!ai) {
      console.error('No AI provider configured: set OPENROUTER_API_KEY or OPENAI_API_KEY');
      return NextResponse.json(
        { error: 'AI service is temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    const openai = ai.client;

    // Build prompt: provide resume (structured or plain text) and request an "About" section suitable for LinkedIn
    const resumeText = typeof resume === 'string' ? resume : JSON.stringify(resume);

    const prompt = `You are a professional career copywriter. Given the following resume content, generate a LinkedIn "About" section (3-5 concise sentences) that highlights strengths, uses professional language, and includes relevant keywords for ATS and recruiter searches. Keep it friendly but professional, and under 700 characters. Return only the text for the About section without extra commentary.\n\nResume:\n${resumeText}`;

    const completion = await openai.chat.completions.create({
      model: ai.model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    const about = completion.choices[0]?.message?.content?.trim();
    if (!about) {
      console.error('No content received from OpenAI for LinkedIn about');
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    // Truncate defensively to 700 characters
    const truncated = about.slice(0, 700);

    return NextResponse.json({ about: truncated });
  } catch (error: any) {
    console.error('LinkedIn AI generation error:', error);
    return NextResponse.json({ error: 'Failed to generate LinkedIn about. Please try again.' }, { status: 500 });
  }
}
