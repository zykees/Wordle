import { NextResponse } from 'next/server';
import { isServerValidWord } from '@/lib/words/serverDictionary';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const word = searchParams.get('word')?.toUpperCase().trim() || '';
    const length = Number(searchParams.get('length')) || word.length;

    if (!word || word.length !== length) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    const isValid = isServerValidWord(word, length);
    return NextResponse.json({ valid: isValid }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      }
    });
  } catch (err) {
    console.error('Word validation error:', err);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const word = body.word?.toUpperCase().trim() || '';
    const length = Number(body.length) || word.length;

    if (!word || word.length !== length) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    const isValid = isServerValidWord(word, length);
    return NextResponse.json({ valid: isValid }, { status: 200 });
  } catch (err) {
    console.error('Word validation POST error:', err);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
