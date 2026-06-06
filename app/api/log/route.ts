import { NextResponse } from 'next/server';
import { ServiceFactory } from '@/lib/core/ServiceFactory';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { level, message, details, source, user, reqId } = body;
    
    const logger = ServiceFactory.getLoggerService();
    const sourceTag = source ? `[${source}] ` : '[ClientUI] ';
    const meta = { user, reqId };
    
    if (level === 'error') {
      logger.error(`${sourceTag}${message}`, details, meta);
    } else if (level === 'warn') {
      logger.warn(`${sourceTag}${message}`, details, meta);
    } else {
      logger.info(`${sourceTag}${message}`, details, meta);
    }
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to parse client log', err);
    return NextResponse.json({ error: 'Failed to log' }, { status: 500 });
  }
}
