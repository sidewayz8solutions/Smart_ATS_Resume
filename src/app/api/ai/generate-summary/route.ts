import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/provider';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { createClientFromRequest } = await import('@/lib/supabase/server');
    const { supabase } = createClientFromRequest(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required to use AI features' },
        { status: 401 }
      );
    }

    const { jobTitle } = await req.json();

    if (!jobTitle || typeof jobTitle !== 'string' || jobTitle.trim().length === 0) {
      return NextResponse.json(
        { error: 'Job title is required' },
        { status: 400 }
      );
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

    const completion = await openai.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: 'user',
          content: `Generate a professional summary for a resume for someone with the job title: "${jobTitle}".

          The summary should be:
          - 2-4 sentences long
          - Highlight key strengths and experience relevant to the role
          - Use professional language
          - Include relevant keywords for ATS optimization
          - MUST be under 500 characters

          Return only the summary text, no additional formatting.`
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const summary = completion.choices[0]?.message?.content;

    if (!summary) {
      console.error('No content received from OpenAI');
      return NextResponse.json(
        { error: 'AI service returned empty response. Please try again.' },
        { status: 500 }
      );
    }

    // Enforce 500 character limit
    const truncatedSummary = summary.trim().slice(0, 500);

    return NextResponse.json({
      summary: truncatedSummary
    });
  } catch (error: any) {
    console.error('AI summary generation error:', error);

    if (error?.status === 401 || error?.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'AI service authentication failed. Please contact support.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate summary. Please try again.' },
      { status: 500 }
    );
  }
}

